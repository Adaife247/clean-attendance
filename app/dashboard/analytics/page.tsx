'use client';
import { useState, useEffect, useCallback } from 'react';
import { 
  BarChart3, AlertTriangle, Calendar, Download, Loader2, FileSpreadsheet, CheckCircle, ChevronDown, ChevronUp, Lock
} from 'lucide-react';
import { supabase } from '@/utils/supabase';

interface CourseRow {
  id: string;
  course_code: string;
  max_attendance_score: number;
  is_finalized: boolean;
}

interface StudentReportRow {
  matricNumber: string;
  totalClasses: number;
  attended: number;
  percentage: number;
  eligible: 'YES' | 'NO';
}

interface ReportData {
  course: string;
  totalClasses: number;
  plannedClasses: number;
  maxScore: number;
  isFinalized: boolean;
  report: StudentReportRow[];
}

export default function AnalyticsPage() {
  const [courses, setCourses] = useState<CourseRow[]>([]);
  const [selectedCourseCode, setSelectedCourseCode] = useState<string>('');
  const [selectedCourse, setSelectedCourse] = useState<CourseRow | null>(null);

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showWatchlist, setShowWatchlist] = useState(false);

  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [lockGrades, setLockGrades] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const getHeaders = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session?.access_token || ''}`
    };
  };

  useEffect(() => {
    const fetchCourses = async () => {
      const { data } = await supabase.from('courses').select('id, course_code, max_attendance_score, is_finalized');
      if (data && data.length > 0) {
        setCourses(data);
        setSelectedCourseCode(data[0].course_code);
        setSelectedCourse(data[0]);
      }
    };
    fetchCourses();
  }, []);

  const handleCourseChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const code = e.target.value;
    setSelectedCourseCode(code);
    const course = courses.find(c => c.course_code === code);
    if (course) setSelectedCourse(course);
  };

  const fetchReportData = useCallback(async (useFilters: boolean = false) => {
    if (!selectedCourseCode) return;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      let url = `/api/master-export?courseCode=${selectedCourseCode}`;
      if (useFilters) {
        if (startDate) url += `&startDate=${startDate}`;
        if (endDate) url += `&endDate=${endDate}`;
      }
      const headers = await getHeaders();
      const response = await fetch(url, { headers });

      if (response.status === 404) {
        setReportData(null);
        setErrorMessage("No classes found for this timeframe.");
        return;
      }

      if (!response.ok) throw new Error("Failed to load analytics.");

      const data = await response.json();
      setReportData(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load analytics.";
      setErrorMessage(message);
      setReportData(null);
    } finally {
      setIsLoading(false);
    }
  }, [selectedCourseCode, startDate, endDate]);

  useEffect(() => {
    if (!selectedCourseCode) return;
    const id = setTimeout(() => { fetchReportData(false); }, 0);
    return () => clearTimeout(id);
  }, [selectedCourseCode, fetchReportData]);

  const handleDownload = async (isFullSemester: boolean) => {
    if (!reportData || !reportData.report || !selectedCourse) return;
    
    if (lockGrades && !selectedCourse.is_finalized) {
      if (reportData.totalClasses < reportData.plannedClasses) {
        const confirm = window.confirm(`⚠️ WARNING: You planned ${reportData.plannedClasses} classes but only held ${reportData.totalClasses}.\n\nIf you lock grades now, the system will calculate final scores based on the ${reportData.totalClasses} actual classes held.\n\nDo you want to proceed?`);
        if (!confirm) return;
      } else {
        const confirm = window.confirm(`Are you sure? This will finalize the semester and lock CA scores. No more sessions can be held for this course.`);
        if (!confirm) return;
      }
    }

    setIsDownloading(true);

    if (lockGrades && !selectedCourse.is_finalized) {
      setIsFinalizing(true);
      const { error } = await supabase.from('courses').update({ is_finalized: true }).eq('id', selectedCourse.id);
      
      if (error) {
        alert("Failed to lock grades in the database.");
        setIsFinalizing(false);
        setIsDownloading(false);
        return;
      }
      
      setCourses(prev => prev.map(c => c.id === selectedCourse.id ? { ...c, is_finalized: true } : c));
      setSelectedCourse(prev => prev ? { ...prev, is_finalized: true } : null);
      setLockGrades(false); 
    }

    const maxScore = reportData.maxScore || 10;
    const timeLabel = isFullSemester ? "FULL SEMESTER LEDGER" : `CUSTOM RANGE: ${startDate || 'Start'} to ${endDate || 'End'}`;
    const datePrinted = new Date().toLocaleDateString();
    const finalStatus = (selectedCourse.is_finalized || lockGrades) ? "FINALIZED" : "LIVE (UNFINALIZED)";

    const header = [
      [`OFFICIAL ATTENDANCE REPORT - ${finalStatus}`],
      [`Course Code:`, selectedCourseCode],
      [`Reporting Period:`, timeLabel],
      [`Total Classes Held:`, reportData.totalClasses],
      [`Date Generated:`, datePrinted],
      [],
      ["S/N", "MATRICULATION NUMBER", "TOTAL CLASSES", "ATTENDED", "PERCENTAGE (%)", `CA SCORE (/${maxScore})`, "REMARK"]
    ];

    const sortedReport = [...reportData.report].sort((a, b) => a.matricNumber.localeCompare(b.matricNumber));

    const rows = sortedReport.map((s, index) => {
      const caScore = ((s.percentage / 100) * maxScore).toFixed(1);
      return [ index + 1, s.matricNumber, s.totalClasses, s.attended, s.percentage, caScore, s.eligible === 'YES' ? "CLEARED" : "NOT ELIGIBLE" ];
    });

    const csvContent = [...header, ...rows].map(row => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });

    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", `${selectedCourseCode}_Senate_Report_${isFullSemester ? 'Full' : 'Custom'}.csv`);

    document.body.appendChild(link); link.click(); document.body.removeChild(link);
    setIsFinalizing(false); setIsDownloading(false);
  };

  const applyCustomDates = () => { fetchReportData(true); };

  const atRiskStudents: StudentReportRow[] = reportData?.report?.filter(s => s.eligible === 'NO') || [];
  const maxScore = reportData?.maxScore || 10;

  return (
    <div className="min-h-screen bg-gray-50 p-6 md:p-10 font-sans">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
          <div>
            <h1 className="text-2xl font-extrabold text-gray-900 flex items-center gap-3"><BarChart3 className="text-[#2563EB]" size={28} /> Analytics & Reports</h1>
            <p className="text-gray-500 font-medium mt-1 text-sm">Generate final gradebooks and monitor exam eligibility.</p>
          </div>
          <select aria-label="Select Course for Analytics" value={selectedCourseCode} onChange={handleCourseChange} disabled={courses.length === 0} className="bg-gray-50 border border-gray-200 text-gray-900 font-bold py-3 px-4 rounded-xl outline-none focus:ring-2 focus:ring-[#2563EB] shadow-sm min-w-50 cursor-pointer">
            {courses.length === 0 ? <option>No Courses Found</option> : courses.map(c => <option key={c.id} value={c.course_code}>{c.course_code}</option>)}
          </select>
        </div>

        <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-gray-200">
          <div className="flex items-center gap-4 mb-8">
            <div className="bg-green-100 p-4 rounded-xl text-green-700"><FileSpreadsheet size={28} /></div>
            <div>
              <h3 className="text-xl font-extrabold text-gray-900">Semester Gradebook</h3>
              <p className="text-sm font-bold text-gray-400 uppercase tracking-wider mt-1">{reportData?.totalClasses || 0} Classes Held</p>
            </div>
          </div>

          <div className="mb-6 bg-blue-50 border border-blue-200 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <Lock className="text-blue-600 mt-0.5 shrink-0" size={20} />
              <div>
                <p className="font-bold text-blue-900 text-sm">Lock Final Grades</p>
                <p className="text-xs text-blue-700 font-medium mt-0.5">Check this to permanently calculate CA scores and end the semester for this course.</p>
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer bg-white px-3 py-1.5 rounded-lg border border-blue-200 shadow-sm">
              <input type="checkbox" checked={lockGrades || selectedCourse?.is_finalized} onChange={(e) => setLockGrades(e.target.checked)} disabled={selectedCourse?.is_finalized} className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500" />
              <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">{selectedCourse?.is_finalized ? "Finalized" : "Lock Grades"}</span>
            </label>
          </div>

          <button onClick={() => handleDownload(true)} disabled={isDownloading || isFinalizing || !reportData} className="w-full flex justify-center items-center gap-2 bg-green-600 text-white font-bold py-4 rounded-xl hover:bg-green-700 disabled:opacity-50 transition-all shadow-md active:scale-[0.98] text-lg mb-6">
            {isDownloading || isFinalizing ? <Loader2 size={24} className="animate-spin" /> : <Download size={24} />} Download Full Semester CSV
          </button>

          <div className="border-t border-gray-100 pt-6">
            <button onClick={() => setShowAdvanced(!showAdvanced)} className="w-full flex justify-between items-center text-sm font-bold text-gray-500 hover:text-gray-900 transition-colors bg-gray-50 p-4 rounded-xl border border-gray-200">
              <span className="flex items-center gap-2"><Calendar size={16}/> Custom Date Range</span>
              {showAdvanced ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>

            {showAdvanced && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 animate-in fade-in slide-in-from-top-2">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">From</label>
                  <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 px-4 font-bold text-gray-900 outline-none focus:ring-2 focus:ring-[#2563EB]" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">To</label>
                  <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} min={startDate} className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 px-4 font-bold text-gray-900 outline-none focus:ring-2 focus:ring-[#2563EB]" />
                </div>
                <div className="md:col-span-2 grid grid-cols-2 gap-2 mt-2">
                  <button onClick={applyCustomDates} className="bg-gray-100 text-gray-700 font-bold py-3 rounded-xl hover:bg-gray-200 transition-all text-sm">Apply Filters</button>
                  <button onClick={() => handleDownload(false)} disabled={isDownloading || isFinalizing || !reportData} className="flex justify-center items-center gap-2 bg-gray-900 text-white font-bold py-3 rounded-xl hover:bg-gray-800 disabled:opacity-50 transition-all shadow-sm text-sm"><Download size={16} /> Export Range</button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <button onClick={() => setShowWatchlist(!showWatchlist)} className="w-full flex items-center justify-between p-6 bg-white hover:bg-gray-50 transition-colors text-left">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${atRiskStudents.length > 0 ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>{atRiskStudents.length > 0 ? <AlertTriangle size={20} /> : <CheckCircle size={20} />}</div>
              <div>
                <h3 className="font-extrabold text-gray-900 text-lg">Exam Eligibility Watchlist</h3>
                <p className="text-xs text-gray-500 font-medium mt-0.5">{atRiskStudents.length > 0 ? `${atRiskStudents.length} students currently below 70%` : "All students are eligible for the exam."}</p>
              </div>
            </div>
            <div className="text-gray-400">{showWatchlist ? <ChevronUp size={24} /> : <ChevronDown size={24} />}</div>
          </button>

          {showWatchlist && (
            <div className="border-t border-gray-100 bg-gray-50/50 p-4 animate-in fade-in slide-in-from-top-2">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center h-32"><Loader2 className="animate-spin text-[#2563EB]" size={24}/></div>
              ) : atRiskStudents.length === 0 ? (
                <div className="text-center p-8 text-green-600 font-bold">No students at risk!</div>
              ) : (
                <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
                  <table className="w-full text-left whitespace-nowrap min-w-125">
                    <thead><tr className="bg-gray-50 border-b border-gray-100 text-xs uppercase tracking-wider text-gray-400"><th className="px-6 py-3 font-bold">Matric Number</th><th className="px-6 py-3 font-bold text-center">Attendance</th><th className="px-6 py-3 font-bold text-right">CA Score</th><th className="px-6 py-3 font-bold text-right">Standing</th></tr></thead>
                    <tbody className="divide-y divide-gray-50">
                      {atRiskStudents.map((student, i) => (
                        <tr key={i} className="hover:bg-red-50/20 transition-colors">
                          <td className="px-6 py-3 font-black text-gray-900">{student.matricNumber}</td>
                          <td className="px-6 py-3 text-center font-bold text-gray-600">{student.attended} / {student.totalClasses}</td>
                          <td className="px-6 py-3 text-right font-bold text-gray-600">{((student.percentage / 100) * maxScore).toFixed(1)} / {maxScore}</td>
                          <td className="px-6 py-3 text-right"><span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-black bg-red-100 text-red-700">{student.percentage}%</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {errorMessage && (<div className="bg-red-50 border border-red-100 rounded-2xl p-4 text-center"><p className="text-red-700 font-bold text-sm">{errorMessage}</p></div>)}
      </div>
    </div>
  );
}