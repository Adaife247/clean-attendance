'use client';
import { useState, useEffect, useCallback } from 'react';
import { 
  BarChart3, AlertTriangle, Calendar, Download, Loader2, FileSpreadsheet, CheckCircle, ChevronDown, ChevronUp, Lock, BellRing, FileText
} from 'lucide-react';
import { supabase } from '@/utils/supabase';
import { ConfirmModal, useConfirmModal } from '@/components/ConfirmModal';
import { ToastContainer, useToast } from '@/components/Toast';
import AttendanceCalendar from '@/components/lecturer/AttendanceCalendar';
import { getLecturerHeaders } from '@/utils/api-client';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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

interface SessionData {
  session_id: string;
  created_at: string;
  verified_count: number;
  flagged_count: number;
}

export default function AnalyticsPage() {
  const [courses, setCourses] = useState<CourseRow[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [selectedCourse, setSelectedCourse] = useState<CourseRow | null>(null);

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showWatchlist, setShowWatchlist] = useState(false);

  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [sessionsData, setSessionsData] = useState<SessionData[]>([]);
  
  const [isLoading, setIsLoading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [isNotifying, setIsNotifying] = useState(false);
  const [lockGrades, setLockGrades] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const confirm = useConfirmModal();
  const { toasts, addToast, removeToast } = useToast();

  useEffect(() => {
    const fetchCourses = async () => {
      const { data } = await supabase.from('courses').select('id, course_code, max_attendance_score, is_finalized');
      if (data && data.length > 0) {
        setCourses(data);
        setSelectedCourseId(data[0].id);
        setSelectedCourse(data[0]);
      }
    };
    fetchCourses();
  }, []);

  const handleCourseChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    setSelectedCourseId(id);
    const course = courses.find(c => c.id === id);
    if (course) setSelectedCourse(course);
  };

  const fetchReportData = useCallback(async (useFilters: boolean = false) => {
    if (!selectedCourseId) return;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      let url = `/api/master-export?courseId=${selectedCourseId}`;
      if (useFilters) {
        if (startDate) url += `&startDate=${startDate}`;
        if (endDate) url += `&endDate=${endDate}`;
      }
      const headers = await getLecturerHeaders();
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
  }, [selectedCourseId, startDate, endDate]);

  const fetchSessions = useCallback(async () => {
    if (!selectedCourseId) return;
    try {
      const headers = await getLecturerHeaders();
      const response = await fetch(`/api/attendance-history?courseId=${selectedCourseId}`, { headers });
      if (response.ok) {
        const data = await response.json();
        setSessionsData(data);
      }
    } catch {
      console.error("Failed to load calendar data");
    }
  }, [selectedCourseId]);

  useEffect(() => {
    if (!selectedCourseId) return;
    const id = setTimeout(() => { 
      fetchReportData(false); 
      fetchSessions();
    }, 0);
    return () => clearTimeout(id);
  }, [selectedCourseId, fetchReportData, fetchSessions]);

  const handleNotifyStudents = async () => {
    if (!selectedCourseId) return;
    
    confirm.ask(
      'Send Alerts?',
      'This will send a push notification to all students currently below 70% attendance. This cannot be undone.',
      async () => {
        setIsNotifying(true);
        try {
          const headers = await getLecturerHeaders();
          const res = await fetch('/api/alerts/low-attendance', {
            method: 'POST',
            headers,
            body: JSON.stringify({ courseId: selectedCourseId })
          });
          
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "Failed to send alerts");
          
          if (data.atRiskCount === 0) {
            addToast('No alerts sent', 'All students are currently above 70%.', 'info');
          } else if (data.alertsSent === 0) {
            addToast('Delivery failed', `${data.atRiskCount} students are at risk, but none have push notifications enabled.`, 'error');
          } else {
            addToast('Alerts sent', `Successfully warned ${data.alertsSent} students.`, 'success');
          }
        } catch (err) {
          addToast('Error', err instanceof Error ? err.message : "Failed to send alerts", 'error');
        } finally {
          setIsNotifying(false);
        }
      },
      { isDangerous: false, confirmLabel: 'Send Alerts' }
    );
  };

  const finalizeGradesIfNeeded = async (): Promise<boolean> => {
    if (lockGrades && selectedCourse && !selectedCourse.is_finalized) {
      setIsFinalizing(true);
      const { error } = await supabase
        .from('courses')
        .update({ is_finalized: true })
        .eq('id', selectedCourse.id);

      if (error) {
        addToast('Lock failed', 'Could not finalize grades in the database.', 'error');
        setIsFinalizing(false);
        setIsDownloading(false);
        return false;
      }

      setCourses(prev => prev.map(c => c.id === selectedCourse.id ? { ...c, is_finalized: true } : c));
      setSelectedCourse(prev => prev ? { ...prev, is_finalized: true } : null);
      setLockGrades(false);
    }
    return true;
  };

  const executeDownloadCSV = async (isFullSemester: boolean) => {
    if (!reportData || !reportData.report || !selectedCourse) return;
    setIsDownloading(true);

    const proceed = await finalizeGradesIfNeeded();
    if (!proceed) return;

    const maxScore = reportData.maxScore || 10;
    const timeLabel = isFullSemester ? "FULL SEMESTER LEDGER" : `CUSTOM RANGE: ${startDate || 'Start'} to ${endDate || 'End'}`;
    const datePrinted = new Date().toLocaleDateString();
    const finalStatus = (selectedCourse.is_finalized || lockGrades) ? "FINALIZED" : "LIVE (UNFINALIZED)";

    const header = [
      [`OFFICIAL ATTENDANCE REPORT - ${finalStatus}`],
      [`Course Code:`, selectedCourse.course_code],
      [`Reporting Period:`, timeLabel],
      [`Total Classes Held:`, reportData.totalClasses],
      [`Date Generated:`, datePrinted],
      [],
      ["S/N", "MATRICULATION NUMBER", "TOTAL CLASSES", "ATTENDED", "PERCENTAGE (%)", `CA SCORE (/${maxScore})`, "REMARK"]
    ];

    const sortedReport = [...reportData.report].sort((a, b) => a.matricNumber.localeCompare(b.matricNumber));

    const rows = sortedReport.map((s, index) => {
      const caScore = ((s.percentage / 100) * maxScore).toFixed(1);
      return [
        index + 1,
        s.matricNumber,
        s.totalClasses,
        s.attended,
        s.percentage,
        caScore,
        s.eligible === 'YES' ? "CLEARED" : "NOT ELIGIBLE"
      ];
    });

    const csvContent = [...header, ...rows].map(row => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });

    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", `${selectedCourse.course_code}_Senate_Report_${isFullSemester ? 'Full' : 'Custom'}.csv`);

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    addToast('Report downloaded', `${selectedCourse.course_code} CSV exported successfully.`, 'success');
    setIsFinalizing(false);
    setIsDownloading(false);
  };

  const executeDownloadPDF = async (isFullSemester: boolean) => {
    if (!reportData || !reportData.report || !selectedCourse) return;
    setIsDownloading(true);

    const proceed = await finalizeGradesIfNeeded();
    if (!proceed) return;

    const maxScore = reportData.maxScore || 10;
    const timeLabel = isFullSemester ? "FULL SEMESTER LEDGER" : `CUSTOM RANGE: ${startDate || 'Start'} to ${endDate || 'End'}`;
    const datePrinted = new Date().toLocaleDateString();
    const finalStatus = (selectedCourse.is_finalized || lockGrades) ? "FINALIZED" : "LIVE (UNFINALIZED)";

    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(`OFFICIAL ATTENDANCE REPORT - ${finalStatus}`, 14, 22);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Course Code: ${selectedCourse.course_code}`, 14, 32);
    doc.text(`Reporting Period: ${timeLabel}`, 14, 38);
    doc.text(`Total Classes Held: ${reportData.totalClasses}`, 14, 44);
    doc.text(`Date Generated: ${datePrinted}`, 14, 50);

    const sortedReport = [...reportData.report].sort((a, b) => a.matricNumber.localeCompare(b.matricNumber));
    
    const tableBody = sortedReport.map((s, index) => {
      const caScore = ((s.percentage / 100) * maxScore).toFixed(1);
      return [
        index + 1,
        s.matricNumber,
        s.totalClasses,
        s.attended,
        `${s.percentage}%`,
        `${caScore} / ${maxScore}`,
        s.eligible === 'YES' ? "CLEARED" : "NOT ELIGIBLE"
      ];
    });

    autoTable(doc, {
      startY: 60,
      head: [['S/N', 'MATRICULATION NUMBER', 'TOTAL CLASSES', 'ATTENDED', 'PERCENTAGE', 'CA SCORE', 'REMARK']],
      body: tableBody,
      theme: 'grid',
      headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [249, 250, 251] },
      columnStyles: {
        0: { halign: 'center' },
        2: { halign: 'center' },
        3: { halign: 'center' },
        4: { halign: 'center' },
        5: { halign: 'center' },
        6: { halign: 'right' }
      }
    });

    doc.save(`${selectedCourse.course_code}_Senate_Report_${isFullSemester ? 'Full' : 'Custom'}.pdf`);
    
    addToast('PDF downloaded', `${selectedCourse.course_code} PDF exported successfully.`, 'success');
    setIsFinalizing(false);
    setIsDownloading(false);
  };

  const handleDownload = (format: 'csv' | 'pdf', isFullSemester: boolean) => {
    if (!reportData || !reportData.report || !selectedCourse) return;

    if (lockGrades && !selectedCourse.is_finalized) {
      const isBelowPlanned = reportData.totalClasses < reportData.plannedClasses;
      confirm.ask(
        isBelowPlanned ? 'Finalize with fewer classes held?' : 'Lock final grades?',
        isBelowPlanned
          ? `You planned ${reportData.plannedClasses} classes but only held ${reportData.totalClasses}. Final scores will be calculated against the ${reportData.totalClasses} held.`
          : 'This will finalize the semester and lock CA scores. No more sessions can be held for this course.',
        () => {
          if (format === 'csv') executeDownloadCSV(isFullSemester);
          else executeDownloadPDF(isFullSemester);
        },
        { isDangerous: true, confirmLabel: 'Lock & Download' }
      );
      return;
    }

    if (format === 'csv') executeDownloadCSV(isFullSemester);
    else executeDownloadPDF(isFullSemester);
  };

  const applyCustomDates = () => { fetchReportData(true); };

  const atRiskStudents: StudentReportRow[] = reportData?.report?.filter(s => s.eligible === 'NO') || [];
  const maxScore = reportData?.maxScore || 10;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-6 md:p-10 font-sans transition-colors duration-300">
      <div className="max-w-4xl mx-auto space-y-8">

        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-gray-900 p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 transition-colors">
          <div>
            <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white flex items-center gap-3">
              <BarChart3 className="text-[#2563EB] dark:text-blue-400" size={28} /> Analytics & Reports
            </h1>
            <p className="text-gray-500 dark:text-gray-400 font-medium mt-1 text-sm">Generate final gradebooks and monitor exam eligibility.</p>
          </div>
          <select
            aria-label="Select Course for Analytics"
            value={selectedCourseId}
            onChange={handleCourseChange}
            disabled={courses.length === 0}
            className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white font-bold py-3 px-4 rounded-xl outline-none focus:ring-2 focus:ring-[#2563EB] shadow-sm min-w-50 cursor-pointer transition-colors"
          >
            {courses.length === 0
              ? <option>No Courses Found</option>
              : courses.map(c => <option key={c.id} value={c.id}>{c.course_code}</option>)
            }
          </select>
        </div>

        <AttendanceCalendar sessions={sessionsData} />

        <div className="bg-white dark:bg-gray-900 p-6 md:p-8 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 transition-colors">
          <div className="flex items-center gap-4 mb-8">
            <div className="bg-green-100 dark:bg-green-900/30 p-4 rounded-xl text-green-700 dark:text-green-400">
              <FileSpreadsheet size={28} />
            </div>
            <div>
              <h3 className="text-xl font-extrabold text-gray-900 dark:text-white">Semester Gradebook</h3>
              <p className="text-sm font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mt-1">{reportData?.totalClasses || 0} Classes Held</p>
            </div>
          </div>

          <div className="mb-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 transition-colors">
            <div className="flex items-start gap-3">
              <Lock className="text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" size={20} />
              <div>
                <p className="font-bold text-blue-900 dark:text-blue-300 text-sm">Lock Final Grades</p>
                <p className="text-xs text-blue-700 dark:text-blue-400 font-medium mt-0.5">Check this to permanently calculate CA scores and end the semester for this course.</p>
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer bg-white dark:bg-gray-800 px-3 py-1.5 rounded-lg border border-blue-200 dark:border-blue-700 shadow-sm transition-colors">
              <input 
                type="checkbox" 
                checked={lockGrades || selectedCourse?.is_finalized} 
                onChange={(e) => setLockGrades(e.target.checked)}
                disabled={selectedCourse?.is_finalized}
                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
              />
              <span className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                {selectedCourse?.is_finalized ? "Finalized" : "Lock Grades"}
              </span>
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
            <button
              onClick={() => handleDownload('csv', true)}
              disabled={isDownloading || isFinalizing || !reportData}
              className="w-full flex justify-center items-center gap-2 bg-green-600 text-white font-bold py-4 rounded-xl hover:bg-green-700 disabled:opacity-50 transition-all shadow-md active:scale-[0.98] text-lg"
            >
              {isDownloading || isFinalizing ? <Loader2 size={24} className="animate-spin" /> : <Download size={24} />}
              Download CSV
            </button>
            <button
              onClick={() => handleDownload('pdf', true)}
              disabled={isDownloading || isFinalizing || !reportData}
              className="w-full flex justify-center items-center gap-2 bg-red-600 text-white font-bold py-4 rounded-xl hover:bg-red-700 disabled:opacity-50 transition-all shadow-md active:scale-[0.98] text-lg"
            >
              {isDownloading || isFinalizing ? <Loader2 size={24} className="animate-spin" /> : <FileText size={24} />}
              Download PDF
            </button>
          </div>

          <div className="border-t border-gray-100 dark:border-gray-800 pt-6">
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="w-full flex justify-between items-center text-sm font-bold text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl border border-gray-200 dark:border-gray-700"
            >
              <span className="flex items-center gap-2"><Calendar size={16}/> Custom Date Range</span>
              {showAdvanced ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>

            {showAdvanced && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 animate-in fade-in slide-in-from-top-2">
                <div>
                  <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">From</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl py-3 px-4 font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-[#2563EB] transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">To</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    min={startDate}
                    className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl py-3 px-4 font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-[#2563EB] transition-colors"
                  />
                </div>
                <div className="md:col-span-2 grid grid-cols-2 gap-2 mt-2">
                  <button
                    onClick={applyCustomDates}
                    className="bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-bold py-3 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-all text-sm"
                  >
                    Apply Filters
                  </button>
                  <div className="flex gap-2 w-full">
                    <button
                      onClick={() => handleDownload('csv', false)}
                      disabled={isDownloading || isFinalizing || !reportData}
                      className="flex-1 flex justify-center items-center gap-2 bg-gray-900 dark:bg-gray-700 text-white font-bold py-3 rounded-xl hover:bg-gray-800 dark:hover:bg-gray-600 disabled:opacity-50 transition-all shadow-sm text-sm"
                    >
                      <Download size={16} /> Range CSV
                    </button>
                    <button
                      onClick={() => handleDownload('pdf', false)}
                      disabled={isDownloading || isFinalizing || !reportData}
                      className="flex-1 flex justify-center items-center gap-2 bg-gray-900 dark:bg-gray-700 text-white font-bold py-3 rounded-xl hover:bg-gray-800 dark:hover:bg-gray-600 disabled:opacity-50 transition-all shadow-sm text-sm"
                    >
                      <FileText size={16} /> Range PDF
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden transition-colors">
          <button
            onClick={() => setShowWatchlist(!showWatchlist)}
            className="w-full flex items-center justify-between p-6 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors text-left"
          >
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${atRiskStudents.length > 0 ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' : 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'}`}>
                {atRiskStudents.length > 0 ? <AlertTriangle size={20} /> : <CheckCircle size={20} />}
              </div>
              <div>
                <h3 className="font-extrabold text-gray-900 dark:text-white text-lg">Exam Eligibility Watchlist</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mt-0.5">
                  {atRiskStudents.length > 0
                    ? `${atRiskStudents.length} students currently below 70%`
                    : "All students are eligible for the exam."}
                </p>
              </div>
            </div>
            <div className="text-gray-400 dark:text-gray-500">
              {showWatchlist ? <ChevronUp size={24} /> : <ChevronDown size={24} />}
            </div>
          </button>

          {showWatchlist && (
            <div className="border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30 p-4 animate-in fade-in slide-in-from-top-2">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center h-32">
                  <Loader2 className="animate-spin text-[#2563EB] dark:text-blue-400" size={24}/>
                </div>
              ) : atRiskStudents.length === 0 ? (
                <div className="text-center p-8 text-green-600 dark:text-green-400 font-bold">No students at risk!</div>
              ) : (
                <div className="space-y-4">
                  <div className="flex justify-end">
                    <button
                      onClick={handleNotifyStudents}
                      disabled={isNotifying}
                      className="flex items-center gap-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-red-100 dark:hover:bg-red-900/40 disabled:opacity-50 transition-all shadow-sm"
                    >
                      {isNotifying ? <Loader2 size={16} className="animate-spin" /> : <BellRing size={16} />}
                      {isNotifying ? "Sending Alerts..." : "Notify At-Risk Students"}
                    </button>
                  </div>
                  <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl overflow-x-auto transition-colors">
                    <table className="w-full text-left whitespace-nowrap min-w-125">
                      <thead>
                        <tr className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-700 text-xs uppercase tracking-wider text-gray-400 dark:text-gray-500">
                          <th className="px-6 py-3 font-bold">Matric Number</th>
                          <th className="px-6 py-3 font-bold text-center">Attendance</th>
                          <th className="px-6 py-3 font-bold text-right">CA Score</th>
                          <th className="px-6 py-3 font-bold text-right">Standing</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                        {atRiskStudents.map((student, i) => (
                          <tr key={i} className="hover:bg-red-50/20 dark:hover:bg-red-900/10 transition-colors">
                            <td className="px-6 py-3 font-black text-gray-900 dark:text-white">{student.matricNumber}</td>
                            <td className="px-6 py-3 text-center font-bold text-gray-600 dark:text-gray-300">{student.attended} / {student.totalClasses}</td>
                            <td className="px-6 py-3 text-right font-bold text-gray-600 dark:text-gray-300">
                              {((student.percentage / 100) * maxScore).toFixed(1)} / {maxScore}
                            </td>
                            <td className="px-6 py-3 text-right">
                              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-black bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">
                                {student.percentage}%
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {errorMessage && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-2xl p-4 text-center transition-colors">
            <p className="text-red-700 dark:text-red-400 font-bold text-sm">{errorMessage}</p>
          </div>
        )}

      </div>

      <ConfirmModal config={confirm.config} onClose={confirm.close} />
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </div>
  );
}