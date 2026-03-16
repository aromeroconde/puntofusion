import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { CheckCircle2, XCircle, Search, Loader2, FileText, CalendarDays, Plus, X, Save } from 'lucide-react';
import { cn } from '../lib/utils';

export default function Requests() {
    const [requests, setRequests] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');

    // Modal de crear
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [createForm, setCreateForm] = useState({ full_name: '', whatsapp: '', email: '', objective: '', internal_tag: '' });
    const [creating, setCreating] = useState(false);

    useEffect(() => {
        fetchRequests();
    }, [statusFilter]);

    const fetchRequests = async () => {
        try {
            setLoading(true);
            const statusQuery = statusFilter !== 'all' ? `?status=${statusFilter}` : '';
            const res = await api.get(`/requests${statusQuery}`);
            if (res.data) {
                setRequests(res.data);
            }
        } catch (error) {
            console.error("Error fetching requests", error);
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateStatus = async (id: number, status: string) => {
        try {
            await api.patch(`/requests/${id}/status`, { status });
            setRequests(requests.map(r => r.id === id ? { ...r, status } : r));
        } catch (error) {
            console.error("Error updating request status", error);
            alert("Error al actualizar la solicitud.");
        }
    };

    const handleCreate = async () => {
        if (!createForm.full_name.trim() || !createForm.whatsapp.trim()) {
            alert('Nombre y WhatsApp son obligatorios.');
            return;
        }
        setCreating(true);
        try {
            const res = await api.post('/requests', {
                full_name: createForm.full_name.trim(),
                whatsapp: createForm.whatsapp.trim(),
                email: createForm.email.trim() || undefined,
                objective: createForm.objective.trim() || undefined,
                internal_tag: createForm.internal_tag.trim() || undefined,
            });
            if (res.data) {
                setShowCreateModal(false);
                setCreateForm({ full_name: '', whatsapp: '', email: '', objective: '', internal_tag: '' });
                fetchRequests();
            }
        } catch (err: any) {
            console.error(err);
            alert(`Error: ${err.response?.data?.error || err.message}`);
        } finally {
            setCreating(false);
        }
    };

    const filteredRequests = requests.filter((r) =>
        r.contact?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
        r.contact?.whatsapp?.includes(search) ||
        r.internal_tag?.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="space-y-6 flex flex-col h-full">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Solicitudes de Alumnos</h1>
                    <p className="text-muted-foreground mt-1">
                        Gestiona las solicitudes de clases e información de prospectos.
                    </p>
                </div>
                <button
                    onClick={() => setShowCreateModal(true)}
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-semibold shadow-sm hover:opacity-90 transition-opacity"
                >
                    <Plus className="w-4 h-4" /> Nueva Solicitud
                </button>
            </div>

            <div className="flex items-center gap-4 bg-card p-4 rounded-xl shadow-sm border border-border">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder="Buscar por nombre, teléfono o etiqueta..."
                        className="w-full pl-9 pr-4 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                <div className="flex bg-muted p-1 rounded-lg">
                    {['all', 'pendiente', 'aprobado', 'rechazado', 'cerrado'].map(status => (
                        <button
                            key={status}
                            onClick={() => setStatusFilter(status)}
                            className={cn(
                                "px-3 py-1.5 text-xs font-medium rounded-md capitalize transition-colors",
                                statusFilter === status ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            {status === 'all' ? 'Todas' : status}
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex-1 bg-card rounded-xl border border-border shadow-sm overflow-hidden flex flex-col">
                <div className="overflow-x-auto flex-1">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-muted/50 text-muted-foreground border-b border-border text-xs uppercase font-semibold">
                            <tr>
                                <th className="px-6 py-4">Fecha ID</th>
                                <th className="px-6 py-4">Contacto</th>
                                <th className="px-6 py-4">Detalles / Servicio</th>
                                <th className="px-6 py-4">Etiqueta Interna</th>
                                <th className="px-6 py-4">Estado</th>
                                <th className="px-6 py-4 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                                        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                                        Cargando solicitudes...
                                    </td>
                                </tr>
                            ) : filteredRequests.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground font-medium">
                                        No se encontraron solicitudes.
                                    </td>
                                </tr>
                            ) : (
                                filteredRequests.map((request) => (
                                    <tr key={request.id} className="hover:bg-muted/30 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="font-semibold">{format(new Date(request.created_at), "d MMM yyyy", { locale: es })}</div>
                                            <div className="text-xs text-muted-foreground">{format(new Date(request.created_at), "HH:mm", { locale: es })}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="font-medium">{request.contact?.full_name || 'Sin Nombre'}</div>
                                            <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                                {request.contact?.whatsapp}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col gap-1 max-w-xs">
                                                {request.service?.name && (
                                                    <span className="inline-flex items-center gap-1 text-xs font-medium bg-primary/10 text-primary px-2 py-0.5 rounded-full w-fit">
                                                        {request.service.name}
                                                    </span>
                                                )}
                                                {request.objective && (
                                                    <div className="text-xs text-foreground line-clamp-2" title={request.objective}>
                                                        <FileText className="inline w-3 h-3 mr-1 text-muted-foreground" />
                                                        {request.objective}
                                                    </div>
                                                )}
                                                {request.desired_datetime && (
                                                    <div className="text-xs text-muted-foreground">
                                                        <CalendarDays className="inline w-3 h-3 mr-1" />
                                                        {new Date(request.desired_datetime).toLocaleString('es-CR')}
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            {request.internal_tag ? (
                                                <span className="px-2 py-1 bg-secondary text-secondary-foreground text-xs rounded-md font-mono">
                                                    {request.internal_tag}
                                                </span>
                                            ) : (
                                                <span className="text-muted-foreground text-xs">-</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={cn(
                                                "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                                                request.status === 'aprobado' ? "bg-green-500/10 text-green-600 dark:text-green-400" :
                                                    request.status === 'rechazado' ? "bg-red-500/10 text-red-600 dark:text-red-400" :
                                                        request.status === 'cerrado' ? "bg-muted text-muted-foreground" :
                                                            "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                                            )}>
                                                {request.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right whitespace-nowrap">
                                            {request.status === 'pendiente' && (
                                                <div className="flex items-center justify-end gap-2">
                                                    <button
                                                        onClick={() => handleUpdateStatus(request.id, 'aprobado')}
                                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/10 text-green-600 hover:bg-green-500/20 rounded-md transition-colors text-xs font-semibold"
                                                        title="Aprobar Solicitud"
                                                    >
                                                        <CheckCircle2 className="w-4 h-4" /> Aprobar
                                                    </button>
                                                    <button
                                                        onClick={() => handleUpdateStatus(request.id, 'rechazado')}
                                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 text-red-600 hover:bg-red-500/20 rounded-md transition-colors text-xs font-semibold"
                                                        title="Rechazar Solicitud"
                                                    >
                                                        <XCircle className="w-4 h-4" /> Rechazar
                                                    </button>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal de Crear Solicitud */}
            {showCreateModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                    <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg mx-4 flex flex-col">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                            <h2 className="text-lg font-bold">Nueva Solicitud</h2>
                            <button onClick={() => setShowCreateModal(false)} className="p-1 rounded-lg hover:bg-muted transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="px-6 py-5 space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-muted-foreground mb-1">Nombre Completo *</label>
                                <input
                                    type="text"
                                    className="w-full px-3 py-2 bg-background border border-input rounded-lg text-sm focus:ring-2 focus:ring-primary/50 focus:outline-none"
                                    value={createForm.full_name}
                                    onChange={e => setCreateForm(p => ({ ...p, full_name: e.target.value }))}
                                    placeholder="Ej: María López"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-muted-foreground mb-1">WhatsApp *</label>
                                    <input
                                        type="text"
                                        className="w-full px-3 py-2 bg-background border border-input rounded-lg text-sm focus:ring-2 focus:ring-primary/50 focus:outline-none"
                                        value={createForm.whatsapp}
                                        onChange={e => setCreateForm(p => ({ ...p, whatsapp: e.target.value }))}
                                        placeholder="+506 8888-8888"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-muted-foreground mb-1">Email</label>
                                    <input
                                        type="email"
                                        className="w-full px-3 py-2 bg-background border border-input rounded-lg text-sm focus:ring-2 focus:ring-primary/50 focus:outline-none"
                                        value={createForm.email}
                                        onChange={e => setCreateForm(p => ({ ...p, email: e.target.value }))}
                                        placeholder="correo@ejemplo.com"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-muted-foreground mb-1">Objetivo / Motivo</label>
                                <textarea
                                    className="w-full px-3 py-2 bg-background border border-input rounded-lg text-sm focus:ring-2 focus:ring-primary/50 focus:outline-none resize-none"
                                    rows={3}
                                    value={createForm.objective}
                                    onChange={e => setCreateForm(p => ({ ...p, objective: e.target.value }))}
                                    placeholder="¿Qué busca el prospecto? (clase de prueba, información, etc.)"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-muted-foreground mb-1">Etiqueta Interna</label>
                                <input
                                    type="text"
                                    className="w-full px-3 py-2 bg-background border border-input rounded-lg text-sm focus:ring-2 focus:ring-primary/50 focus:outline-none"
                                    value={createForm.internal_tag}
                                    onChange={e => setCreateForm(p => ({ ...p, internal_tag: e.target.value }))}
                                    placeholder="Ej: llamada, presencial, ig"
                                />
                            </div>
                        </div>
                        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border">
                            <button onClick={() => setShowCreateModal(false)} className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                                Cancelar
                            </button>
                            <button
                                onClick={handleCreate}
                                disabled={creating}
                                className="inline-flex items-center gap-2 px-5 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold shadow-sm hover:opacity-90 transition-opacity disabled:opacity-50"
                            >
                                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                Guardar Solicitud
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
