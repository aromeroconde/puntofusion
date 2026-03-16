import React, { useState, useEffect } from 'react';
import { X, Search, Loader2, CreditCard, AlertCircle } from 'lucide-react';

interface Contact {
    id: string;
    full_name: string;
    whatsapp: string;
}

interface Student {
    id: string;
    contact_id: string;
    status: string;
    alegra_contact_id?: string;
    alegra_item_reference?: string;
    contact: Contact;
}

interface ManualPaymentModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (message: string) => void;
}

export default function ManualPaymentModal({ isOpen, onClose, onSuccess }: ManualPaymentModalProps) {
    const [students, setStudents] = useState<Student[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedStudentId, setSelectedStudentId] = useState<string>('');
    const [amount, setAmount] = useState<number | ''>('');
    const [description, setDescription] = useState('');
    const [reference, setReference] = useState('');
    const [isLoadingStudents, setIsLoadingStudents] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            fetchStudents();
        }
    }, [isOpen]);

    const fetchStudents = async () => {
        setIsLoadingStudents(true);
        setError(null);
        try {
            const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3100';
            const response = await fetch(`${apiUrl}/api/students`);
            if (!response.ok) throw new Error('Error al cargar alumnos');
            const data = await response.json();
            // Filtrar solo activos y con alegra_contact_id
            const activeStudents = data.filter((s: Student) => s.status === 'activo' && s.alegra_contact_id);
            setStudents(activeStudents);
        } catch (err: any) {
            console.error(err);
            setError('No se pudieron cargar los alumnos.');
        } finally {
            setIsLoadingStudents(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedStudentId || !amount) return;

        setIsProcessing(true);
        setError(null);

        try {
            const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3100';
            const response = await fetch(`${apiUrl}/api/alegra/estimates`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    studentId: selectedStudentId,
                    amount: Number(amount),
                    description: description || 'Pago manual de mensualidad/servicio',
                    reference: reference || undefined
                })
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Error al crear el cobro');
            }

            onSuccess('Cobro creado exitosamente en Alegra. Aparecerá en la lista en unos momentos.');
            handleClose();
        } catch (err: any) {
            console.error(err);
            setError(err.message || 'Error al procesar la solicitud');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleClose = () => {
        setSelectedStudentId('');
        setAmount('');
        setDescription('');
        setReference('');
        setError(null);
        onClose();
    };

    const filteredStudents = students.filter(s =>
        s.contact?.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-xl max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600">
                            <CreditCard className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-gray-900">Nuevo Cobro Manual</h3>
                            <p className="text-xs text-gray-500">Crea un cobro personalizado en Alegra</p>
                        </div>
                    </div>
                    <button 
                        onClick={handleClose}
                        className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-gray-600"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
                    {/* Alumno Selector */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Seleccionar Alumno</label>
                        <div className="relative mb-2">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Search className="w-4 h-4 text-gray-400" />
                            </div>
                            <input
                                type="text"
                                className="block w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                placeholder="Buscar alumno..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        
                        <div className="border border-gray-200 rounded-lg max-h-40 overflow-y-auto">
                            {isLoadingStudents ? (
                                <div className="p-4 text-center text-gray-500 text-sm">
                                    <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
                                    Cargando alumnos...
                                </div>
                            ) : filteredStudents.length === 0 ? (
                                <div className="p-4 text-center text-gray-500 text-sm">
                                    No se encontraron alumnos con perfil en Alegra.
                                </div>
                            ) : (
                                filteredStudents.map(student => (
                                    <button
                                        key={student.id}
                                        type="button"
                                        onClick={() => setSelectedStudentId(student.id)}
                                        className={`w-full text-left px-4 py-2.5 text-sm transition-colors border-b border-gray-50 last:border-0 flex items-center justify-between
                                            ${selectedStudentId === student.id ? 'bg-indigo-50 text-indigo-700 font-medium' : 'hover:bg-gray-50 text-gray-700'}
                                        `}
                                    >
                                        <span>{student.contact?.full_name}</span>
                                        {selectedStudentId === student.id && <div className="w-2 h-2 rounded-full bg-indigo-600" />}
                                    </button>
                                ))
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        {/* Monto */}
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">Monto (CRC)</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <span className="text-gray-400 sm:text-sm">₡</span>
                                </div>
                                <input
                                    type="number"
                                    required
                                    min="1"
                                    className="block w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                    placeholder="0"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
                                />
                            </div>
                        </div>

                        {/* Referencia */}
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">Referencia (Opcional)</label>
                            <input
                                type="text"
                                className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                placeholder="Ej: MAT-2024"
                                value={reference}
                                onChange={(e) => setReference(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Descripción */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Descripción (Opcional)</label>
                        <textarea
                            className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm min-h-[80px]"
                            placeholder="Detalle del cobro..."
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                        />
                    </div>

                    {error && (
                        <div className="p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm flex items-start gap-2 animate-in fade-in duration-200">
                            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}
                </form>

                {/* Footer */}
                <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex gap-3">
                    <button
                        type="button"
                        onClick={handleClose}
                        disabled={isProcessing}
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 transition-colors shadow-sm"
                    >
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        onClick={handleSubmit}
                        disabled={isProcessing || !selectedStudentId || !amount}
                        className="flex-1 inline-flex justify-center items-center px-4 py-2 border border-transparent rounded-lg text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:bg-indigo-400 transition-all shadow-md hover:shadow-lg active:scale-95"
                    >
                        {isProcessing ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Creando...
                            </>
                        ) : (
                            'Crear Cobro'
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
