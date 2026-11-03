'use client';
import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
interface Session {
  session_id: string;
  created_at: string;
  verified_count: number;
  flagged_count: number;
}

interface AttendanceCalendarProps {
  sessions: Session[];
}

export default function AttendanceCalendar({ sessions }: AttendanceCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Calendar math
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  // Group sessions by YYYY-MM-DD
  const sessionsByDate = useMemo(() => {
    const map = new Map<string, Session[]>();
    sessions.forEach(session => {
      const dateStr = new Date(session.created_at).toLocaleDateString('en-CA'); // YYYY-MM-DD
      if (!map.has(dateStr)) map.set(dateStr, []);
      map.get(dateStr)!.push(session);
    });
    return map;
  }, [sessions]);

  const monthName = currentDate.toLocaleString('default', { month: 'long' });
  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Handle Day Click
  const handleDayClick = (day: number) => {
    const dateStr = new Date(year, month, day).toLocaleDateString('en-CA');
    if (sessionsByDate.has(dateStr)) {
      setSelectedDay(dateStr === selectedDay ? null : dateStr);
    }
  };

  const selectedSessions = selectedDay ? sessionsByDate.get(selectedDay) || [] : [];

  return (
    <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden transition-colors">
      <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/50">
        <div className="flex items-center gap-3">
          <div className="bg-blue-100 dark:bg-blue-900/40 p-2 rounded-xl text-[#2563EB] dark:text-blue-400">
            <CalendarIcon size={24} />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-gray-900 dark:text-white">Attendance Calendar</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Visual history of class sessions</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={prevMonth} className="p-2 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <ChevronLeft size={20} className="text-gray-600 dark:text-gray-300" />
          </button>
          <span className="flex items-center px-4 font-bold text-gray-900 dark:text-white min-w-37.5 justify-center">
            {monthName} {year}
          </span>
          <button onClick={nextMonth} className="p-2 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <ChevronRight size={20} className="text-gray-600 dark:text-gray-300" />
          </button>
        </div>
      </div>

      <div className="p-6">
        {/* Days of Week */}
        <div className="grid grid-cols-7 gap-2 mb-2 text-center">
          {daysOfWeek.map(day => (
            <div key={day} className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider py-2">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-2">
          {Array.from({ length: firstDayOfMonth }).map((_, i) => (
            <div key={`empty-${i}`} className="h-16 rounded-xl bg-gray-50/50 dark:bg-gray-800/20 border border-transparent" />
          ))}
          
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const dateStr = new Date(year, month, day).toLocaleDateString('en-CA');
            const daySessions = sessionsByDate.get(dateStr);
            const hasSessions = !!daySessions;
            const isSelected = selectedDay === dateStr;

            return (
              <button
                key={day}
                onClick={() => handleDayClick(day)}
                disabled={!hasSessions}
                className={`h-16 rounded-xl border flex flex-col items-center justify-center relative transition-all ${
                  isSelected 
                    ? 'border-[#2563EB] bg-blue-50 dark:bg-blue-900/30 ring-2 ring-[#2563EB] ring-offset-2 dark:ring-offset-gray-900' 
                    : hasSessions 
                      ? 'border-blue-100 dark:border-blue-900/50 bg-blue-50/50 dark:bg-blue-900/10 hover:border-blue-300 dark:hover:border-blue-700 cursor-pointer shadow-sm' 
                      : 'border-transparent text-gray-400 dark:text-gray-600 opacity-50 cursor-default'
                }`}
              >
                <span className={`text-sm font-bold ${hasSessions ? 'text-[#2563EB] dark:text-blue-400' : ''}`}>
                  {day}
                </span>
                {hasSessions && (
                  <span className="absolute bottom-2 w-1.5 h-1.5 rounded-full bg-[#2563EB] dark:bg-blue-400" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Day Details */}
      {selectedDay && selectedSessions.length > 0 && (
        <div className="p-6 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-800 animate-in slide-in-from-top-2">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4">
            Sessions on {new Date(selectedDay).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
          </h3>
          <div className="space-y-3">
            {selectedSessions.map((session, i) => (
              <div key={session.session_id} className="bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-700 flex justify-between items-center shadow-sm">
                <div>
                  <p className="font-bold text-gray-900 dark:text-white text-sm">
                    {new Date(session.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mt-0.5">Session {i + 1}</p>
                </div>
                <div className="flex gap-4">
                  <div className="text-center">
                    <p className="text-lg font-black text-emerald-600 dark:text-emerald-400">{session.verified_count}</p>
                    <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Present</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-black text-red-500 dark:text-red-400">{session.flagged_count}</p>
                    <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Flagged</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}