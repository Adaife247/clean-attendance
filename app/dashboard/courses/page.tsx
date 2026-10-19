'use client';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/utils/supabase';
import {
  BookOpen, Users, Plus, Loader2, FileSpreadsheet, Trash2,
  Fingerprint, RefreshCw, UserPlus, Search, FileText,
  CheckCircle, AlertTriangle, ShieldCheck
} from 'lucide-react';

interface Course {
  id: string;
  course_code: string;
  roster: string[] | null;
}

interface AuditRecord {
  sessionId: string;
  date: string;
  status: string;
  logId: string | null;
}

interface EnrollmentRow {
  course_id: string;
}

interface SessionRow {
  session_id: string;
  created_at: string;
}

interface LogRow {
  id: string;
  session_id: string;
  status: string;
}

export default function CourseManagement() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [courseCounts, setCourseCounts] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);

  const [newCourseCode, setNewCourseCode] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  // Single Student Add
  const [singleMatric, setSingleMatric] = useState('');
  const [targetCourseId, setTargetCourseId] = useState('');
  const [isAddingSingle, setIsAddingSingle] = useState(false);

  // The Microscope (Audit & Waivers)
  const [auditMatric, setAuditMatric] = useState('');
  const [auditCourseCode, setAuditCourseCode] = useState('');
  const [isAuditing, setIsAuditing] = useState(false);
  const [auditRecords, setAuditRecords] = useState<AuditRecord[] | null>(null);

  // Device Wipe
  const [wipeMatric, setWipeMatric] = useState('');
  const [isWiping, setIsWiping] = useState(false);

  const fetchEnrollmentCounts = useCallback(async (courseIds: string[]) => {
    if (courseIds.length === 0) {
      setCourseCounts({});
      return;
    }
    const { data, error } = await supabase
      .from('enrollments')
      .select('course_id')
      .in('course_id', courseIds);

    if (error || !data) return;

    const counts: Record<string, number> = {};
    (data as EnrollmentRow[]).forEach(row => {
      counts[row.course_id] = (counts[row.course_id] || 0) + 1;
    });
    setCourseCounts(counts);
  }, []);

  const fetchCourses = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setIsLoading(false);
      return;
    }

    const { data } = await supabase
      .from('courses')
      .select('*')
      .eq('lecturer_id', session.user.id)
      .order('created_at', { ascending: false });

    if (data) {
      setCourses(data);
      if (data.length > 0) {
        setTargetCourseId(data[0].id);
        setAuditCourseCode(data[0].course_code);
        await fetchEnrollmentCounts(data.map(c => c.id));
      }
    }
    setIsLoading(false);
  }, [fetchEnrollmentCounts]);

  useEffect(() => {
    // Defer to next tick so setState inside fetchCourses doesn't run synchronously
    // within the effect. Satisfies React 19's set-state-in-effect rule.
    const id = setTimeout(() => { fetchCourses(); }, 0);
    return () => clearTimeout(id);
  }, [fetchCourses]);

  const createCourse = async () => {
    if (!newCourseCode.trim()) return;
    setIsCreating(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      const { error } = await supabase.from('courses').insert([{
        lecturer_id: session.user.id,
        course_code: newCourseCode.toUpperCase(),
        roster: [],
      }]);
      if (!error) {
        setNewCourseCode('');
        await fetchCourses();
      } else {
        alert("Failed to create course.");
      }
    }
    setIsCreating(false);
  };

  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    courseId: string
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingId(courseId);

    const reader = new FileReader();
    reader.onload = async (event) => {
      const csvText = event.target?.result as string;
      const cleanMatrics = csvText
        .split(/[\n,]+/)
        .map(m => m.trim().toUpperCase())
        .filter(m => m.length > 5 && !m.includes('MATRIC'));

      const uniqueMatrics = Array.from(new Set(cleanMatrics));

      if (uniqueMatrics.length === 0) {
        alert("No valid matric numbers found in the file.");
        setUploadingId(null);
        e.target.value = '';
        return;
      }

      const rows = uniqueMatrics.map(matric => ({
        course_id: courseId,
        matric_number: matric,
      }));

      const { error } = await supabase
        .from('enrollments')
        .upsert(rows, { onConflict: 'course_id,matric_number', ignoreDuplicates: true });

      if (!error) {
        alert(`Success! ${uniqueMatrics.length} students synced.`);
        await fetchCourses();
      } else {
        alert(`Upload failed: ${error.message}`);
      }
      setUploadingId(null);
      e.target.value = '';
    };
    reader.readAsText(file);
  };

  const handleSingleStudentAdd = async () => {
    const cleanMatric = singleMatric.trim().toUpperCase();
    if (!cleanMatric || !targetCourseId) return;
    setIsAddingSingle(true);

    const { error } = await supabase
      .from('enrollments')
      .upsert(
        { course_id: targetCourseId, matric_number: cleanMatric },
        { onConflict: 'course_id,matric_number', ignoreDuplicates: true }
      );

    if (!error) {
      alert(`${cleanMatric} added successfully!`);
      setSingleMatric('');
      await fetchCourses();
    } else {
      alert(`Failed to add student: ${error.message}`);
    }
    setIsAddingSingle(false);
  };

  const handleStudentAudit = useCallback(async () => {
    const cleanMatric = auditMatric.trim().toUpperCase();
    if (!cleanMatric || !auditCourseCode) return;
    setIsAuditing(true);
    setAuditRecords(null);

    try {
      const { data: sessions } = await supabase
        .from('lecture_sessions')
        .select('session_id, created_at')
        .ilike('course_code', auditCourseCode)
        .order('created_at', { ascending: false });

      if (!sessions || sessions.length === 0) throw new Error("No classes held yet.");

      const sessionIds = (sessions as SessionRow[]).map(s => s.session_id);

      const { data: logs } = await supabase
        .from('attendance_logs')
        .select('id, session_id, status')
        .eq('matric_number', cleanMatric)
        .in('session_id', sessionIds);

      const logMap = new Map<string, LogRow>(
        ((logs as LogRow[] | null) || []).map(l => [l.session_id, l])
      );

      const trail: AuditRecord[] = (sessions as SessionRow[]).map(session => {
        const log = logMap.get(session.session_id);
        return {
          sessionId: session.session_id,
          date: new Date(session.created_at).toLocaleDateString() + ' ' +
                new Date(session.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          status: log ? log.status : 'absent',
          logId: log ? log.id : null,
        };
      });

      setAuditRecords(trail);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Audit failed.";
      alert(msg);
    }
    setIsAuditing(false);
  }, [auditMatric, auditCourseCode]);

  const grantMedicalWaiver = async (record: AuditRecord) => {
    const cleanMatric = auditMatric.trim().toUpperCase();
    if (!window.confirm(`Grant Medical/Excused Waiver for ${cleanMatric} on ${record.date}? This will count them as present.`)) return;

    try {
      if (record.logId) {
        await supabase.from('attendance_logs').update({
          status: 'verified',
          device_info: JSON.stringify({ method: "Medical Waiver / Excused" }),
        }).eq('id', record.logId);
      } else {
        await supabase.from('attendance_logs').insert([{
          session_id: record.sessionId,
          matric_number: cleanMatric,
          status: 'verified',
          device_info: JSON.stringify({ method: "Medical Waiver / Excused" }),
          device_hash: 'admin-waiver',
        }]);
      }
      alert("Waiver Granted successfully!");
      handleStudentAudit();
    } catch {
      alert("Failed to grant waiver.");
    }
  };

  const handleDeviceReset = async () => {
    const safeMatric = String(wipeMatric || "").trim();
    if (!safeMatric) return;
    if (!window.confirm(`Wipe biometric hardware lock for ${safeMatric}? They will need to re-register on a new phone.`)) return;
    setIsWiping(true);
    try {
      const response = await fetch('/api/reset-device', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matricNumber: safeMatric }),
      });
      if (response.ok) {
        alert(`✅ Hardware binding completely wiped for ${safeMatric}.`);
        setWipeMatric('');
      } else {
        alert("⚠️ Failed to wipe device.");
      }
    } catch {
      alert("💥 Network Error.");
    } finally {
      setIsWiping(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-10 h-10 text-[#2563EB] animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6 bg-gray-50 min-h-screen">

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
        <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight flex items-center gap-3">
          <Users className="text-[#2563EB]" size={28} /> Course & Student Management
        </h1>
        <p className="text-gray-500 mt-1 font-medium">
          Manage course rosters, grant medical waivers, and wipe device locks.
        </p>
      </div>

      {/* SECTION 1: COURSE REGISTRY */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
        <div className="flex items-center gap-2 mb-6 border-b border-gray-100 pb-4">
          <BookOpen className="text-gray-400" size={20}/>
          <h2 className="text-lg font-bold text-gray-900">Course Registry & Rosters</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Create Course */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">1. Establish New Course</h3>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="e.g., MTH 101"
                value={newCourseCode}
                onChange={(e) => setNewCourseCode(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 p-3 rounded-xl outline-none font-bold text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-[#2563EB] uppercase transition-all"
              />
              <button
                onClick={createCourse}
                disabled={isCreating || !newCourseCode.trim()}
                className="bg-gray-900 text-white px-6 py-3 rounded-xl font-bold hover:bg-gray-800 disabled:opacity-50 transition-all flex items-center shadow-md"
              >
                {isCreating ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
              </button>
            </div>
          </div>

          {/* Add Single Student */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">2. Add Single Student (Late Reg)</h3>
            <div className="flex gap-2">
              <select
                value={targetCourseId}
                onChange={(e) => setTargetCourseId(e.target.value)}
                className="w-1/3 bg-gray-50 border border-gray-200 p-3 rounded-xl outline-none font-bold text-gray-900 cursor-pointer"
              >
                {courses.map(c => <option key={c.id} value={c.id}>{c.course_code}</option>)}
              </select>
              <input
                type="text"
                placeholder="Matric Number"
                value={singleMatric}
                onChange={(e) => setSingleMatric(e.target.value.toUpperCase())}
                className="w-full bg-gray-50 border border-gray-200 p-3 rounded-xl outline-none font-bold text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-[#2563EB] uppercase transition-all"
              />
              <button
                onClick={handleSingleStudentAdd}
                disabled={isAddingSingle || !singleMatric.trim()}
                className="bg-[#2563EB] text-white px-5 py-3 rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50 transition-all flex items-center shadow-md"
              >
                {isAddingSingle ? <Loader2 size={18} className="animate-spin" /> : <UserPlus size={18} />}
              </button>
            </div>
          </div>
        </div>

        {/* Course Cards with CSV Upload */}
        {courses.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8 pt-6 border-t border-gray-100">
            {courses.map(course => (
              <div key={course.id} className="bg-gray-50 p-4 rounded-xl border border-gray-200 text-center">
                <h4 className="font-extrabold text-gray-900 mb-1">{course.course_code}</h4>
                <p className="text-xs font-bold text-gray-500 mb-3">
                  {courseCounts[course.id] || 0} Students
                </p>
                <label className="cursor-pointer flex items-center justify-center gap-1 w-full py-2 bg-white border border-gray-200 rounded-lg font-bold text-[10px] text-gray-700 hover:bg-gray-100 transition-all shadow-sm">
                  {uploadingId === course.id
                    ? <Loader2 size={12} className="animate-spin text-[#2563EB]" />
                    : <FileSpreadsheet size={12} className="text-[#2563EB]" />}
                  {uploadingId === course.id ? "Syncing..." : "Upload CSV"}
                  <input
                    type="file"
                    accept=".csv"
                    className="hidden"
                    onChange={(e) => handleFileUpload(e, course.id)}
                    disabled={uploadingId === course.id}
                  />
                </label>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* SECTION 2: THE MICROSCOPE */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
        <div className="flex items-center gap-2 mb-6 border-b border-gray-100 pb-4">
          <Search className="text-[#2563EB]" size={20}/>
          <h2 className="text-lg font-bold text-gray-900">Student Diagnostics & Waivers</h2>
        </div>

        <div className="flex flex-col md:flex-row gap-3 mb-6">
          <select
            value={auditCourseCode}
            onChange={(e) => setAuditCourseCode(e.target.value)}
            className="md:w-48 bg-gray-50 border border-gray-200 p-3 rounded-xl outline-none font-bold text-gray-900 cursor-pointer"
          >
            {courses.map(c => <option key={c.id} value={c.course_code}>{c.course_code}</option>)}
          </select>
          <div className="flex-1 flex gap-2">
            <input
              type="text"
              placeholder="Search Matric Number (e.g., CSC/2021/001)"
              value={auditMatric}
              onChange={(e) => setAuditMatric(e.target.value.toUpperCase())}
              className="w-full bg-gray-50 border border-gray-200 p-3 rounded-xl outline-none font-bold text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-[#2563EB] uppercase transition-all"
            />
            <button
              onClick={handleStudentAudit}
              disabled={isAuditing || !auditMatric.trim()}
              className="bg-gray-900 text-white px-8 py-3 rounded-xl font-bold hover:bg-gray-800 disabled:opacity-50 transition-all flex items-center gap-2 shadow-md"
            >
              {isAuditing ? <Loader2 size={18} className="animate-spin" /> : <FileText size={18} />}
              View Record
            </button>
          </div>
        </div>

        {auditRecords && (
          <div className="bg-gray-50 rounded-xl border border-gray-200 overflow-hidden animate-in fade-in slide-in-from-bottom-4">
            <div className="p-4 border-b border-gray-200 bg-white">
              <h3 className="font-extrabold text-gray-900 text-lg">Audit Trail: {auditMatric}</h3>
              <p className="text-xs text-gray-500 font-bold">{auditCourseCode} Semester History</p>
            </div>
            <div className="max-h-80 overflow-y-auto p-4 space-y-2">
              {auditRecords.map((record, i) => (
                <div key={i} className="bg-white border border-gray-100 p-3 rounded-lg flex justify-between items-center shadow-sm">
                  <div>
                    <p className="font-bold text-gray-900 text-sm">{record.date}</p>
                    <div className="mt-1">
                      {record.status === 'verified' ? (
                        <span className="text-[10px] uppercase font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded-md flex items-center gap-1 w-fit">
                          <CheckCircle size={10}/> Attended / Excused
                        </span>
                      ) : record.status === 'absent' ? (
                        <span className="text-[10px] uppercase font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md">
                          Absent
                        </span>
                      ) : (
                        <span className="text-[10px] uppercase font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded-md flex items-center gap-1 w-fit">
                          <AlertTriangle size={10}/> Flagged
                        </span>
                      )}
                    </div>
                  </div>
                  {record.status !== 'verified' && (
                    <button
                      onClick={() => grantMedicalWaiver(record)}
                      className="bg-orange-50 text-orange-700 border border-orange-200 px-4 py-2 rounded-lg font-bold text-xs hover:bg-orange-100 transition-colors flex items-center gap-1.5 shadow-sm"
                    >
                      <ShieldCheck size={14}/> Grant Medical Waiver
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* SECTION 3: HARDWARE SECURITY */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-red-200">
        <div className="flex items-center gap-2 mb-4 border-b border-red-100 pb-3">
          <Fingerprint className="text-red-500" size={20}/>
          <h2 className="text-lg font-bold text-red-700">Wipe Device Lock</h2>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          Use this only if a student lost their phone and needs to register biometrics on a new device. Their attendance history will remain intact.
        </p>

        <div className="flex max-w-lg gap-2">
          <input
            type="text"
            placeholder="Matric Number"
            value={wipeMatric}
            onChange={(e) => setWipeMatric(e.target.value.toUpperCase())}
            className="w-full bg-red-50/50 border border-red-100 p-3 rounded-xl outline-none font-bold text-red-900 placeholder:text-red-300 focus:ring-2 focus:ring-red-500 uppercase transition-all"
          />
          <button
            onClick={handleDeviceReset}
            disabled={isWiping || !wipeMatric.trim()}
            className="bg-red-50 text-red-600 border border-red-200 px-8 py-3 rounded-xl font-bold hover:bg-red-100 disabled:opacity-50 transition-all flex items-center gap-2 shadow-sm whitespace-nowrap"
          >
            {isWiping ? <RefreshCw size={18} className="animate-spin" /> : <Trash2 size={18} />}
            Wipe Device
          </button>
        </div>
      </div>

    </div>
  );
}