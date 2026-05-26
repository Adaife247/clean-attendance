'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { 
  BarChart3, 
  AlertTriangle, 
  Calendar, 
  Download, 
  Loader2, 
  FileSpreadsheet, 
  CheckCircle 
} from 'lucide-react';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!, 
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function AnalyticsPage() {
  const [courses, setCourses] = useState<any[]>([]);
  const [selectedCourseCode, setSelectedCourseCode] = useState<string>('');
  
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  const [reportData, setReportData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Fetch available courses for the dropdown
  useEffect(() => {
    const fetchCourses = async () => {
      const { data } = await supabase.from('courses').select('id, course_code');
      if (data && data.length > 0) {
        setCourses(data);
        setSelectedCourseCode(data[0].course_code); 
      }
    };
    fetchCourses();
  }, []);

  // Fetch the report data whenever the course or dates change
  useEffect(() => {
    if (!selectedCourseCode) return;
    fetchReportData();
  }, [selectedCourseCode, startDate, endDate]);

  const fetchReportData = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      let url = `/api/master-export?courseCode=${selectedCourseCode}`;
      if (startDate) url += `&startDate=${startDate}`;
      if (endDate) url += `&endDate=${endDate}`;

      const response = await fetch(url);
      
      if (response.status === 404) {
        setReportData(null);
        setErrorMessage("No classes found for this date range.");
        setIsLoading(false);
        return;
      }
      
      if (!response.ok) throw new Error("Failed to load analytics.");
      
      const data = await response.json();
      setReportData(data);
    } catch (err: any) {
      setErrorMessage(err.message);
      setReportData(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = () => {
    if (!reportData || !reportData.report) return;
    setIsDownloading(true);
    
    const header = [
      [`OFFICIAL GRADEBOOK REPORT: ${selectedCourseCode}`],
      [`Period: ${startDate || 'Start of Term'} to ${endDate || 'End of Term'}`],
      [`Total Classes Held: ${reportData.totalClasses}`],
      [], 
      ["Matric Number", "Classes Attended", `Total Classes`, "Percentage (%)", "Exam Eligible (>=70%)"]
    ];

    const rows = reportData.report.map((s: any) => [
      s.matricNumber, 
      s.attended, 
      s.totalClasses, 
      s.percentage, 
      s.eligible
    ]);
    
    const csvContent = [...header, ...rows].map(row => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", `${selectedCourseCode}_Gradebook_${startDate || 'All'}.csv`);
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    setIsDownloading(false);
  };

  // Filter students who are below 70%
  const atRiskStudents = reportData?.report?.filter((s: any) => s.eligible === 'NO') || [];

  return (
    <div className="min-h-screen bg-gray-50 p-6 md:p-10 font-sans">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header Area */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
          <div>
            <h1 className="text-2xl font-extrabold text-gray-900 flex items-center gap-3">
              <BarChart3 className="text-[#2563EB]" size={28} /> 
              Analytics & Reports
            </h1>
            <p className="text-gray-500 font-medium mt-1 text-sm">
              Generate final gradebooks and monitor exam eligibility.
            </p>
          </div>
          <select 
            value={selectedCourseCode} 
            onChange={(e) => setSelectedCourseCode(e.target.value)} 
            disabled={courses.length === 0} 
            className="bg-gray-50 border border-gray-200 text-gray-900 font-bold py-3 px-4 rounded-xl outline-none focus:ring-2 focus:ring-[#2563EB] shadow-sm min-w-[200px] cursor-pointer"
          >
            {courses.length === 0 ? (
              <option>No Courses Found</option>
            ) : (
              courses.map(c => <option key={c.id} value={c.course_code}>{c.course_code}</option>)
            )}
          </select>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* THE MASTER EXPORT WIDGET */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
              <div className="flex items-center gap-3 mb-6">
                <div className="bg-green-100 p-3 rounded-xl text-green-700">
                  <FileSpreadsheet size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-extrabold text-gray-900">Report Generator</h3>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                    Excel / CSV Format
                  </p>
                </div>
              </div>

              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                    From Date (Optional)
                  </label>
                  <div className="relative">
                    <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input 
                      type="date" 
                      value={startDate} 
                      onChange={(e) => setStartDate(e.target.value)} 
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 pl-10 pr-4 font-bold text-gray-700 outline-none focus:ring-2 focus:ring-green-500 transition-all" 
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                    To Date (Optional)
                  </label>
                  <div className="relative">
                    <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input 
                      type="date" 
                      value={endDate} 
                      onChange={(e) => setEndDate(e.target.value)} 
                      min={startDate} 
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 pl-10 pr-4 font-bold text-gray-700 outline-none focus:ring-2 focus:ring-green-500 transition-all" 
                    />
                  </div>
                </div>
              </div>

              <button 
                onClick={handleDownload} 
                disabled={isDownloading || !reportData} 
                className="w-full flex justify-center items-center gap-2 bg-gray-900 text-white font-bold py-4 rounded-xl hover:bg-gray-800 disabled:opacity-50 transition-all shadow-md active:scale-[0.98]"
              >
                {isDownloading ? <Loader2 size={20} className="animate-spin" /> : <Download size={20} />} 
                Download Gradebook
              </button>
            </div>
          </div>

          {/* EXAM ELIGIBILITY WATCHLIST */}
          <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-100 bg-gray-50">
              <div className="flex items-center gap-3">
                <AlertTriangle className="text-red-500" size={24} />
                <div>
                  <h3 className="font-extrabold text-gray-900 text-lg">Exam Eligibility Watchlist</h3>
                  <p className="text-xs text-gray-500 font-medium">Students below the 70% threshold based on selected dates.</p>
                </div>
              </div>
              <div className="bg-white px-4 py-2 rounded-lg border border-gray-200 shadow-sm text-center">
                <p className="text-2xl font-black text-gray-900">{reportData?.totalClasses || 0}</p>
                <p className="text-[10px] font-bold text-gray-400 uppercase">Classes Held</p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center h-64">
                  <Loader2 className="animate-spin text-[#2563EB]" size={32}/>
                  <p className="mt-4 font-bold text-gray-400">Crunching roster data...</p>
                </div>
              ) : errorMessage ? (
                <div className="flex flex-col items-center justify-center h-64 text-center p-6">
                  <Calendar size={48} className="text-gray-300 mb-4"/>
                  <p className="font-bold text-gray-500">{errorMessage}</p>
                </div>
              ) : atRiskStudents.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-center">
                  <CheckCircle size={48} className="text-green-300 mb-4"/>
                  <p className="font-bold text-green-700">All students are eligible for the exam!</p>
                </div>
              ) : (
                <table className="w-full text-left border-collapse whitespace-nowrap">
                  <thead>
                    <tr className="bg-white border-b border-gray-100 text-xs uppercase tracking-wider text-gray-400">
                      <th className="px-6 py-4 font-bold">Matric Number</th>
                      <th className="px-6 py-4 font-bold text-center">Classes Attended</th>
                      <th className="px-6 py-4 font-bold text-right">Current Standing</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {atRiskStudents.map((student: any, i: number) => (
                      <tr key={i} className="hover:bg-red-50/50 transition-colors">
                        <td className="px-6 py-4 font-black text-gray-900">{student.matricNumber}</td>
                        <td className="px-6 py-4 text-center font-bold text-gray-600">
                          {student.attended} / {student.totalClasses}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-black bg-red-100 text-red-700">
                            {student.percentage}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}