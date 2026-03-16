import { useEffect, useState } from 'react';
import { format, startOfWeek, addDays, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { calendarApi } from '../lib/api';
import { Users, Clock, Loader2 } from 'lucide-react';

interface EventType {
    id: number;
    title: string;
    duration: number;
}

interface Booking {
    id: number;
    uid: string;
    title: string;
    description: string;
    startTime: string;
    endTime: string;
    status: string;
    eventTypeId: number;
    eventType?: EventType;
}

export default function Dashboard() {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [loading, setLoading] = useState(true);

    // Generar dias de la semana actual
    const startDate = startOfWeek(currentDate, { weekStartsOn: 1 });
    const weekDays = Array.from({ length: 7 }).map((_, i) => addDays(startDate, i));

    useEffect(() => {
        fetchBookings();
    }, [currentDate]);

    const fetchBookings = async () => {
        try {
            setLoading(true);
            // Aqui llamaremos al agendador_cal. Necesitamos asegurarnos que el backend agendador 
            // expone un endpoint para traer bookings en un rango de fechas. 
            // Por ahora, simulamos o traemos todos para desarrollo.
            const response = await calendarApi.get('/bookings');
            if (response.data && response.data.bookings) {
                setBookings(response.data.bookings);
            }
        } catch (error) {
            console.error('Error fetching bookings:', error);
        } finally {
            setLoading(false);
        }
    };

    const getBookingsForDay = (day: Date) => {
        return bookings.filter(b => isSameDay(new Date(b.startTime), day));
    };

    return (
        <div className="space-y-6 flex flex-col h-full">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Calendario de Clases</h1>
                    <p className="text-muted-foreground mt-1">
                        Gestiona los cupos y reservas de Punto Fusión
                    </p>
                </div>
            </div>

            {/* Week Navigation */}
            <div className="flex items-center justify-between bg-card p-4 rounded-xl shadow-sm border border-border">
                <button
                    onClick={() => setCurrentDate(addDays(currentDate, -7))}
                    className="px-4 py-2 hover:bg-accent rounded-md text-sm font-medium transition-colors"
                >
                    &larr; Semana Anterior
                </button>
                <span className="text-lg font-semibold capitalize">
                    {format(startDate, 'MMMM yyyy', { locale: es })}
                </span>
                <button
                    onClick={() => setCurrentDate(addDays(currentDate, 7))}
                    className="px-4 py-2 hover:bg-accent rounded-md text-sm font-medium transition-colors"
                >
                    Semana Siguiente &rarr;
                </button>
            </div>

            {loading ? (
                <div className="flex-1 flex items-center justify-center">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
            ) : (
                <div className="grid grid-cols-7 gap-4 flex-1">
                    {weekDays.map((day, i) => {
                        const dayBookings = getBookingsForDay(day);
                        const isToday = isSameDay(day, new Date());

                        return (
                            <div key={i} className={`flex flex-col bg-card rounded-xl border ${isToday ? 'border-primary shadow-md' : 'border-border shadow-sm'} overflow-hidden`}>
                                <div className={`p-3 text-center border-b ${isToday ? 'bg-primary/10 border-primary/20' : 'border-border'}`}>
                                    <div className="text-sm font-medium text-muted-foreground capitalize">
                                        {format(day, 'EEEE', { locale: es })}
                                    </div>
                                    <div className={`text-2xl font-bold mt-1 ${isToday ? 'text-primary' : ''}`}>
                                        {format(day, 'd')}
                                    </div>
                                </div>

                                <div className="p-2 space-y-2 overflow-y-auto flex-1 bg-muted/20">
                                    {dayBookings.length === 0 ? (
                                        <div className="text-xs text-center text-muted-foreground py-4">
                                            Sin clases
                                        </div>
                                    ) : (
                                        dayBookings.map(booking => (
                                            <div key={booking.id} className="bg-background rounded-lg p-3 shadow-sm border border-border hover:border-primary/50 cursor-pointer transition-colors group">
                                                <div className="font-semibold text-sm line-clamp-1">{booking.title}</div>

                                                <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                                                    <Clock className="w-3.5 h-3.5" />
                                                    <span>{format(new Date(booking.startTime), 'HH:mm')}</span>
                                                </div>

                                                <div className="flex items-center justify-between mt-3">
                                                    <div className="flex items-center gap-1.5 text-xs font-medium text-primary bg-primary/10 px-2 py-1 rounded-full">
                                                        <Users className="w-3 h-3" />
                                                        <span>15 Cupos</span>
                                                    </div>
                                                    <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${booking.status === 'CONFIRMED' ? 'bg-green-500/10 text-green-600 dark:text-green-400' : 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400'
                                                        }`}>
                                                        {booking.status}
                                                    </span>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
