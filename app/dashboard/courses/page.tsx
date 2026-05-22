'use client';
import { useState, useEffect } from 'react';
import { supabase } from '../../../utils/supabase';
import { BookOpen, Upload, Users, Plus, Loader2, FileSpreadsheet, Layers } from 'lucide-react';

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

  useEffect(() => {
    fetchCourses();
  }, []);

  const fetchCourses = async () => {
    setIsLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { data, error } = await supabase
      .from('courses')
      .select('*')
      .eq('lecturer_id', session.user.id)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setCourses(data);
    }
    setIsLoading(false);
  };

  const createCourse = async () => {
    if (!newCourseCode.trim()) return;
    setIsCreating(true);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    // Instant creation without GPS dependency
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
    setIsCreating(false);
  };

  // --- UPDATED MULTI-CSV MERGE LOGIC ---
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, courseId: string, existingRoster: string[]) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingId(courseId);
    const reader = new FileReader();
    
    reader.onload = async (event) => {
      const csvText = event.target?.result as string;
      
      // Extract new matrics
      const rawMatrics = csvText.split(/[\n,]+/).map(m => m.trim().toUpperCase());
      const cleanMatrics = rawMatrics.filter(m => m.length > 5 && !m.includes('MATRIC'));
      
      // THE MAGIC: Merge the old roster with the new CSV, and remove duplicates using a Set
      const combinedRoster = [...(existingRoster || []), ...cleanMatrics];
      const uniqueMatrics = Array.from(new Set(combinedRoster));

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
      
      // Reset the file input so the same file can be selected again if needed
      e.target.value = '';
    };

    reader.readAsText(file);
  };

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-8">
      
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight flex items-center gap-3">
            <BookOpen className="text-[#2563EB]" size={28} /> Course Registry
          </h1>
          <p className="text-gray-500 mt-1 font-medium">Create your courses and merge official student rosters.</p>
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
        <h3 className="text-sm font-bold text-gray-700 mb-4 uppercase tracking-wider">Add New Course</h3>
        <div className="flex flex-col sm:flex-row gap-3">
          <input 
            type="text" 
            placeholder="Course Code (e.g., MTH 101)" 
            value={newCourseCode}
            onChange={(e) => setNewCourseCode(e.target.value)}
            className="flex-1 bg-gray-50 border border-gray-200 p-4 rounded-xl outline-none font-bold text-lg focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20 transition-all uppercase"
          />
          <button 
            onClick={createCourse}
            disabled={isCreating || !newCourseCode.trim()}
            className="whitespace-nowrap bg-gray-900 text-white px-8 py-4 rounded-xl font-bold text-sm hover:bg-gray-800 disabled:opacity-50 transition-all flex justify-center items-center gap-2 shadow-md"
          >
            {isCreating ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
            {isCreating ? "Creating..." : "Create Course"}
          </button>
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {courses.map(course => (
            <div key={course.id} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 hover:border-blue-200 transition-all flex flex-col justify-between">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight">{course.course_code}</h2>
                  <p className="text-xs font-bold text-green-600 mt-1 flex items-center gap-1 bg-green-50 px-2 py-1 rounded-md w-fit">
                    Active Registry
                  </p>
                </div>
                <div className="bg-blue-50 px-3 py-1.5 rounded-lg flex items-center gap-2 border border-blue-100">
                  <Users size={16} className="text-[#2563EB]" />
                  <span className="font-bold text-[#2563EB]">{course.roster?.length || 0}</span>
                </div>
              </div>

              <div className="pt-4 border-t border-gray-100">
                <label className="cursor-pointer flex items-center justify-center gap-2 w-full py-3 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl font-bold text-sm text-gray-700 transition-all">
                  {uploadingId === course.id ? (
                    <Loader2 size={16} className="animate-spin text-[#2563EB]" />
                  ) : (
                    <FileSpreadsheet size={16} className="text-[#2563EB]" />
                  )}
                  {uploadingId === course.id ? "Syncing Roster..." : "Merge CSV Class List"}
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