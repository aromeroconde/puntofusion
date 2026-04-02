import { useEffect, useState } from 'react';
import { format, startOfWeek, addDays, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { api } from '../lib/api';
import { Users, Clock, Loader2 } from 'lucide-react';

interface CalendarBooking {
    id: string;
    studentName: string;
    status: string;
}

interface CalendarClass {
    eventTypeId: string;
    title: string;
    startTime: string;
    endTime: string;
    duration: number;
    maxCapacity: number;
    bookedCount: number;
    bookings: CalendarBooking[];
}

interface CalendarDay {
    date: string;
    classes: CalendarClass[];
}

export default function Dashboard() {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [days, setDays] = useState<CalendarDay[]>([]);
    const [loading, setLoading] = useState(true);

    // Generar dias de la semana actual
    const startDate = startOfWeek(currentDate, { weekStartsOn: 1 });
    const endDate = addDays(startDate, 6);
    const weekDays = Array.from({ length: 7 }).map((_, i) => addDays(startDate, i));

    useEffect(() => {
        fetchCalendar();
    }, [currentDate]);

    const fetchCalendar = async () => {
        try {
            setLoading(true);
            const startStr = format(startDate, 'yyyy-MM-dd');
            const endStr = format(endDate, 'yyyy-MM-dd');
            const response = await api.get('/bookings/calendar', {
                params: { startDate: startStr, endDate: endStr }
            });
            if (response.data?.days) {
                setDays(response.data.days);
            }
        } catch (error) {
            console.error('Error fetching calendar:', error);
        } finally {
            setLoading(false);
        }
    };

    const getClassesForDay = (day: Date) => {
        const dateStr = format(day, 'yyyy-MM-dd');
        return days.find(d => d.date === dateStr)?.classes || [];
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
                        const dayClasses = getClassesForDay(day);
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
                                    {dayClasses.length === 0 ? (
                                        <div className="text-xs text-center text-muted-foreground py-4">
                                            Sin clases
                                        </div>
                                    ) : (
                                        dayClasses.map((cls, j) => (
                                            <div key={j} className="bg-background rounded-lg p-3 shadow-sm border border-border hover:border-primary/50 cursor-pointer transition-colors group">
                                                <div className="font-semibold text-sm line-clamp-1">{cls.title}</div>

                                                <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                                                    <Clock className="w-3.5 h-3.5" />
                                                    <span>{cls.startTime} - {cls.endTime}</span>
                                                </div>

                                                <div className="flex items-center justify-between mt-3">
                                                    <div className="flex items-center gap-1.5 text-xs font-medium text-primary bg-primary/10 px-2 py-1 rounded-full">
                                                        <Users className="w-3 h-3" />
                                                        <span>{cls.bookedCount}/{cls.maxCapacity}</span>
                                                    </div>
                                                    {cls.bookedCount > 0 && (
                                                        <div className="text-[10px] text-muted-foreground">
                                                            {cls.bookings.map(b => b.studentName).join(', ')}
                                                        </div>
                                                    )}
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
