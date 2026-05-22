'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { BarChart3, TrendingUp, AlertTriangle, Users, Calendar, ArrowUpRight, ArrowDownRight } from 'lucide-react';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!, 
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function AnalyticsPage() {
  const [courses, setCourses] = useState<any[]>([]);
  const [selectedCourseCode, setSelectedCourseCode] = useState<string>('');
  const [stats, setStats] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const fetchCourses = async () => {
      try {
        const { data, error } = await supabase.from('courses').select('id, course_code');
        if (error) throw error;
        
        if (data && data.length > 0) {
          setCourses(data);
          setSelectedCourseCode(data[0].course_code); 
        } else {
          setIsLoading(false);
        }
      } catch (err: any) {
        console.error("Error fetching courses:", err);
        setErrorMessage("Could not load courses.");
        setIsLoading(false);
      }
    };
    fetchCourses();
  }, []);

  useEffect(() => {
    if (!selectedCourseCode) return;

    const generateAnalytics = async () => {
      setIsLoading(true);
      setErrorMessage(null);
      
      try {
        // Optimized case-insensitive query
        const { data: sessions, error: sessionError } = await supabase
          .from('lecture_sessions')
          .select('session_id, created_at')
          .ilike('course_code', selectedCourseCode.trim())
          .order('created_at', { ascending: true });

        if (sessionError) throw sessionError;

        if (!sessions || sessions.length === 0) {
          setStats({ totalSessions: 0, avgAttendance: 0, flaggedStudents: [], trendData: [] });
          return;
        }

        const sessionIds = sessions.map(s => s.session_id);
        const { data: logs, error: logError } = await supabase
          .from('attendance_logs')
          .select('matric_number, status, session_id')
          .in('session_id', sessionIds);

        if (logError) throw logError;

        const safeLogs = logs || []; 

        const trendData = sessions.map((session, index) => {
          const sessionLogs = safeLogs.filter(l => l.session_id === session.session_id);
          const verifiedCount = sessionLogs.filter(l => l.status === 'verified').length;
          
          const dateLabel = session.created_at 
            ? new Date(session.created_at).toLocaleDateString() 
            : 'Unknown Date';

          return {
            label: `Class ${index + 1}`,
            date: dateLabel,
            count: verifiedCount,
            height: verifiedCount > 0 ? Math.min((verifiedCount / 100) * 100, 100) : 5 
          };
        });

        const flaggedLogs = safeLogs.filter(l => l.status === 'flagged');
        const flagCounts = flaggedLogs.reduce((acc: any, log) => {
          acc[log.matric_number] = (acc[log.matric_number] || 0) + 1;
          return acc;
        }, {});

        const flaggedStudents = Object.keys(flagCounts)
          .map(matric => ({ matric, count: flagCounts[matric] }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5); 

        const totalVerified = safeLogs.filter(l => l.status === 'verified').length;
        const avgAttendance = Math.round(totalVerified / sessions.length);

        setStats({
          totalSessions: sessions.length,
          avgAttendance,
          flaggedStudents,
          trendData
        });

      } catch (err: any) {
        console.error("Analytics Calculation Error:", err);
        setErrorMessage(err.message || "An error occurred fetching the data.");
        setStats({ totalSessions: 0, avgAttendance: 0, flaggedStudents: [], trendData: [] });
      } finally {
        setIsLoading(false);
      }
    };

    generateAnalytics();
  }, [selectedCourseCode]);

  return (
    <div className="min-h-screen bg-gray-50 p-6 md:p-10 font-sans">
      <div className="max-w-6xl mx-auto space-y-8">
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-gray-900 flex items-center gap-3">
              <BarChart3 className="text-[#2563EB]" size={32} />
              Historical Analytics
            </h1>
            <p className="text-gray-500 font-medium mt-1">Track attendance trends and identify at-risk students.</p>
          </div>

          <select 
            value={selectedCourseCode} 
            onChange={(e) => setSelectedCourseCode(e.target.value)}
            disabled={courses.length === 0}
            className="bg-white border border-gray-200 text-gray-900 font-bold py-3 px-4 rounded-xl outline-none focus:ring-2 focus:ring-[#2563EB] shadow-sm min-w-[200px] disabled:opacity-50 cursor-pointer"
          >
            {courses.length === 0 ? (
              <option>No Courses Found</option>
            ) : (
              courses.map(c => <option key={c.id} value={c.course_code}>{c.course_code}</option>)
            )}
          </select>
        </div>

        {errorMessage && (
          <div className="bg-red-50 text-red-700 p-4 rounded-xl border border-red-200 font-bold flex items-center gap-2">
            <AlertTriangle size={20} />
            {errorMessage}
          </div>
        )}

        {isLoading ? (
          <div className="h-64 flex flex-col items-center justify-center space-y-4">
            <div className="w-10 h-10 border-4 border-blue-200 border-t-[#2563EB] rounded-full animate-spin"></div>
            <p className="font-bold text-gray-400">Crunching data...</p>
          </div>
        ) : !stats || stats.totalSessions === 0 ? (
          
          <div className="h-64 flex flex-col items-center justify-center bg-white rounded-2xl border border-gray-200 text-gray-400 shadow-sm transition-all">
            <Calendar size={48} className="mb-4 opacity-50 text-gray-300" />
            <p className="font-bold text-gray-500">No lecture sessions recorded for {selectedCourseCode} yet.</p>
            <p className="text-sm mt-2">Start a dynamic geofence session to begin tracking data.</p>
          </div>
          
        ) : (
          
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm transition-all hover:shadow-md">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-gray-500 font-bold text-sm uppercase tracking-wider">Avg. Attendance</p>
                    <h3 className="text-4xl font-extrabold text-gray-900 mt-2">{stats.avgAttendance}</h3>
                  </div>
                  <div className="bg-blue-50 p-3 rounded-xl"><Users className="text-[#2563EB]" size={24} /></div>
                </div>
                <p className="text-sm font-bold text-green-600 mt-4 flex items-center gap-1"><ArrowUpRight size={16}/> Students per class</p>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm transition-all hover:shadow-md">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-gray-500 font-bold text-sm uppercase tracking-wider">Total Sessions</p>
                    <h3 className="text-4xl font-extrabold text-gray-900 mt-2">{stats.totalSessions}</h3>
                  </div>
                  <div className="bg-purple-50 p-3 rounded-xl"><Calendar className="text-purple-600" size={24} /></div>
                </div>
                <p className="text-sm font-bold text-gray-400 mt-4">Classes held this semester</p>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm transition-all hover:shadow-md">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-gray-500 font-bold text-sm uppercase tracking-wider">High-Risk Students</p>
                    <h3 className="text-4xl font-extrabold text-red-600 mt-2">{stats.flaggedStudents.length}</h3>
                  </div>
                  <div className="bg-red-50 p-3 rounded-xl"><AlertTriangle className="text-red-600" size={24} /></div>
                </div>
                <p className="text-sm font-bold text-red-500 mt-4 flex items-center gap-1"><ArrowDownRight size={16}/> Require frequent overrides</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-6 duration-700">
              
              <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                <div className="flex items-center gap-2 mb-8 border-b border-gray-100 pb-4">
                  <TrendingUp className="text-[#2563EB]" size={20} />
                  <h3 className="font-extrabold text-gray-900 text-lg">Attendance Trajectory</h3>
                </div>
                
                <div className="flex items-end gap-4 h-64 overflow-x-auto pb-4 pt-4">
                  {stats.trendData.map((data: any, i: number) => (
                    <div key={i} className="flex flex-col items-center flex-shrink-0 w-16 group">
                      <span className="text-xs font-bold text-[#2563EB] mb-2 opacity-0 group-hover:opacity-100 transition-opacity bg-blue-50 px-2 py-1 rounded-md">{data.count}</span>
                      <div 
                        className="w-full bg-[#2563EB] rounded-t-md hover:bg-blue-700 transition-all cursor-pointer shadow-sm"
                        style={{ height: `${data.height}%`, minHeight: '20px' }}
                      ></div>
                      <span className="text-xs font-bold text-gray-500 mt-3">{data.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                <div className="flex items-center gap-2 mb-6 border-b border-gray-100 pb-4">
                  <AlertTriangle className="text-red-500" size={20} />
                  <h3 className="font-extrabold text-gray-900 text-lg">Override Watchlist</h3>
                </div>
                
                {stats.flaggedStudents.length === 0 ? (
                  <p className="text-sm font-bold text-gray-400 text-center py-10 bg-gray-50 rounded-xl border border-dashed border-gray-200">No flagged students yet.</p>
                ) : (
                  <div className="space-y-4">
                    {stats.flaggedStudents.map((student: any, index: number) => (
                      <div key={index} className="flex items-center justify-between p-4 bg-red-50 rounded-xl border border-red-100 transition-all hover:bg-red-100">
                        <span className="font-extrabold text-gray-900">{student.matric}</span>
                        <div className="flex items-center gap-2">
                          <span className="bg-red-200 text-red-800 text-xs font-bold px-3 py-1.5 rounded-lg shadow-sm">
                            {student.count} flags
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}