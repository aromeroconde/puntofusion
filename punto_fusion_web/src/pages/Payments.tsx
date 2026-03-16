import React, { useState, useEffect } from 'react';
import { CreditCard, Search, Loader2, CheckCircle2, AlertCircle, X, PlusCircle } from 'lucide-react';
import ManualPaymentModal from '../components/ManualPaymentModal';

interface PendingInvoice {
    id: string;
    type: 'estimate' | 'invoice';
    number: string;
    date: string;
    dueDate: string;
    clientId: string;
    clientName: string;
    studentName: string;
    studentId: string;
    total: number;
    balance: number;
    status: string;
}

export default function Payments() {
    const [invoices, setInvoices] = useState<PendingInvoice[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [confirmInvoice, setConfirmInvoice] = useState<PendingInvoice | null>(null);
    const [paymentAmount, setPaymentAmount] = useState<number | ''>('');
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [isManualModalOpen, setIsManualModalOpen] = useState(false);
    const fetchPendingInvoices = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3100';
            const response = await fetch(`${apiUrl}/api/alegra/invoices/pending`);
            if (!response.ok) {
                throw new Error('Error al cargar facturas pendientes');
            }
            const data = await response.json();
            setInvoices(data);
        } catch (err: any) {
            console.error(err);
            setError(err.message || 'Error de conexión');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchPendingInvoices();
    }, []);

    const handlePayInvoice = async () => {
        if (!confirmInvoice) return;

        const invoiceId = confirmInvoice.id;
        setProcessingId(invoiceId);
        setErrorMessage(null);

        try {
            const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3100';
            const response = await fetch(`${apiUrl}/api/alegra/invoices/${invoiceId}/pay`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    type: confirmInvoice.type,
                    amount: paymentAmount || confirmInvoice.balance
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Error al procesar el pago');
            }

            // Recargar facturas por si el abono fue parcial y aún hay saldo pendiente
            await fetchPendingInvoices();
            setSuccessMessage(`Pago para la factura #${confirmInvoice.number} registrado exitosamente en Alegra`);
            setConfirmInvoice(null);

            // Ocultar el mensaje de éxito después de 4 segundos
            setTimeout(() => setSuccessMessage(null), 4000);

        } catch (err: any) {
            console.error(err);
            setErrorMessage(err.message || 'Error al procesar el pago');
        } finally {
            setProcessingId(null);
        }
    };

    const filteredInvoices = invoices.filter(inv =>
        inv.studentName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        inv.clientName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        inv.number?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Pagos Pendientes</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Gestiona y registra el pago de facturas pendientes en Alegra.
                    </p>
                </div>
                <button
                    onClick={fetchPendingInvoices}
                    className="inline-flex items-center px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
                >
                    {isLoading ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                        <Search className="w-4 h-4 mr-2" />
                    )}
                    Actualizar Lista
                </button>
                <button
                    onClick={() => setIsManualModalOpen(true)}
                    className="inline-flex items-center px-4 py-2 bg-indigo-600 border border-transparent rounded-lg text-sm font-medium text-white hover:bg-indigo-700 transition-all shadow-sm"
                >
                    <PlusCircle className="w-4 h-4 mr-2" />
                    Nuevo Cobro
                </button>
            </div>

            {/* Buscador y Filtros */}
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                        type="text"
                        className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        placeholder="Buscar por alumno, cliente o número de factura..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {/* Tabla de Pagos */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                    Factura
                                </th>
                                <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                    Alumno / Cliente
                                </th>
                                <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                    Fechas
                                </th>
                                <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                    Monto Pendiente
                                </th>
                                <th scope="col" className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                    Acciones
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {isLoading && invoices.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                                        <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-indigo-500" />
                                        Cargando facturas pendientes...
                                    </td>
                                </tr>
                            ) : error ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-8 text-center text-red-500 bg-red-50">
                                        {error}
                                    </td>
                                </tr>
                            ) : filteredInvoices.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center">
                                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 mb-4">
                                            <CheckCircle2 className="w-8 h-8 text-green-500" />
                                        </div>
                                        <h3 className="text-lg font-medium text-gray-900 mb-1">Todo al día</h3>
                                        <p className="text-gray-500 max-w-sm mx-auto">
                                            No se encontraron facturas pendientes de pago para alumnos activos en Alegra.
                                        </p>
                                    </td>
                                </tr>
                            ) : (
                                filteredInvoices.map((invoice) => (
                                    <tr key={invoice.id} className="hover:bg-gray-50/50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center">
                                                <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center border border-indigo-100">
                                                    <CreditCard className="w-5 h-5 text-indigo-600" />
                                                </div>
                                                <div className="ml-4">
                                                    <div className="text-sm font-medium text-gray-900">
                                                        #{invoice.number}
                                                    </div>
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800 mt-1">
                                                        Pendiente
                                                    </span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-sm font-medium text-gray-900">{invoice.studentName}</div>
                                            {invoice.clientName !== invoice.studentName && (
                                                <div className="text-xs text-gray-500 mt-0.5">Cliente: {invoice.clientName}</div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm text-gray-900">
                                                <span className="text-gray-500 mr-2">Emisión:</span>
                                                {invoice.date}
                                            </div>
                                            <div className="text-sm text-gray-900 mt-1">
                                                <span className="text-gray-500 mr-2">Vence:</span>
                                                <span className={new Date(invoice.dueDate) < new Date() ? 'text-red-600 font-medium' : ''}>
                                                    {invoice.dueDate}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm font-bold text-gray-900">
                                                {new Intl.NumberFormat('es-CR', {
                                                    style: 'currency',
                                                    currency: 'CRC',
                                                    maximumFractionDigits: 0
                                                }).format(invoice.balance)}
                                            </div>
                                            <div className="text-xs text-gray-500 mt-1">
                                                Total fac: {new Intl.NumberFormat('es-CR', {
                                                    style: 'currency',
                                                    currency: 'CRC',
                                                    maximumFractionDigits: 0
                                                }).format(invoice.total)}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <button
                                                onClick={() => { setErrorMessage(null); setConfirmInvoice(invoice); setPaymentAmount(invoice.balance); }}
                                                disabled={processingId === invoice.id}
                                                className={`inline-flex items-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white 
                          ${processingId === invoice.id
                                                        ? 'bg-indigo-400 cursor-not-allowed'
                                                        : 'bg-indigo-600 hover:bg-indigo-700 hover:-translate-y-0.5 transition-all'
                                                    }`}
                                            >
                                                {processingId === invoice.id ? (
                                                    <>
                                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                        Procesando...
                                                    </>
                                                ) : (
                                                    <>
                                                        <CheckCircle2 className="w-4 h-4 mr-2" />
                                                        Registrar Pago
                                                    </>
                                                )}
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal de Confirmación */}
            {confirmInvoice && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-xl max-w-md w-full overflow-hidden">
                        <div className="p-6">
                            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-indigo-100 mb-4 mx-auto">
                                <CreditCard className="w-6 h-6 text-indigo-600" />
                            </div>
                            <h3 className="text-lg font-bold text-center text-gray-900 mb-2">Confirmar Registro de Pago</h3>
                            <p className="text-center text-gray-500 text-sm mb-4">
                                Ingresa el monto a pagar para la factura <span className="font-semibold text-gray-700">#{confirmInvoice.number}</span> del alumno <span className="font-semibold text-gray-700">{confirmInvoice.studentName}</span>.
                            </p>

                            <div className="mb-6">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Monto a pagar (CRC)</label>
                                <div className="relative rounded-md shadow-sm">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <span className="text-gray-500 sm:text-sm">$</span>
                                    </div>
                                    <input
                                        type="number"
                                        min="1"
                                        max={confirmInvoice.balance}
                                        value={paymentAmount}
                                        onChange={(e) => setPaymentAmount(e.target.value === '' ? '' : Number(e.target.value))}
                                        className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-7 pr-12 sm:text-sm border-gray-300 rounded-md py-2"
                                        placeholder="0.00"
                                    />
                                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                                        <span className="text-gray-500 sm:text-sm">CRC</span>
                                    </div>
                                </div>
                                {confirmInvoice.type === 'estimate' && (
                                    <p className="text-xs text-yellow-600 mt-2 flex items-start">
                                        <AlertCircle className="w-4 h-4 mr-1 flex-shrink-0 mt-0.5" />
                                        <span>Esta es una factura preventiva. Los pagos parciales registran la deuda como pagada en su totalidad en Alegra.</span>
                                    </p>
                                )}
                            </div>

                            {errorMessage && (
                                <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm flex items-start">
                                    <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" />
                                    <span>{errorMessage}</span>
                                </div>
                            )}

                            <div className="flex gap-3">
                                <button
                                    onClick={() => { setConfirmInvoice(null); setErrorMessage(null); }}
                                    disabled={processingId !== null}
                                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handlePayInvoice}
                                    disabled={processingId !== null}
                                    className="flex-1 inline-flex justify-center items-center px-4 py-2 border border-transparent rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                                >
                                    {processingId !== null ? (
                                        <>
                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                            Procesando...
                                        </>
                                    ) : (
                                        'Sí, Registrar Pago'
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Toast de Éxito */}
            {successMessage && (
                <div className="fixed bottom-4 right-4 z-50 bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg shadow-lg flex items-center animate-in slide-in-from-bottom-5">
                    <CheckCircle2 className="w-5 h-5 mr-3 text-green-500" />
                    <span className="text-sm font-medium">{successMessage}</span>
                    <button onClick={() => setSuccessMessage(null)} className="ml-4 text-green-500 hover:text-green-700 transition-colors">
                        <X className="w-4 h-4" />
                    </button>
                </div>
            )}

            {/* Modal de Cobro Manual */}
            <ManualPaymentModal
                isOpen={isManualModalOpen}
                onClose={() => setIsManualModalOpen(false)}
                onSuccess={() => {
                    setIsManualModalOpen(false);
                    fetchPendingInvoices();
                    setSuccessMessage('Cotización creada exitosamente');
                    setTimeout(() => setSuccessMessage(null), 4000);
                }}
            />
        </div>
    );
}
