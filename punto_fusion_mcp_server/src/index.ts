#!/usr/bin/env node
/**
 * MCP Server for Punto Fusión API.
 *
 * Supports both:
 * - stdio: For local use (Claude Desktop)
 * - HTTP: For remote use (n8n chatbot integration)
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import express from "express";
import { z } from "zod";
import axios, { AxiosError } from "axios";

// Constants
const API_BASE_URL = process.env["PF_API_URL"] || "https://puntofusion.smartnexo.com/api";
const CHARACTER_LIMIT = 25000;

// ─── API Client ───────────────────────────────────────────

async function apiRequest<T>(
  endpoint: string,
  method: "GET" | "POST" | "PATCH" | "PUT" = "GET",
  data?: any,
  params?: any
): Promise<T> {
  const response = await axios({
    method,
    url: `${API_BASE_URL}/${endpoint}`,
    data,
    params,
    timeout: 30000,
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json"
    }
  });
  return response.data;
}

function handleError(error: unknown): string {
  if (error instanceof AxiosError) {
    if (error.response) {
      const msg = error.response.data?.error || error.response.statusText;
      return `Error ${error.response.status}: ${msg}`;
    } else if (error.code === "ECONNABORTED") {
      return "Error: Request timed out. Please try again.";
    }
  }
  return `Error: ${error instanceof Error ? error.message : String(error)}`;
}

// ─── Server ───────────────────────────────────────────────

function createServer() {
  const server = new McpServer({
    name: "punto-fusion-mcp-server",
    version: "1.0.0"
  });

  // ═══════════════════════════════════════════════════════════════
  // TOOLS
  // ═══════════════════════════════════════════════════════════════

  // ─── 1. Health Check ──────────────────────────────────────
  server.registerTool(
    "pf_health_check",
    {
      title: "Health Check",
      description: "Check if the Punto Fusión API is running. Returns status ok if healthy.",
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
    },
    async () => {
      try {
        const data = await apiRequest<any>("health");
        return { content: [{ type: "text", text: JSON.stringify(data) }] };
      } catch (error) {
        return { content: [{ type: "text", text: handleError(error) }] };
      }
    }
  );

  // ─── 2. Contact: Verify by WhatsApp ──────────────────────
  server.registerTool(
    "pf_verify_contact_by_whatsapp",
    {
      title: "Verify Contact by WhatsApp",
      description: "Check if a phone number exists in the system. Returns contact data and whether they are an active student.",
      inputSchema: z.object({
        whatsapp: z.string().min(5).describe("WhatsApp phone number (e.g. +573001234567)")
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
    },
    async ({ whatsapp }) => {
      try {
        const data = await apiRequest<any>("contacts/upsert", "POST", {
          whatsapp,
          last_seen_at: new Date().toISOString()
        });
        return { content: [{ type: "text", text: JSON.stringify(data) }] };
      } catch (error) {
        return { content: [{ type: "text", text: handleError(error) }] };
      }
    }
  );

  // ─── 3. Student: Check if active ──────────────────────────
  server.registerTool(
    "pf_check_student",
    {
      title: "Check if Student is Active",
      description: "Verify if a WhatsApp number belongs to an active student. Returns student status, level, and schedule info.",
      inputSchema: z.object({
        whatsapp: z.string().min(5).describe("WhatsApp phone number (e.g. +573001234567)")
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
    },
    async ({ whatsapp }) => {
      try {
        const data = await apiRequest<any>("students/check", "POST", { whatsapp });
        return { content: [{ type: "text", text: JSON.stringify(data) }] };
      } catch (error) {
        return { content: [{ type: "text", text: handleError(error) }] };
      }
    }
  );

  // ─── 4. Student: Create / Matriculate ─────────────────────
  server.registerTool(
    "pf_create_student",
    {
      title: "Create New Student",
      description: "Enroll a new student. If contact doesn't exist, it will be created automatically.",
      inputSchema: z.object({
        full_name: z.string().min(2).describe("Full name of the student"),
        whatsapp: z.string().min(5).describe("WhatsApp phone number"),
        email: z.string().email().optional().describe("Email address (optional)"),
        level: z.string().optional().describe("Dance level (e.g. 'beginner', 'intermediate', 'advanced')"),
        group_schedule: z.string().optional().describe("Schedule in format: eventTypeId|scheduleId"),
        notes: z.string().optional().describe("Additional notes"),
        requires_invoice: z.boolean().default(false).describe("Whether student needs invoices")
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true }
    },
    async (params) => {
      try {
        const data = await apiRequest<any>("students", "POST", params);
        return { content: [{ type: "text", text: JSON.stringify(data) }] };
      } catch (error) {
        return { content: [{ type: "text", text: handleError(error) }] };
      }
    }
  );

  // ─── 5. Student: Get profile ──────────────────────────────
  server.registerTool(
    "pf_get_student",
    {
      title: "Get Student Profile",
      description: "Get complete student profile including contact info, level, status, and schedule.",
      inputSchema: z.object({
        student_id: z.string().uuid().describe("Student UUID from the system")
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
    },
    async ({ student_id }) => {
      try {
        const data = await apiRequest<any>(`students/${student_id}`);
        return { content: [{ type: "text", text: JSON.stringify(data) }] };
      } catch (error) {
        return { content: [{ type: "text", text: handleError(error) }] };
      }
    }
  );

  // ─── 6. Student: Get upcoming bookings ────────────────────
  server.registerTool(
    "pf_get_student_bookings",
    {
      title: "Get Student's Upcoming Bookings",
      description: "List all upcoming class reservations for a student. Returns date, time, and class type.",
      inputSchema: z.object({
        student_id: z.string().uuid().describe("Student UUID")
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
    },
    async ({ student_id }) => {
      try {
        const data = await apiRequest<any>(`students/${student_id}/bookings`);
        return { content: [{ type: "text", text: JSON.stringify(data) }] };
      } catch (error) {
        return { content: [{ type: "text", text: handleError(error) }] };
      }
    }
  );

  // ─── 7. Student: Check reschedule eligibility ─────────────
  server.registerTool(
    "pf_check_reschedule_eligibility",
    {
      title: "Check Reschedule Eligibility",
      description: "Check if a student can reschedule a class. Rules: max 1 per month, min 48h before class.",
      inputSchema: z.object({
        student_id: z.string().uuid().describe("Student UUID"),
        booking_id: z.string().uuid().optional().describe("Booking UUID to check 48h rule")
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
    },
    async ({ student_id, booking_id }) => {
      try {
        const params: any = {};
        if (booking_id) params.bookingId = booking_id;
        const data = await apiRequest<any>(`students/${student_id}/entitlements`, "GET", undefined, params);
        return { content: [{ type: "text", text: JSON.stringify(data) }] };
      } catch (error) {
        return { content: [{ type: "text", text: handleError(error) }] };
      }
    }
  );

  // ─── 8. Student: Reschedule a class ───────────────────────
  server.registerTool(
    "pf_reschedule_class",
    {
      title: "Reschedule a Class",
      description: "Reschedule a student's class. First check eligibility with pf_check_reschedule_eligibility.",
      inputSchema: z.object({
        student_id: z.string().uuid().describe("Student UUID"),
        booking_id_to_cancel: z.string().uuid().describe("Booking UUID to cancel"),
        new_event_type_id: z.string().uuid().describe("New event type UUID"),
        new_start_time: z.string().describe("New start time in format YYYY-MM-DDTHH:mm:00")
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true }
    },
    async ({ student_id, booking_id_to_cancel, new_event_type_id, new_start_time }) => {
      try {
        const data = await apiRequest<any>(`students/${student_id}/reschedule`, "POST", {
          bookingIdToCancel: booking_id_to_cancel,
          newEventTypeId: new_event_type_id,
          newStartTime: new_start_time
        });
        return { content: [{ type: "text", text: JSON.stringify(data) }] };
      } catch (error) {
        return { content: [{ type: "text", text: handleError(error) }] };
      }
    }
  );

  // ─── 9. Student: Sync schedule to Agendador ───────────────
  server.registerTool(
    "pf_sync_student_schedule",
    {
      title: "Sync Student Schedule to Agendador",
      description: "Create all class reservations for the current (or next) month based on student's fixed schedule.",
      inputSchema: z.object({
        student_id: z.string().uuid().describe("Student UUID"),
        month: z.enum(["current", "next"]).default("current").describe("Which month to sync")
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true }
    },
    async ({ student_id, month }) => {
      try {
        const data = await apiRequest<any>(`students/${student_id}/sync-schedule?month=${month}`, "POST");
        return { content: [{ type: "text", text: JSON.stringify(data) }] };
      } catch (error) {
        return { content: [{ type: "text", text: handleError(error) }] };
      }
    }
  );

  // ─── 10. Student: Get available slots ─────────────────────
  server.registerTool(
    "pf_get_available_slots",
    {
      title: "Get Available Class Slots",
      description: "Check available time slots for a class type within a date range. Use this to find open classes for rescheduling.",
      inputSchema: z.object({
        event_type_id: z.string().uuid().describe("Event type UUID"),
        start_date: z.string().describe("Start date (YYYY-MM-DD)"),
        end_date: z.string().describe("End date (YYYY-MM-DD)")
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
    },
    async ({ event_type_id, start_date, end_date }) => {
      try {
        const data = await apiRequest<any>("students/available_slots", "GET", undefined, {
          eventTypeId: event_type_id,
          startDate: start_date,
          endDate: end_date
        });
        return { content: [{ type: "text", text: JSON.stringify(data) }] };
      } catch (error) {
        return { content: [{ type: "text", text: handleError(error) }] };
      }
    }
  );

  // ─── 11. Student: List all ────────────────────────────────
  server.registerTool(
    "pf_list_students",
    {
      title: "List All Students",
      description: "Get all students with their contact info. Returns most recent first.",
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
    },
    async () => {
      try {
        const data = await apiRequest<any>("students");
        return { content: [{ type: "text", text: JSON.stringify(data) }] };
      } catch (error) {
        return { content: [{ type: "text", text: handleError(error) }] };
      }
    }
  );

  // ─── 12. Student: List with fixed schedule ────────────────
  server.registerTool(
    "pf_list_scheduled_students",
    {
      title: "List Students with Fixed Schedule",
      description: "Get all active students that have a fixed class schedule assigned.",
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
    },
    async () => {
      try {
        const data = await apiRequest<any>("students/scheduled");
        return { content: [{ type: "text", text: JSON.stringify(data) }] };
      } catch (error) {
        return { content: [{ type: "text", text: handleError(error) }] };
      }
    }
  );

  // ─── 13. Payments: List ───────────────────────────────────
  server.registerTool(
    "pf_list_payments",
    {
      title: "List Payments",
      description: "Get all payments in the system.",
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
    },
    async () => {
      try {
        const data = await apiRequest<any>("payments");
        return { content: [{ type: "text", text: JSON.stringify(data) }] };
      } catch (error) {
        return { content: [{ type: "text", text: handleError(error) }] };
      }
    }
  );

  // ─── 14. Payments: Get by ID ──────────────────────────────
  server.registerTool(
    "pf_get_payment",
    {
      title: "Get Payment Details",
      description: "Get details of a specific payment.",
      inputSchema: z.object({
        payment_id: z.string().uuid().describe("Payment UUID")
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
    },
    async ({ payment_id }) => {
      try {
        const data = await apiRequest<any>(`payments/${payment_id}`);
        return { content: [{ type: "text", text: JSON.stringify(data) }] };
      } catch (error) {
        return { content: [{ type: "text", text: handleError(error) }] };
      }
    }
  );

  // ─── 15. Services: List available ─────────────────────────
  server.registerTool(
    "pf_list_services",
    {
      title: "List Available Services",
      description: "Get all available services (classes, workshops, packages). Use this to show options to new students.",
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
    },
    async () => {
      try {
        const data = await apiRequest<any>("services");
        return { content: [{ type: "text", text: JSON.stringify(data) }] };
      } catch (error) {
        return { content: [{ type: "text", text: handleError(error) }] };
      }
    }
  );

  // ─── 16. Billing: List invoices ───────────────────────────
  server.registerTool(
    "pf_list_invoices",
    {
      title: "List Invoices",
      description: "Get all invoices from the billing system (Alegra).",
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
    },
    async () => {
      try {
        const data = await apiRequest<any>("billing");
        return { content: [{ type: "text", text: JSON.stringify(data) }] };
      } catch (error) {
        return { content: [{ type: "text", text: handleError(error) }] };
      }
    }
  );

  // ─── 17. Alegra: List contacts ────────────────────────────
  server.registerTool(
    "pf_list_alegra_contacts",
    {
      title: "List Alegra Contacts",
      description: "Get all contacts from Alegra billing system.",
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
    },
    async () => {
      try {
        const data = await apiRequest<any>("alegra/contacts");
        return { content: [{ type: "text", text: JSON.stringify(data) }] };
      } catch (error) {
        return { content: [{ type: "text", text: handleError(error) }] };
      }
    }
  );

  // ─── 18. Alegra: Create invoice ───────────────────────────
  server.registerTool(
    "pf_create_invoice",
    {
      title: "Create Invoice in Alegra",
      description: "Create a new invoice for a student in Alegra billing system.",
      inputSchema: z.object({
        contact_id: z.string().describe("Alegra contact ID"),
        items: z.array(z.object({
          id: z.string().describe("Item/product ID in Alegra"),
          description: z.string().describe("Item description"),
          quantity: z.number().int().positive().describe("Quantity"),
          price: z.number().positive().describe("Unit price")
        })).min(1).describe("Invoice items")
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true }
    },
    async (params) => {
      try {
        const data = await apiRequest<any>("alegra/invoices", "POST", params);
        return { content: [{ type: "text", text: JSON.stringify(data) }] };
      } catch (error) {
        return { content: [{ type: "text", text: handleError(error) }] };
      }
    }
  );

  return server;
}

// ═══════════════════════════════════════════════════════════════
// TRANSPORT OPTIONS
// ═══════════════════════════════════════════════════════════════

// ─── stdio (for local use) ─────────────────────────────────
async function runStdio() {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("🔥 Punto Fusión MCP Server running on stdio");
}

// ─── HTTP (for remote use) ─────────────────────────────────
async function runHTTP() {
  const app = express();
  app.use(express.json());

  app.post("/mcp", async (req, res) => {
    const server = createServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true
    });

    res.on("close", () => {
      transport.close();
      server.close();
    });

    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  });

  // Health check endpoint
  app.get("/health", (_req, res) => {
    res.json({ status: "ok", service: "punto-fusion-mcp-server" });
  });

  const port = parseInt(process.env["MCP_PORT"] || "3200");
  app.listen(port, "0.0.0.0", () => {
    console.error(`🔥 Punto Fusion MCP Server running on http://0.0.0.0:${port}/mcp`);
  });
}

// ═══════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════

const transport = process.env["TRANSPORT"] || "http";

if (transport === "stdio") {
  runStdio().catch(error => {
    console.error("Server error:", error);
    process.exit(1);
  });
} else {
  runHTTP().catch(error => {
    console.error("Server error:", error);
    process.exit(1);
  });
}
