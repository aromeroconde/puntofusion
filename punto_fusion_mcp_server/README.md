# Punto Fusión MCP Server

MCP (Model Context Protocol) server for integrating WhatsApp chatbots with the Punto Fusión API.

## Tools Available

| Tool | Description | Use Case |
|------|-------------|----------|
| `pf_health_check` | Check API status | Verify connection |
| `pf_verify_contact_by_whatsapp` | Check if phone exists | First contact verification |
| `pf_check_student` | Verify if active student | Student authentication |
| `pf_create_student` | Enroll new student | New student registration |
| `pf_get_student` | Get student profile | Profile lookup |
| `pf_get_student_bookings` | Get upcoming classes | "When is my next class?" |
| `pf_check_reschedule_eligibility` | Check reschedule rules | "Can I change my class?" |
| `pf_reschedule_class` | Execute reschedule | "Move my class to Tuesday" |
| `pf_sync_student_schedule` | Sync schedule to Agendador | Admin automation |
| `pf_get_available_slots` | Find open class slots | "What classes are available?" |
| `pf_list_students` | List all students | Admin queries |
| `pf_list_scheduled_students` | List students with schedules | Admin automation |
| `pf_list_payments` | List all payments | Payment history |
| `pf_get_payment` | Get payment details | Payment lookup |
| `pf_list_services` | List available services | "What classes do you offer?" |
| `pf_list_invoices` | List invoices | Billing queries |
| `pf_list_alegra_contacts` | List Alegra contacts | Billing system |
| `pf_create_invoice` | Create invoice | Generate billing |

## Setup

```bash
# Install dependencies
npm install

# Build
npm run build

# Run (stdio mode - for Claude Desktop or other MCP clients)
node dist/index.js
```

## Environment Variables

```bash
PF_API_URL=https://puntofusion.smartnexo.com/api  # API base URL
```

## Example Usage in Chatbot

The chatbot can use these tools to:

1. **Verify customer**: When user sends WhatsApp → `pf_verify_contact_by_whatsapp`
2. **Check class schedule**: "When is my next class?" → `pf_get_student_bookings`
3. **Reschedule class**: "I need to change my Tuesday class" → `pf_reschedule_class`
4. **Show services**: "What do you offer?" → `pf_list_services`
```

