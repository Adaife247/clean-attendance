'use client';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/utils/supabase';
import { X, AlertTriangle } from 'lucide-react';

interface AvailableCourse {
  id: string;
  course_code: string;
  department: string;
  level: string;
}

interface EnrollModalProps {
  isOpen: boolean;
  onClose: () => void;
  matricNumber: string;
  studentDept: string;
  studentLevel: string;
  onEnrolled: () => void;
  addToast: (title: string, description?: string, type?: 'success' | 'error' | 'info') => void;
}

export default function EnrollModal({
  isOpen,
  onClose,
  matricNumber,
  studentDept,
  studentLevel,
  onEnrolled,
  addToast,
}: EnrollModalProps) {
  const [availableCourses, setAvailableCourses] = useState<AvailableCourse[]>([]);
  const [isEnrolling, setIsEnrolling] = useState<string | null>(null);

  const fetchAvailableCourses = useCallback(async () => {
    if (!studentDept || !studentLevel) return;

    const { data: allCourses } = await supabase
      .from('courses')
      .select('id, course_code, department, level')
      .eq('department', studentDept)
      .eq('level', studentLevel);

    if (allCourses) {
      const { data: enrolled } = await supabase
        .from('enrollments')
        .select('course_id')
        .eq('matric_number', matricNumber.toUpperCase().trim());

      const enrolledIds = new Set(enrolled?.map(e => e.course_id) || []);
      const available = allCourses.filter(c => !enrolledIds.has(c.id));

      setAvailableCourses(available);
    }
  }, [studentDept, studentLevel, matricNumber]);

    useEffect(() => {
    if (!isOpen) return;
    const id = setTimeout(() => {
      setAvailableCourses([]);
      fetchAvailableCourses();
    }, 0);
    return () => clearTimeout(id);
  }, [isOpen, fetchAvailableCourses]);

  const handleEnroll = async (courseId: string, courseCode: string) => {
    setIsEnrolling(courseId);
    try {
      const { error } = await supabase.from('enrollments').insert([{
        course_id: courseId,
        matric_number: matricNumber.toUpperCase().trim(),
      }]);
      if (error) throw error;
      addToast('Enrolled successfully', `You are now enrolled in ${courseCode}.`, 'success');
      onEnrolled();
      onClose();
    } catch {
      addToast('Enrollment failed', 'Please try again.', 'error');
    } finally {
      setIsEnrolling(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-900/60 dark:bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm transition-colors">
      <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-xl border border-gray-100 dark:border-gray-800 w-full max-w-md max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-200">
        <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/50 rounded-t-3xl">
          <div>
            <h2 className="text-xl font-black text-gray-900 dark:text-white">Enroll in Class</h2>
            <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Link to a lecturer&apos;s roster</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 bg-white dark:bg-gray-800 rounded-full text-gray-400 dark:text-gray-500 hover:text-gray-900 dark:hover:text-white shadow-sm border border-gray-200 dark:border-gray-700 transition-all"
          >
            <X size={20} />
          </button>
        </div>
        <div className="p-6 overflow-y-auto space-y-4">
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3 flex items-start gap-2 transition-colors">
            <AlertTriangle size={16} className="text-amber-600 dark:text-amber-500 shrink-0 mt-0.5" />
            <p className="text-sm text-amber-800 dark:text-amber-300 font-medium leading-relaxed">
              <strong>Please note:</strong> Enrolling here only links you to your lecturer&apos;s attendance roster. It does <strong>NOT</strong> replace your official university course registration.
            </p>
          </div>

          {(!studentDept || !studentLevel) ? (
            <div className="text-center p-6 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl">
              <p className="text-sm font-bold text-yellow-800 dark:text-yellow-400">
                Please set your Department and Level in the Dashboard first.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {availableCourses.length === 0 ? (
                <p className="text-center text-sm text-gray-500 dark:text-gray-400 py-4">
                  No new courses available for {studentDept} {studentLevel}.
                </p>
              ) : (
                availableCourses.map(course => (
                  <div
                    key={course.id}
                    className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-800 p-4 rounded-xl flex justify-between items-center transition-colors"
                  >
                    <div>
                      <p className="font-bold text-gray-900 dark:text-white text-sm">{course.course_code}</p>
                      <p className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">
                        {course.department} • Level {course.level}
                      </p>
                    </div>
                    <button
                      onClick={() => handleEnroll(course.id, course.course_code)}
                      disabled={isEnrolling === course.id}
                      className="bg-[#2563EB] text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-blue-700 transition-colors disabled:opacity-50"
                    >
                      {isEnrolling === course.id ? 'Joining...' : 'Enroll'}
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}