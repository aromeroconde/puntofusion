import { Routes, Route, Link, useLocation } from "react-router-dom"
import { Calendar, Users, FileText, CreditCard, ClipboardList } from "lucide-react"
import { cn } from "./lib/utils"
import Dashboard from "./pages/Dashboard"
import Payments from "./pages/Payments"
import Requests from "./pages/Requests"
import Students from "./pages/Students"

function Sidebar() {
  const location = useLocation();

  const links = [
    { to: "/", icon: Calendar, label: "Calendario" },
    { to: "/requests", icon: FileText, label: "Solicitudes" },
    { to: "/students", icon: Users, label: "Alumnos" },
    { to: "/payments", icon: CreditCard, label: "Pagos" },
    { to: "/waitlist", icon: ClipboardList, label: "Lista de Espera" },
  ];

  return (
    <aside className="w-64 bg-card text-card-foreground border-r border-border min-h-screen p-4 flex flex-col gap-2">
      <div className="mb-8 px-2 mt-2">
        <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-indigo-500 bg-clip-text text-transparent">Punto Fusión</h1>
      </div>
      <nav className="flex flex-col gap-1">
        {links.map((link) => {
          const Icon = link.icon;
          const isActive = location.pathname === link.to;
          return (
            <Link
              key={link.to}
              to={link.to}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all font-medium text-sm",
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "hover:bg-muted hover:text-foreground text-muted-foreground"
              )}
            >
              <Icon className="w-5 h-5" /> {link.label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}

function App() {
  return (
    <div className="flex h-screen bg-background text-foreground font-sans overflow-hidden">
      <Sidebar />
      <main className="flex-1 p-8 overflow-y-auto">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/requests" element={<Requests />} />
          <Route path="/students" element={<Students />} />
          <Route path="/payments" element={<Payments />} />
          <Route path="/waitlist" element={<div className="text-2xl font-semibold">Lista de Espera (WIP)</div>} />
        </Routes>
      </main>
    </div>
  )
}

export default App
