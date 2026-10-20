'use client';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/utils/supabase';
import * as XLSX from 'xlsx';
import {
  BookOpen, Users, Plus, Loader2, FileSpreadsheet, Trash2,
  Fingerprint, RefreshCw, UserPlus, Search, FileText,
  CheckCircle, AlertTriangle, ShieldCheck, Edit3, Info, ChevronDown, X
} from 'lucide-react';

interface Course {
  id: string;
  course_code: string;
  department: string;
  level: string;
  total_planned_classes: number;
  max_attendance_score: number;
  is_finalized: boolean;
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
  matric_number: string;
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

const DEPARTMENTS = ['CSC', 'MTH', 'PHY', 'CHM', 'BIO', 'ENG', 'LAW', 'MED', 'AGR', 'ECO'];
const LEVELS = ['100', '200', '300', '400', '500'];

// Regex to strictly find Matric Numbers (must contain a slash or hyphen)
const MATRIC_REGEX = /[\/\-]/; 

export default function CourseManagement() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [courseCounts, setCourseCounts] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);

  // Create Course State
  const [newCourseCode, setNewCourseCode] = useState('');
  const [newDept, setNewDept] = useState('');
  const [newLevel, setNewLevel] = useState('');
  const [plannedClasses, setPlannedClasses] = useState<number | ''>(15);
  const [maxScore, setMaxScore] = useState<number | ''>(10);
  const [isCreating, setIsCreating] = useState(false);

  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [actioningId, setActioningId] = useState<string | null>(null);

  // Modal State
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [editCode, setEditCode] = useState('');
  const [editPlanned, setEditPlanned] = useState<number | ''>(15);
  const [editMaxScore, setEditMaxScore] = useState<number | ''>(10);
  const [modalStudents, setModalStudents] = useState<string[]>([]);
  const [isLoadingStudents, setIsLoadingStudents] = useState(false);

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
    const id = setTimeout(() => { fetchCourses(); }, 0);
    return () => clearTimeout(id);
  }, [fetchCourses]);

  const createCourse = async () => {
    if (!newCourseCode.trim() || !plannedClasses || !maxScore || !newDept || !newLevel) return;
    setIsCreating(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      const { error } = await supabase.from('courses').insert([{
        lecturer_id: session.user.id,
        course_code: newCourseCode.toUpperCase(),
        department: newDept,
        level: newLevel,
        total_planned_classes: Number(plannedClasses),
        max_attendance_score: Number(maxScore),
        roster: [],
      }]);
      if (!error) {
        setNewCourseCode('');
        setPlannedClasses(15);
        setMaxScore(10);
        setNewDept('');
        setNewLevel('');
        await fetchCourses();
      } else {
        alert("Failed to create course.");
      }
    }
    setIsCreating(false);
  };

  const handleOpenModal = async (course: Course) => {
    setEditingCourse(course);
    setEditCode(course.course_code);
    setEditPlanned(course.total_planned_classes || 15);
    setEditMaxScore(course.max_attendance_score || 10);
    setIsLoadingStudents(true);
    setModalStudents([]);

    const { data, error } = await supabase
      .from('enrollments')
      .select('matric_number')
      .eq('course_id', course.id)
      .order('matric_number');
      
    if (!error && data) {
      setModalStudents(data.map(d => d.matric_number));
    }
    setIsLoadingStudents(false);
  };

  const handleSaveModal = async () => {
    if (!editingCourse || !editCode.trim() || !editPlanned || !editMaxScore) return;
    
    setActioningId(editingCourse.id);
    const { error } = await supabase
      .from('courses')
      .update({ 
        course_code: editCode.toUpperCase().trim(),
        total_planned_classes: Number(editPlanned),
        max_attendance_score: Number(editMaxScore)
      })
      .eq('id', editingCourse.id);
      
    if (error) alert(`Failed to update course: ${error.message}`);
    else {
      await fetchCourses();
      setEditingCourse(null);
    }
    setActioningId(null);
  };

  const handleDeleteCourse = async (courseId: string, courseCode: string) => {
    if (!window.confirm(`Are you sure you want to delete ${courseCode}?\n\nWARNING: This will permanently delete all enrollments, sessions, and attendance logs tied to this course. This cannot be undone.`)) return;
    
    setActioningId(courseId);
    const { error } = await supabase
      .from('courses')
      .delete()
      .eq('id', courseId);
      
    if (error) alert(`Failed to delete course: ${error.message}`);
    else await fetchCourses();
    
    setActioningId(null);
  };

  const handleRemoveStudent = async (matric: string) => {
    if (!editingCourse) return;
    if (!window.confirm(`Remove ${matric} from this course? Their past attendance logs will not be deleted.`)) return;
    
    const { error } = await supabase
      .from('enrollments')
      .delete()
      .eq('course_id', editingCourse.id)
      .eq('matric_number', matric);

    if (error) alert("Failed to remove student.");
    else {
      setModalStudents(prev => prev.filter(m => m !== matric));
      fetchEnrollmentCounts(courses.map(c => c.id));
    }
  };

  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    courseId: string
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingId(courseId);

    const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
    const reader = new FileReader();

    reader.onload = async (event) => {
      try {
        let rawMatrics: string[] = [];

        if (isExcel) {
          const data = new Uint8Array(event.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as string[][];
          
          jsonData.forEach(row => {
            row.forEach(cell => {
               // FIX: Only accept strings that look like matric numbers
               if (typeof cell === 'string' && cell.length > 5 && MATRIC_REGEX.test(cell) && !cell.includes('MATRIC')) {
                 rawMatrics.push(cell.trim().toUpperCase());
               }
            });
          });
        } else {
          const csvText = event.target?.result as string;
          const cleanMatrics = csvText
            .split(/[\n,]+/)
            .map(m => m.trim().toUpperCase())
            .filter(m => m.length > 5 && MATRIC_REGEX.test(m) && !m.includes('MATRIC'));
          rawMatrics = cleanMatrics;
        }

        const uniqueMatrics = Array.from(new Set(rawMatrics));

        if (uniqueMatrics.length === 0) {
          alert("No valid matric numbers found. Ensure your file has a format like CSC/2021/001 or CSC-2021-001.");
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
          if (editingCourse?.id === courseId) {
            handleOpenModal(editingCourse);
          }
        } else {
          alert(`Upload failed: ${error.message}`);
        }
      } catch {
        alert("Failed to read file. Ensure it is a valid CSV or Excel file.");
      }
      
      setUploadingId(null);
      e.target.value = '';
    };
    
    if (isExcel) {
      reader.readAsArrayBuffer(file);
    } else {
      reader.readAsText(file);
    }
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
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
              1. Establish New Course
              <div className="group relative cursor-pointer">
                <Info size={14} className="text-gray-400 hover:text-[#2563EB]" />
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 bg-gray-900 text-white text-xs font-medium p-3 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                  Define the course details. We use these to calculate the final 70% exam eligibility and CA scores.
                </div>
              </div>
            </h3>
            
            <div className="flex flex-col gap-2">
              <input
                type="text"
                placeholder="Course Code (e.g., MTH 101)"
                value={newCourseCode}
                onChange={(e) => setNewCourseCode(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 p-3 rounded-xl outline-none font-bold text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-[#2563EB] uppercase transition-all"
              />
              <div className="grid grid-cols-2 gap-2">
                <div className="relative">
                  <select
                    value={newDept}
                    onChange={(e) => setNewDept(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 p-3 rounded-xl outline-none font-bold text-gray-900 appearance-none cursor-pointer focus:ring-2 focus:ring-[#2563EB] transition-all"
                  >
                    <option value="" disabled>Select Dept</option>
                    {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                  <ChevronDown size={16} className="absolute right-3 top-3.5 text-gray-400 pointer-events-none" />
                </div>
                <div className="relative">
                  <select
                    value={newLevel}
                    onChange={(e) => setNewLevel(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 p-3 rounded-xl outline-none font-bold text-gray-900 appearance-none cursor-pointer focus:ring-2 focus:ring-[#2563EB] transition-all"
                  >
                    <option value="" disabled>Select Level</option>
                    {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                  <ChevronDown size={16} className="absolute right-3 top-3.5 text-gray-400 pointer-events-none" />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-2 mt-1">
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1 ml-1">Planned Lectures</label>
                  <input
                    type="number"
                    placeholder="15"
                    value={plannedClasses}
                    onChange={(e) => setPlannedClasses(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full bg-gray-50 border border-gray-200 p-3 rounded-xl outline-none font-bold text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-[#2563EB] transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1 ml-1">Max CA Marks</label>
                  <input
                    type="number"
                    placeholder="10"
                    value={maxScore}
                    onChange={(e) => setMaxScore(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full bg-gray-50 border border-gray-200 p-3 rounded-xl outline-none font-bold text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-[#2563EB] transition-all"
                  />
                </div>
              </div>

              <button
                onClick={createCourse}
                disabled={isCreating || !newCourseCode.trim() || !plannedClasses || !maxScore || !newDept || !newLevel}
                className="w-full bg-gray-900 text-white px-6 py-3 rounded-xl font-bold hover:bg-gray-800 disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-md mt-2"
              >
                {isCreating ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />} Create Course
              </button>
            </div>
          </div>

          {/* Add Single Student */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">2. Add Single Student (Late Reg)</h3>
            <div className="flex flex-col gap-2">
              <div className="relative">
                <select
                  value={targetCourseId}
                  onChange={(e) => setTargetCourseId(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 p-3 rounded-xl outline-none font-bold text-gray-900 appearance-none cursor-pointer focus:ring-2 focus:ring-[#2563EB] transition-all"
                >
                  {courses.map(c => <option key={c.id} value={c.id}>{c.course_code}</option>)}
                </select>
                <ChevronDown size={16} className="absolute right-3 top-3.5 text-gray-400 pointer-events-none" />
              </div>
              <div className="flex gap-2">
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
                  className="bg-[#2563EB] text-white px-5 py-3 rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50 transition-all flex items-center shadow-md shrink-0"
                >
                  {isAddingSingle ? <Loader2 size={18} className="animate-spin" /> : <UserPlus size={18} />}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Course Cards with CSV Upload & Edit/Delete */}
        {courses.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mt-8 pt-6 border-t border-gray-100">
            {courses.map(course => (
              <div key={course.id} className="bg-gray-50 p-4 rounded-xl border border-gray-200 relative group flex flex-col justify-between">
                
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h4 className="font-extrabold text-gray-900 text-lg">{course.course_code}</h4>
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                      {course.department || 'N/A'} • {course.level ? `${course.level}L` : 'N/A'}
                    </p>
                  </div>
                  
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                    <button onClick={() => handleDeleteCourse(course.id, course.course_code)} disabled={actioningId === course.id} className="p-1.5 bg-white text-gray-500 hover:text-red-600 rounded-md shadow-sm border border-gray-200">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                <div className="mb-4">
                  <p className="text-xs font-bold text-gray-600">{course.total_planned_classes} Planned Classes • {course.max_attendance_score} CA Marks</p>
                  <p className="text-xs font-bold text-[#2563EB] mt-1">{courseCounts[course.id] || 0} Students Enrolled</p>
                </div>
                
                <div className="flex gap-2">
                  <button 
                    onClick={() => handleOpenModal(course)} 
                    className="flex-1 bg-white border border-gray-200 text-gray-700 py-2 rounded-lg font-bold text-xs hover:bg-gray-100 transition-all shadow-sm flex items-center justify-center gap-1"
                  >
                    <Edit3 size={12} /> Manage
                  </button>
                  <label className="flex-1 cursor-pointer flex items-center justify-center gap-1 bg-blue-50 border border-blue-200 text-blue-700 py-2 rounded-lg font-bold text-xs hover:bg-blue-100 transition-all shadow-sm">
                    {uploadingId === course.id
                      ? <Loader2 size={12} className="animate-spin text-[#2563EB]" />
                      : <FileSpreadsheet size={12} />}
                    {uploadingId === course.id ? "Syncing..." : "Upload"}
                    <input
                      type="file"
                      accept=".csv, .xlsx, .xls"
                      className="hidden"
                      onChange={(e) => handleFileUpload(e, course.id)}
                      disabled={uploadingId === course.id}
                    />
                  </label>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* MODAL: EDIT COURSE & MANAGE STUDENTS */}
      {editingCourse && (
        <div className="fixed inset-0 bg-gray-900/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-xl border border-gray-100 w-full max-w-2xl max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-200">
            
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50 rounded-t-3xl">
              <div>
                <h2 className="text-xl font-black text-gray-900">{editingCourse.course_code}</h2>
                <p className="text-xs font-bold text-gray-500 uppercase">
                  {editingCourse.department || 'N/A'} • {editingCourse.level ? `${editingCourse.level}L` : 'N/A'}
                </p>
              </div>
              <button onClick={() => setEditingCourse(null)} className="p-2 bg-white rounded-full text-gray-400 hover:text-gray-900 shadow-sm border border-gray-200 transition-all">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              {/* Edit Course Details */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-gray-800 border-b border-gray-100 pb-2">Course Details</h3>
                
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">Course Code</label>
                  <input type="text" value={editCode} onChange={(e) => setEditCode(e.target.value.toUpperCase())} className="w-full bg-gray-50 border border-gray-200 p-3 rounded-xl outline-none font-bold text-gray-900 focus:ring-2 focus:ring-[#2563EB] transition-all uppercase" />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">Planned Lectures</label>
                    <input type="number" value={editPlanned} onChange={(e) => setEditPlanned(e.target.value === '' ? '' : Number(e.target.value))} className="w-full bg-gray-50 border border-gray-200 p-3 rounded-xl outline-none font-bold text-gray-900 focus:ring-2 focus:ring-[#2563EB] transition-all" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">Max CA Marks</label>
                    <input type="number" value={editMaxScore} onChange={(e) => setEditMaxScore(e.target.value === '' ? '' : Number(e.target.value))} className="w-full bg-gray-50 border border-gray-200 p-3 rounded-xl outline-none font-bold text-gray-900 focus:ring-2 focus:ring-[#2563EB] transition-all" />
                  </div>
                </div>

                <button onClick={handleSaveModal} disabled={actioningId === editingCourse.id} className="w-full bg-gray-900 text-white font-bold py-3 rounded-xl hover:bg-gray-800 transition-all shadow-md active:scale-[0.98]">
                  {actioningId === editingCourse.id ? <Loader2 size={18} className="animate-spin mx-auto" /> : "Save Changes"}
                </button>
              </div>

              {/* Manage Students */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-gray-800 border-b border-gray-100 pb-2 flex justify-between items-center">
                  Enrolled Students
                  <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-[10px]">{modalStudents.length}</span>
                </h3>
                
                {isLoadingStudents ? (
                  <div className="flex justify-center py-6"><Loader2 className="animate-spin text-[#2563EB]" size={24} /></div>
                ) : modalStudents.length === 0 ? (
                  <p className="text-center text-gray-500 text-sm font-medium py-4">No students enrolled yet.</p>
                ) : (
                  <div className="max-h-60 overflow-y-auto border border-gray-100 rounded-xl divide-y divide-gray-50">
                    {modalStudents.map(matric => (
                      <div key={matric} className="p-3 flex justify-between items-center hover:bg-gray-50 transition-colors">
                        <span className="font-bold text-gray-800 text-sm">{matric}</span>
                        <button onClick={() => handleRemoveStudent(matric)} className="text-red-500 hover:text-red-700 p-1.5 hover:bg-red-50 rounded-lg transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

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