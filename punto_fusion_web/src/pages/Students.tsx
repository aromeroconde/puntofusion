import { useState, useEffect } from 'react';
import { api, calendarApi } from '../lib/api';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Search, Loader2, MapPin, Pencil, X, Save, CalendarCheck, Plus, UserX, UserCheck } from 'lucide-react';
import { cn } from '../lib/utils';

const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

interface EventType {
    id: string;
    title: string;
    duration: number;
    maxCapacity: number;
}

interface EventTypeSchedule {
    id: string;
    eventTypeId: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
}

export default function Students() {
    const [students, setStudents] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');

    // Modal state
    const [editingStudent, setEditingStudent] = useState<any | null>(null);
    const [eventTypes, setEventTypes] = useState<EventType[]>([]);
    const [allSchedules, setAllSchedules] = useState<EventTypeSchedule[]>([]);
    const [formLevel, setFormLevel] = useState('');
    const [formEventTypeId, setFormEventTypeId] = useState('');
    const [formScheduleId, setFormScheduleId] = useState('');
    const [formRequiresInvoice, setFormRequiresInvoice] = useState(false);
    const [formAlegraContactId, setFormAlegraContactId] = useState<string | null>(null);
    const [formAlegraItemRef, setFormAlegraItemRef] = useState<string>('');
    const [contactSearchQuery, setContactSearchQuery] = useState('');
    const [isSearchingContact, setIsSearchingContact] = useState(false);
    const [contactSearchResult, setContactSearchResult] = useState<any | null>(null);
    const [linkedContactDetails, setLinkedContactDetails] = useState<any | null>(null);
    const [isLoadingLinkedContact, setIsLoadingLinkedContact] = useState(false);
    const [isValidatingProduct, setIsValidatingProduct] = useState(false);
    const [validatedProduct, setValidatedProduct] = useState<any | null>(null);
    const [saving, setSaving] = useState(false);
    const [syncing, setSyncing] = useState<string | null>(null);

    // Modal de crear alumno
    const [showCreateStudentModal, setShowCreateStudentModal] = useState(false);
    const [newStudentForm, setNewStudentForm] = useState({ full_name: '', whatsapp: '', email: '', level: '', notes: '' });
    const [creatingStudent, setCreatingStudent] = useState(false);
    const [togglingStatus, setTogglingStatus] = useState<string | null>(null);

    useEffect(() => {
        fetchStudents();
        fetchEventTypes();
        fetchAllSchedules();
    }, []);

    const fetchStudents = async () => {
        try {
            setLoading(true);
            const res = await api.get('/students');
            if (res.data) setStudents(res.data);
        } catch (error) {
            console.error("Error fetching students", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchEventTypes = async () => {
        try {
            const res = await calendarApi.get('/event-types');
            if (res.data) setEventTypes(res.data);
        } catch (error) {
            console.error("Error fetching event types", error);
        }
    };

    const fetchAllSchedules = async () => {
        try {
            const res = await calendarApi.get('/event-type-schedules');
            if (res.data) setAllSchedules(res.data);
        } catch (error) {
            console.error("Error fetching schedules", error);
        }
    };

    const openEditModal = (student: any) => {
        setEditingStudent(student);
        setFormLevel(student.level || '');
        // group_schedule almacena "eventTypeId|scheduleId"
        const parts = (student.group_schedule || '').split('|');
        setFormEventTypeId(parts[0] || '');
        setFormScheduleId(parts[1] || '');
        setFormRequiresInvoice(student.requires_invoice || false);
        setFormAlegraContactId(student.alegra_contact_id || null);
        setFormAlegraItemRef(student.alegra_item_reference || '');
        setContactSearchQuery('');
        setContactSearchResult(null);
        setLinkedContactDetails(null);
        setValidatedProduct(null);

        if (student.alegra_contact_id) {
            fetchLinkedContact(student.alegra_contact_id);
        }

        if (student.alegra_item_reference) {
            validateAlegraProduct(undefined, student.alegra_item_reference);
        }
    };

    const closeModal = () => {
        setEditingStudent(null);
        setFormLevel('');
        setFormEventTypeId('');
        setFormScheduleId('');
        setFormRequiresInvoice(false);
        setFormAlegraContactId(null);
        setFormAlegraItemRef('');
        setContactSearchQuery('');
        setContactSearchResult(null);
        setLinkedContactDetails(null);
        setValidatedProduct(null);
    };

    const fetchLinkedContact = async (id: string) => {
        try {
            setIsLoadingLinkedContact(true);
            const res = await api.get(`/alegra/contacts/${id}`);
            setLinkedContactDetails(res.data);
        } catch (error) {
            console.error('Error cargando detalles del contacto vinculado:', error);
            setLinkedContactDetails({ error: true });
        } finally {
            setIsLoadingLinkedContact(false);
        }
    };

    const searchAlegraContact = async (e: React.MouseEvent) => {
        e.preventDefault();
        if (!contactSearchQuery.trim()) return;

        try {
            setIsSearchingContact(true);
            setContactSearchResult(null);
            const res = await api.get(`/alegra/contacts?identification=${contactSearchQuery.trim()}`);
            setContactSearchResult(res.data);
            setLinkedContactDetails(res.data); // Also set linked details for the ui badge
            setFormAlegraContactId(res.data.id);
        } catch (error: any) {
            console.error('Error buscando contacto:', error);
            setContactSearchResult({ error: true, message: 'El documento no fue encontrado en Alegra. Por favor, crea el cliente directamente en el software contable primero y vuelve a intentarlo acá.' });
            setFormAlegraContactId(null);
        } finally {
            setIsSearchingContact(false);
        }
    };

    const validateAlegraProduct = async (e?: React.MouseEvent, forceRef?: string) => {
        if (e) e.preventDefault();
        const refToValidate = forceRef || formAlegraItemRef.trim();
        if (!refToValidate) return;

        try {
            setIsValidatingProduct(true);
            setValidatedProduct(null);
            const res = await api.get(`/alegra/items/reference/${refToValidate}`);
            setValidatedProduct({ success: true, ...res.data });
        } catch (error: any) {
            console.error('Error validando producto:', error);
            setValidatedProduct({ error: true, message: 'Producto no encontrado con esa referencia.' });
        } finally {
            setIsValidatingProduct(false);
        }
    };

    const handleEventTypeChange = (etId: string) => {
        setFormEventTypeId(etId);
        setFormScheduleId(''); // reset schedule when class changes
    };

    const handleSave = async () => {
        if (!editingStudent) return;
        try {
            setSaving(true);
            // Almacenar como "eventTypeId|scheduleId" para poder resolver ambos
            const groupSchedule = formEventTypeId
                ? (formScheduleId ? `${formEventTypeId}|${formScheduleId}` : formEventTypeId)
                : null;

            const res = await api.patch(`/students/${editingStudent.id}`, {
                level: formLevel || null,
                group_schedule: groupSchedule,
                requires_invoice: formRequiresInvoice,
                alegra_contact_id: formAlegraContactId,
                alegra_item_reference: formAlegraItemRef || null
            });
            setStudents(students.map(s => s.id === editingStudent.id ? res.data : s));

            // Auto-sincronizar si se asignó un horario completo (eventTypeId|scheduleId)
            if (formEventTypeId && formScheduleId) {
                try {
                    const syncRes = await api.post(`/students/${editingStudent.id}/sync-schedule`);
                    alert(`✅ Clase asignada y sincronizada.\nReservas creadas: ${syncRes.data.created}\nOmitidas (ya existían): ${syncRes.data.skipped}`);
                } catch (syncErr) {
                    console.error('Error al sincronizar:', syncErr);
                    alert('⚠️ La clase se asignó pero hubo un error al crear las reservas automáticas.');
                }
            }

            closeModal();
        } catch (error) {
            console.error("Error updating student", error);
            alert("Error al guardar cambios.");
        } finally {
            setSaving(false);
        }
    };

    // Sincronización manual (botón en la tabla)
    const handleSync = async (studentId: string, studentName: string) => {
        if (!confirm(`¿Sincronizar las reservas del mes actual para ${studentName}?`)) return;
        try {
            setSyncing(studentId);
            const res = await api.post(`/students/${studentId}/sync-schedule`);
            alert(`✅ Sincronización completada para ${studentName}.\nReservas creadas: ${res.data.created}\nOmitidas (ya existían): ${res.data.skipped}${res.data.errors?.length ? '\nErrores: ' + res.data.errors.join(', ') : ''}`);
        } catch (err: any) {
            console.error('Error sync:', err);
            alert(`❌ Error al sincronizar: ${err?.response?.data?.error || err.message}`);
        } finally {
            setSyncing(null);
        }
    };

    // Crear alumno desde modal
    const handleCreateStudent = async () => {
        if (!newStudentForm.full_name.trim() || !newStudentForm.whatsapp.trim()) {
            alert('Nombre y WhatsApp son obligatorios.');
            return;
        }
        setCreatingStudent(true);
        try {
            const res = await api.post('/students', {
                full_name: newStudentForm.full_name.trim(),
                whatsapp: newStudentForm.whatsapp.trim(),
                email: newStudentForm.email.trim() || undefined,
                level: newStudentForm.level.trim() || undefined,
                notes: newStudentForm.notes.trim() || undefined,
            });
            if (res.data) {
                setShowCreateStudentModal(false);
                setNewStudentForm({ full_name: '', whatsapp: '', email: '', level: '', notes: '' });
                fetchStudents();
            }
        } catch (err: any) {
            console.error(err);
            alert(`Error: ${err.response?.data?.error || err.message}`);
        } finally {
            setCreatingStudent(false);
        }
    };

    // Toggle activar/desactivar alumno
    const handleToggleStatus = async (student: any) => {
        const newStatus = student.status === 'activo' ? 'inactivo' : 'activo';
        const action = newStatus === 'activo' ? 'activar' : 'desactivar';
        if (!confirm(`¿Estás seguro de ${action} a ${student.contact?.full_name || 'este alumno'}?`)) return;
        setTogglingStatus(student.id);
        try {
            const res = await api.patch(`/students/${student.id}`, { status: newStatus });
            setStudents(students.map(s => s.id === student.id ? res.data : s));
        } catch (err: any) {
            console.error(err);
            alert(`Error al ${action}: ${err.response?.data?.error || err.message}`);
        } finally {
            setTogglingStatus(null);
        }
    };

    // Resolver etiqueta legible de clase + horario
    const resolveScheduleLabel = (groupSchedule: string | null) => {
        if (!groupSchedule) return null;
        const parts = groupSchedule.split('|');
        const etId = parts[0];
        const schedId = parts[1];

        const et = eventTypes.find(e => e.id === etId);
        if (!et) return groupSchedule; // fallback a texto plano

        const sched = schedId ? allSchedules.find(s => s.id === schedId) : null;
        if (sched) {
            return {
                className: et.title,
                schedule: `${DAY_NAMES[sched.dayOfWeek]} ${sched.startTime} - ${sched.endTime}`,
            };
        }
        return { className: et.title, schedule: null };
    };

    // Filtrar los schedules que pertenecen al EventType seleccionado
    const schedulesForSelectedClass = allSchedules.filter(s => s.eventTypeId === formEventTypeId);

    const filteredStudents = students.filter((s) => {
        const matchesSearch = s.contact?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
            s.contact?.whatsapp?.includes(search) ||
            s.contact?.email?.toLowerCase().includes(search.toLowerCase());
        const matchesStatus = statusFilter === 'all' || s.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    return (
        <div className="space-y-6 flex flex-col h-full">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Directorio de Alumnos</h1>
                    <p className="text-muted-foreground mt-1">
                        Consulta la lista de alumnos y asigna clases fijas con su horario.
                    </p>
                </div>
                <button
                    onClick={() => setShowCreateStudentModal(true)}
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-semibold shadow-sm hover:opacity-90 transition-opacity"
                >
                    <Plus className="w-4 h-4" /> Nuevo Alumno
                </button>
            </div>

            <div className="flex items-center gap-4 bg-card p-4 rounded-xl shadow-sm border border-border">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder="Buscar por nombre, WhatsApp o email..."
                        className="w-full pl-9 pr-4 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                <div className="flex bg-muted p-1 rounded-lg">
                    {['all', 'activo', 'inactivo'].map(status => (
                        <button
                            key={status}
                            onClick={() => setStatusFilter(status)}
                            className={cn(
                                "px-3 py-1.5 text-xs font-medium rounded-md capitalize transition-colors",
                                statusFilter === status ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            {status === 'all' ? 'Todos' : status}
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex-1 bg-card rounded-xl border border-border shadow-sm overflow-hidden flex flex-col">
                <div className="overflow-x-auto flex-1">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-muted/50 text-muted-foreground border-b border-border text-xs uppercase font-semibold">
                            <tr>
                                <th className="px-6 py-4">Estudiante</th>
                                <th className="px-6 py-4">Contacto</th>
                                <th className="px-6 py-4">Nivel</th>
                                <th className="px-6 py-4">Clase / Horario Fijo</th>
                                <th className="px-6 py-4">Ingreso</th>
                                <th className="px-6 py-4">Estado</th>
                                <th className="px-6 py-4 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {loading ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-12 text-center text-muted-foreground">
                                        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                                        Cargando estudiantes...
                                    </td>
                                </tr>
                            ) : filteredStudents.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-12 text-center text-muted-foreground font-medium">
                                        No se encontraron estudiantes.
                                    </td>
                                </tr>
                            ) : (
                                filteredStudents.map((student) => {
                                    const resolved = resolveScheduleLabel(student.group_schedule);
                                    return (
                                        <tr key={student.id} className="hover:bg-muted/30 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="font-semibold">{student.contact?.full_name || 'Desconocido'}</div>
                                                {(student.contact?.city || student.contact?.country) && (
                                                    <div className="text-xs text-muted-foreground mt-0.5 flex items-center">
                                                        <MapPin className="w-3 h-3 mr-1 inline" />
                                                        {[student.contact?.city, student.contact?.country].filter(Boolean).join(', ')}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="font-medium text-foreground">{student.contact?.whatsapp || '-'}</div>
                                                <div className="text-xs text-muted-foreground">{student.contact?.email || '-'}</div>
                                            </td>
                                            <td className="px-6 py-4">
                                                {student.level ? (
                                                    <span className="px-2.5 py-1 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-xs rounded-full font-medium">
                                                        {student.level}
                                                    </span>
                                                ) : <span className="text-muted-foreground text-xs">Sin asignar</span>}
                                            </td>
                                            <td className="px-6 py-4">
                                                {resolved && typeof resolved === 'object' ? (
                                                    <div>
                                                        <div className="text-sm font-medium">{resolved.className}</div>
                                                        {resolved.schedule && (
                                                            <div className="text-xs text-muted-foreground mt-0.5">{resolved.schedule}</div>
                                                        )}
                                                    </div>
                                                ) : resolved ? (
                                                    <div className="text-sm">{resolved}</div>
                                                ) : (
                                                    <span className="text-muted-foreground text-xs">Sin asignar</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm">{format(new Date(student.created_at), "d MMM yyyy", { locale: es })}</div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={cn(
                                                    "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider inline-block",
                                                    student.status === 'activo' ? "bg-green-500/10 text-green-600 dark:text-green-400" :
                                                        "bg-red-500/10 text-red-600 dark:text-red-400"
                                                )}>
                                                    {student.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button
                                                        onClick={() => openEditModal(student)}
                                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary hover:bg-primary/20 rounded-md transition-colors text-xs font-semibold"
                                                        title="Editar Clase / Nivel"
                                                    >
                                                        <Pencil className="w-3.5 h-3.5" /> Asignar
                                                    </button>
                                                    {student.group_schedule && student.group_schedule.includes('|') && (
                                                        <button
                                                            onClick={() => handleSync(student.id, student.contact?.full_name || 'Alumno')}
                                                            disabled={syncing === student.id}
                                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 rounded-md transition-colors text-xs font-semibold disabled:opacity-50"
                                                            title="Sincronizar reservas del mes en el Agendador"
                                                        >
                                                            {syncing === student.id ? (
                                                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                            ) : (
                                                                <CalendarCheck className="w-3.5 h-3.5" />
                                                            )}
                                                            Sync
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => handleToggleStatus(student)}
                                                        disabled={togglingStatus === student.id}
                                                        className={cn(
                                                            "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors text-xs font-semibold disabled:opacity-50",
                                                            student.status === 'activo'
                                                                ? "bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20"
                                                                : "bg-green-500/10 text-green-600 dark:text-green-400 hover:bg-green-500/20"
                                                        )}
                                                        title={student.status === 'activo' ? 'Desactivar alumno' : 'Reactivar alumno'}
                                                    >
                                                        {togglingStatus === student.id ? (
                                                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                        ) : student.status === 'activo' ? (
                                                            <UserX className="w-3.5 h-3.5" />
                                                        ) : (
                                                            <UserCheck className="w-3.5 h-3.5" />
                                                        )}
                                                        {student.status === 'activo' ? 'Desactivar' : 'Activar'}
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ─── Modal de Asignación de Clase Fija + Horario ─── */}
            {editingStudent && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={closeModal}>
                    <div
                        className="bg-card rounded-2xl shadow-2xl border border-border w-full max-w-md max-h-[90vh] flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between p-6 border-b border-border shrink-0">
                            <div>
                                <h2 className="text-lg font-bold">Asignar Clase y Horario</h2>
                                <p className="text-sm text-muted-foreground mt-0.5">
                                    {editingStudent.contact?.full_name}
                                </p>
                            </div>
                            <button onClick={closeModal} className="p-1 rounded-lg hover:bg-muted transition-colors">
                                <X className="w-5 h-5 text-muted-foreground" />
                            </button>
                        </div>

                        <div className="overflow-y-auto flex-1">
                            <div className="p-6 space-y-5">
                                {/* Nivel */}
                                <div>
                                    <label className="block text-sm font-medium mb-2">Nivel del Alumno</label>
                                    <select
                                        value={formLevel}
                                        onChange={(e) => setFormLevel(e.target.value)}
                                        className="w-full px-3 py-2.5 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                                    >
                                        <option value="">Sin asignar</option>
                                        <option value="principiante">Principiante</option>
                                        <option value="intermedio">Intermedio</option>
                                        <option value="avanzado">Avanzado</option>
                                    </select>
                                </div>

                                {/* Clase (EventType) */}
                                <div>
                                    <label className="block text-sm font-medium mb-2">Tipo de Clase</label>
                                    <select
                                        value={formEventTypeId}
                                        onChange={(e) => handleEventTypeChange(e.target.value)}
                                        className="w-full px-3 py-2.5 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                                    >
                                        <option value="">Sin asignar</option>
                                        {eventTypes.map((et) => (
                                            <option key={et.id} value={et.id}>
                                                {et.title} (Cupo: {et.maxCapacity})
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* Horario (EventTypeSchedule) — solo visible si se seleccionó una clase */}
                                {formEventTypeId && (
                                    <div>
                                        <label className="block text-sm font-medium mb-2">Horario Fijo</label>
                                        {schedulesForSelectedClass.length === 0 ? (
                                            <p className="text-xs text-muted-foreground italic">
                                                Esta clase no tiene horarios configurados en el Agendador.
                                            </p>
                                        ) : (
                                            <select
                                                value={formScheduleId}
                                                onChange={(e) => setFormScheduleId(e.target.value)}
                                                className="w-full px-3 py-2.5 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                                            >
                                                <option value="">Seleccionar horario...</option>
                                                {schedulesForSelectedClass.map((sched) => (
                                                    <option key={sched.id} value={sched.id}>
                                                        {DAY_NAMES[sched.dayOfWeek]} — {sched.startTime} a {sched.endTime}
                                                    </option>
                                                ))}
                                            </select>
                                        )}
                                        <p className="text-xs text-muted-foreground mt-1.5">
                                            El alumno quedará inscrito en este día y hora de forma fija cada semana.
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* ─── Datos de Facturación ─── */}
                            <div className="px-6 py-4 bg-muted/30 border-t border-border space-y-4">
                                <h3 className="text-sm font-semibold flex items-center gap-2">
                                    <span className="bg-primary/10 text-primary p-1 rounded-md">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></svg>
                                    </span>
                                    Datos de Facturación (Alegra)
                                </h3>

                                <div>
                                    <label className="block text-sm font-medium mb-1.5 flex items-center gap-1.5">
                                        Código de Producto (Alegra)
                                    </label>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={formAlegraItemRef}
                                            onChange={(e) => {
                                                setFormAlegraItemRef(e.target.value.toUpperCase());
                                                setValidatedProduct(null);
                                            }}
                                            placeholder="Ej: JWTA, JWPRIN..."
                                            className="flex-1 px-3 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 uppercase"
                                        />
                                        <button
                                            onClick={(e) => validateAlegraProduct(e)}
                                            disabled={isValidatingProduct || !formAlegraItemRef.trim()}
                                            className="px-3 py-2 bg-primary/10 text-primary hover:bg-primary/20 rounded-md font-semibold text-sm transition-colors disabled:opacity-50 flex items-center gap-1.5 whitespace-nowrap"
                                        >
                                            {isValidatingProduct ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                                            Validar
                                        </button>
                                    </div>
                                    {validatedProduct && (
                                        <div className={cn(
                                            "mt-2 p-2.5 rounded-md text-[11px]",
                                            validatedProduct.error
                                                ? "bg-red-500/10 text-red-600 border border-red-500/20 font-medium"
                                                : "bg-emerald-500/10 text-emerald-700 border border-emerald-500/20"
                                        )}>
                                            {validatedProduct.error
                                                ? validatedProduct.message
                                                : <>
                                                    <strong className="block mb-0.5">{validatedProduct.name}</strong>
                                                    <span className="opacity-80">Precio (Alegra): ${validatedProduct.price?.toLocaleString()}</span>
                                                </>}
                                        </div>
                                    )}
                                    <p className="text-[11px] text-muted-foreground mt-1.5">
                                        Este código define el valor y servicio que se le cobrará al alumno en la facturación.
                                    </p>
                                </div>

                                <label className="flex items-center gap-2 cursor-pointer mt-4">
                                    <input
                                        type="checkbox"
                                        checked={formRequiresInvoice}
                                        onChange={(e) => {
                                            setFormRequiresInvoice(e.target.checked);
                                            if (!e.target.checked) setFormAlegraContactId(null);
                                        }}
                                        className="w-4 h-4 rounded border-input text-primary focus:ring-primary/50"
                                    />
                                    <span className="text-sm font-medium">¿Requiere Factura Electrónica a su nombre?</span>
                                </label>

                                {!formRequiresInvoice && (
                                    <p className="text-xs text-muted-foreground bg-muted/50 p-2.5 rounded-lg border border-border/50">
                                        Al renovar o agendar, se facturará automáticamente al "Cliente Externo / Consumidor Final" mapeado en la configuración base.
                                    </p>
                                )}

                                {formRequiresInvoice && (
                                    <div className="space-y-3 bg-background p-3.5 rounded-xl border border-border shadow-sm">
                                        {formAlegraContactId ? (
                                            <div className="flex items-start justify-between p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-md">
                                                <div>
                                                    <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 mb-0.5">✅ Cliente Vinculado</p>
                                                    <p className="text-[11px] text-emerald-600/80 dark:text-emerald-500/80 font-medium mb-1.5">ID Alegra: {formAlegraContactId}</p>

                                                    {isLoadingLinkedContact ? (
                                                        <div className="text-[11px] text-emerald-700 mt-1 flex items-center gap-1.5 font-medium">
                                                            <Loader2 className="w-3 h-3 animate-spin" /> Cargando datos de Alegra...
                                                        </div>
                                                    ) : linkedContactDetails && !linkedContactDetails.error ? (
                                                        <div className="text-[11px] text-emerald-700/90 pt-1.5 mt-1.5 border-t border-emerald-500/20">
                                                            <strong className="block mb-0.5">{linkedContactDetails.name}</strong>
                                                            NIT/Cédula: {linkedContactDetails.identification}
                                                        </div>
                                                    ) : null}
                                                </div>
                                                <button
                                                    onClick={(e) => { e.preventDefault(); setFormAlegraContactId(null); setContactSearchQuery(''); }}
                                                    className="text-xs text-emerald-700 hover:text-emerald-800 underline font-medium pt-0.5"
                                                >
                                                    Cambiar
                                                </button>
                                            </div>
                                        ) : (
                                            <>
                                                <div className="flex gap-2">
                                                    <input
                                                        type="text"
                                                        value={contactSearchQuery}
                                                        onChange={e => setContactSearchQuery(e.target.value)}
                                                        placeholder="Ingrese NIT o Cédula..."
                                                        className="flex-1 px-3 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                                                    />
                                                    <button
                                                        onClick={searchAlegraContact}
                                                        disabled={isSearchingContact || !contactSearchQuery.trim()}
                                                        className="px-3 py-2 bg-primary/10 text-primary hover:bg-primary/20 rounded-md font-semibold text-sm transition-colors disabled:opacity-50 flex items-center gap-1.5"
                                                    >
                                                        {isSearchingContact ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                                                        Buscar
                                                    </button>
                                                </div>

                                                {contactSearchResult && (
                                                    <div className={cn(
                                                        "p-3 rounded-md text-xs",
                                                        contactSearchResult.error
                                                            ? "bg-red-500/10 text-red-600 border border-red-500/20 font-medium"
                                                            : "bg-emerald-500/10 text-emerald-700 border border-emerald-500/20"
                                                    )}>
                                                        {contactSearchResult.error
                                                            ? contactSearchResult.message
                                                            : <div className="space-y-1">
                                                                <div><strong>Encontrado:</strong> {contactSearchResult.name}</div>
                                                                <div className="text-emerald-600 dark:text-emerald-500">
                                                                    NIT/Cédula: {contactSearchResult.identification}
                                                                </div>
                                                                {(contactSearchResult.email || contactSearchResult.phone) && (
                                                                    <div className="pt-1 mt-1 border-t border-emerald-500/20 text-[11px] opacity-80 space-y-0.5">
                                                                        {contactSearchResult.email && <div>✉️ {contactSearchResult.email}</div>}
                                                                        {contactSearchResult.phone && <div>📞 {contactSearchResult.phone}</div>}
                                                                    </div>
                                                                )}
                                                            </div>}
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-3 p-5 border-t border-border shrink-0 bg-card rounded-b-2xl">
                            <button
                                onClick={closeModal}
                                className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="inline-flex items-center gap-2 px-5 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
                            >
                                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                Guardar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ─── Modal de Crear Nuevo Alumno ─── */}
            {showCreateStudentModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                    <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg mx-4 flex flex-col">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                            <h2 className="text-lg font-bold">Nuevo Alumno</h2>
                            <button onClick={() => setShowCreateStudentModal(false)} className="p-1 rounded-lg hover:bg-muted transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="px-6 py-5 space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-muted-foreground mb-1">Nombre Completo *</label>
                                <input
                                    type="text"
                                    className="w-full px-3 py-2 bg-background border border-input rounded-lg text-sm focus:ring-2 focus:ring-primary/50 focus:outline-none"
                                    value={newStudentForm.full_name}
                                    onChange={e => setNewStudentForm(p => ({ ...p, full_name: e.target.value }))}
                                    placeholder="Ej: María López"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-muted-foreground mb-1">WhatsApp *</label>
                                    <input
                                        type="text"
                                        className="w-full px-3 py-2 bg-background border border-input rounded-lg text-sm focus:ring-2 focus:ring-primary/50 focus:outline-none"
                                        value={newStudentForm.whatsapp}
                                        onChange={e => setNewStudentForm(p => ({ ...p, whatsapp: e.target.value }))}
                                        placeholder="+506 8888-8888"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-muted-foreground mb-1">Email</label>
                                    <input
                                        type="email"
                                        className="w-full px-3 py-2 bg-background border border-input rounded-lg text-sm focus:ring-2 focus:ring-primary/50 focus:outline-none"
                                        value={newStudentForm.email}
                                        onChange={e => setNewStudentForm(p => ({ ...p, email: e.target.value }))}
                                        placeholder="correo@ejemplo.com"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-muted-foreground mb-1">Nivel</label>
                                <select
                                    className="w-full px-3 py-2 bg-background border border-input rounded-lg text-sm focus:ring-2 focus:ring-primary/50 focus:outline-none"
                                    value={newStudentForm.level}
                                    onChange={e => setNewStudentForm(p => ({ ...p, level: e.target.value }))}
                                >
                                    <option value="">Sin asignar</option>
                                    <option value="principiante">Principiante</option>
                                    <option value="intermedio">Intermedio</option>
                                    <option value="avanzado">Avanzado</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-muted-foreground mb-1">Notas</label>
                                <textarea
                                    className="w-full px-3 py-2 bg-background border border-input rounded-lg text-sm focus:ring-2 focus:ring-primary/50 focus:outline-none resize-none"
                                    rows={2}
                                    value={newStudentForm.notes}
                                    onChange={e => setNewStudentForm(p => ({ ...p, notes: e.target.value }))}
                                    placeholder="Observaciones del alumno..."
                                />
                            </div>
                        </div>
                        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border">
                            <button onClick={() => setShowCreateStudentModal(false)} className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                                Cancelar
                            </button>
                            <button
                                onClick={handleCreateStudent}
                                disabled={creatingStudent}
                                className="inline-flex items-center gap-2 px-5 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold shadow-sm hover:opacity-90 transition-opacity disabled:opacity-50"
                            >
                                {creatingStudent ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                Crear Alumno
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
