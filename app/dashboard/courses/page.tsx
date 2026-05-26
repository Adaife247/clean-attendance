'use client';
import { useState, useEffect } from 'react';
import { supabase } from '../../../utils/supabase';
import { 
  BookOpen, 
  Users, 
  Plus, 
  Loader2, 
  FileSpreadsheet, 
  Layers, 
  Trash2, 
  Fingerprint, 
  RefreshCw 
} from 'lucide-react';

interface Course { 
  id: string; 
  course_code: string; 
  roster: string[]; 
}

export default function CourseManagement() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [newCourseCode, setNewCourseCode] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  const [wipeMatric, setWipeMatric] = useState('');
  const [isWiping, setIsWiping] = useState(false);

  useEffect(() => { 
    fetchCourses(); 
  }, []);

  const fetchCourses = async () => {
    setIsLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) return;
    
    const { data } = await supabase
      .from('courses')
      .select('*')
      .eq('lecturer_id', session.user.id)
      .order('created_at', { ascending: false });
      
    if (data) setCourses(data);
    
    setIsLoading(false);
  };

  const createCourse = async () => {
    if (!newCourseCode.trim()) return;
    setIsCreating(true);
    
    const { data: { session } } = await supabase.auth.getSession();
    
    if (session) {
      const { error } = await supabase.from('courses').insert([{ 
        lecturer_id: session.user.id, 
        course_code: newCourseCode.toUpperCase(), 
        roster: [] 
      }]);
      
      if (!error) { 
        setNewCourseCode(''); 
        fetchCourses(); 
      } else {
        alert("Failed to create course.");
      }
    }
    
    setIsCreating(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, courseId: string, existingRoster: string[]) => {
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
        
      const uniqueMatrics = Array.from(new Set([...(existingRoster || []), ...cleanMatrics]));
      
      const { error } = await supabase
        .from('courses')
        .update({ roster: uniqueMatrics })
        .eq('id', courseId);
        
      if (!error) { 
        alert(`Success! Course roster now has ${uniqueMatrics.length} total students.`); 
        fetchCourses(); 
      } else {
        alert("Failed to upload roster.");
      }
      
      setUploadingId(null);
      e.target.value = '';
    };
    
    reader.readAsText(file);
  };

  const handleDeviceReset = async () => {
    const safeMatric = String(wipeMatric || "").trim();
    if (!safeMatric) return;
    
    if (!window.confirm(`Wipe biometric hardware lock for ${safeMatric}? They will need to re-register on a new phone.`)) {
        return;
    }
    
    setIsWiping(true);
    
    try {
      const response = await fetch('/api/reset-device', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ matricNumber: safeMatric }) 
      });
      
      if (response.ok) { 
        alert(`✅ Hardware binding completely wiped for ${safeMatric}.`); 
        setWipeMatric(''); 
      } else {
        alert("⚠️ Failed to wipe device.");
      }
    } catch (err) { 
      alert("💥 Network Error."); 
    } finally { 
      setIsWiping(false); 
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-8 bg-gray-50 min-h-screen">
      
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight flex items-center gap-3">
          <Users className="text-[#2563EB]" size={28} /> Student Management
        </h1>
        <p className="text-gray-500 mt-1 font-medium">Create courses, sync class lists, and manage student hardware exceptions.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* ADD COURSE WIDGET */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-gray-700 mb-1 uppercase tracking-wider flex items-center gap-2">
              <BookOpen size={16} className="text-[#2563EB]"/> Add New Course
            </h3>
            <p className="text-xs text-gray-500 mb-4">Register a new class into your active ledger.</p>
          </div>
          <div className="flex gap-2">
            <input 
              type="text" 
              placeholder="e.g., MTH 101" 
              value={newCourseCode} 
              onChange={(e) => setNewCourseCode(e.target.value)} 
              className="w-full bg-gray-50 border border-gray-200 p-3 rounded-xl outline-none font-bold focus:ring-2 focus:ring-[#2563EB] uppercase transition-all" 
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

        {/* GLOBAL BIOMETRIC WIPE WIDGET */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-red-200 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-red-700 mb-1 uppercase tracking-wider flex items-center gap-2">
              <Fingerprint size={16}/> Wipe Device Lock
            </h3>
            <p className="text-xs text-gray-500 mb-4">Use this if a student lost their phone and needs to register a new one.</p>
          </div>
          <div className="flex gap-2">
            <input 
              type="text" 
              placeholder="Matric Number" 
              value={wipeMatric} 
              onChange={(e) => setWipeMatric(e.target.value.toUpperCase())} 
              className="w-full bg-gray-50 border border-gray-200 p-3 rounded-xl outline-none font-bold focus:ring-2 focus:ring-red-500 uppercase transition-all" 
            />
            <button 
              onClick={handleDeviceReset} 
              disabled={isWiping || !wipeMatric.trim()} 
              className="bg-red-50 text-red-600 border border-red-200 px-6 py-3 rounded-xl font-bold hover:bg-red-100 disabled:opacity-50 transition-all flex items-center shadow-sm"
            >
              {isWiping ? <RefreshCw size={18} className="animate-spin" /> : <Trash2 size={18} />}
            </button>
          </div>
        </div>

      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 text-[#2563EB] animate-spin" />
        </div>
      ) : courses.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-gray-300">
          <Layers className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No courses established yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {courses.map(course => (
            <div key={course.id} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 transition-all flex flex-col justify-between">
              
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-xl font-extrabold text-gray-900 tracking-tight">{course.course_code}</h2>
                </div>
                <div className="bg-blue-50 px-3 py-1 rounded-lg flex items-center gap-1.5 border border-blue-100 text-xs">
                  <Users size={14} className="text-[#2563EB]" />
                  <span className="font-bold text-[#2563EB]">{course.roster?.length || 0}</span>
                </div>
              </div>
              
              <div className="pt-4 border-t border-gray-100">
                <label className="cursor-pointer flex items-center justify-center gap-2 w-full py-2.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl font-bold text-xs text-gray-700 transition-all shadow-sm">
                  {uploadingId === course.id ? (
                    <Loader2 size={14} className="animate-spin text-[#2563EB]" />
                  ) : (
                    <FileSpreadsheet size={14} className="text-[#2563EB]" />
                  )}
                  {uploadingId === course.id ? "Syncing Roster..." : "Upload CSV Roster"}
                  <input 
                    type="file" 
                    accept=".csv" 
                    className="hidden" 
                    onChange={(e) => handleFileUpload(e, course.id, course.roster)} 
                    disabled={uploadingId === course.id} 
                  />
                </label>
              </div>

            </div>
          ))}
        </div>
      )}
    </div>
  );
}