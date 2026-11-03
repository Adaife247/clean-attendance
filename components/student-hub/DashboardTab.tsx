'use client';
import { 
  BellRing, Edit3, Save, ChevronDown, BookOpen, 
  CheckCircle, Plus, FileText 
} from 'lucide-react';;

interface CourseRecord {
  course_code: string;
  total_held: number;
  total_planned: number;
  attended_classes: number;
  percentage: number;
  skips_left: number;
  streak: number;
  streak_tier: 'JJC' | 'Consistent' | 'Odogwu' | 'None';
  is_finalized: boolean;
  ca_score: string | null;
  max_score: number;
  active_session_id: string | null;
}

interface HistoryRow {
  session_id: string;
  course_code: string;
  created_at: string;
  is_active: boolean;
  expires_at: string | null;
  status: string;
}

const DEPARTMENTS = ['CSC', 'MTH', 'PHY', 'CHM', 'BIO', 'ENG', 'LAW', 'MED', 'AGR', 'ECO'];
const LEVELS = ['100', '200', '300', '400', '500'];

interface DashboardTabProps {
  records: CourseRecord[] | null;
  history: HistoryRow[] | null;
  nickname: string;
  setNickname: (v: string) => void;
  savedNickname: string;
  isEditingNickname: boolean;
  setIsEditingNickname: (v: boolean) => void;
  studentDept: string;
  setStudentDept: (v: string) => void;
  studentLevel: string;
  setStudentLevel: (v: string) => void;
  saveProfile: () => Promise<void>;
  setShowEnrollModal: (v: boolean) => void;
  isSupported: boolean;
  permission: NotificationPermission;
  isSubscribed: boolean;
  subscribe: () => void;
}

export default function DashboardTab({
  records,
  history,
  nickname,
  setNickname,
  savedNickname,
  isEditingNickname,
  setIsEditingNickname,
  studentDept,
  setStudentDept,
  studentLevel,
  setStudentLevel,
  saveProfile,
  setShowEnrollModal,
  isSupported,
  permission,
  isSubscribed,
  subscribe,
}: DashboardTabProps) {
  
  const getShieldColor = (pct: number) => {
    if (pct >= 70) return { bar: 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]', text: 'text-emerald-700 dark:text-emerald-400', bg: 'bg-emerald-50/50 dark:bg-emerald-900/20', border: 'border-emerald-200 dark:border-emerald-800' };
    if (pct >= 50) return { bar: 'bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.5)]', text: 'text-amber-700 dark:text-amber-400', bg: 'bg-amber-50/50 dark:bg-amber-900/20', border: 'border-amber-200 dark:border-amber-800' };
    return { bar: 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]', text: 'text-red-700 dark:text-red-400', bg: 'bg-red-50/50 dark:bg-red-900/20', border: 'border-red-200 dark:border-red-800' };
  };

  if (!records) return null;

  return (
    <div className="space-y-5 animate-in fade-in">
      
      {isSupported && permission !== 'granted' && !isSubscribed && (
        <div className="bg-gray-900 dark:bg-gray-800 text-white p-4 rounded-2xl flex items-center justify-between mb-4 animate-in slide-in-from-top-4 shadow-lg border border-transparent dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-2 rounded-full"><BellRing size={20} /></div>
            <div>
              <p className="font-bold text-sm">Never miss a class</p>
              <p className="text-[10px] text-gray-300">Enable alerts for when class starts.</p>
            </div>
          </div>
          <button onClick={subscribe} className="bg-white text-gray-900 text-xs font-bold px-4 py-2 rounded-lg shadow-sm hover:bg-gray-100 transition-all">
            Allow
          </button>
        </div>
      )}

      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 p-3 rounded-xl space-y-2 transition-colors">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-blue-800 dark:text-blue-300 uppercase tracking-wider">Profile:</span>
            {isEditingNickname ? (
              <input aria-label="Nickname" type="text" value={nickname} onChange={e => setNickname(e.target.value)} className="bg-white dark:bg-gray-800 border border-blue-200 dark:border-blue-700 rounded px-2 py-1 text-base font-bold text-gray-900 dark:text-white outline-none w-24" placeholder="Nickname" maxLength={15} />
            ) : (
              <span className="text-base font-black text-blue-900 dark:text-blue-100">{savedNickname || 'Not set'}</span>
            )}
          </div>
          {isEditingNickname ? (
            <button aria-label="Save Profile" onClick={saveProfile} className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"><Save size={18} /></button>
          ) : (
            <button aria-label="Edit Profile" onClick={() => setIsEditingNickname(true)} className="text-blue-500 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"><Edit3 size={18} /></button>
          )}
        </div>
        
        {isEditingNickname && (
          <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-blue-200 dark:border-blue-800">
            <div className="relative">
              <select aria-label="Department" value={studentDept} onChange={e => setStudentDept(e.target.value)} className="bg-white dark:bg-gray-800 border border-blue-200 dark:border-blue-700 rounded px-2 py-2 text-sm font-bold text-gray-900 dark:text-white outline-none w-full appearance-none cursor-pointer">
                <option value="">Select Dept</option>
                {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
              <ChevronDown size={14} className="absolute right-2 top-3 text-gray-400 dark:text-gray-500 pointer-events-none" />
            </div>
            <div className="relative">
              <select aria-label="Level" value={studentLevel} onChange={e => setStudentLevel(e.target.value)} className="bg-white dark:bg-gray-800 border border-blue-200 dark:border-blue-700 rounded px-2 py-2 text-sm font-bold text-gray-900 dark:text-white outline-none w-full appearance-none cursor-pointer">
                <option value="">Select Level</option>
                {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
              <ChevronDown size={14} className="absolute right-2 top-3 text-gray-400 dark:text-gray-500 pointer-events-none" />
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-end">
        <button onClick={() => setShowEnrollModal(true)} className="text-xs font-bold text-[#2563EB] dark:text-blue-400 flex items-center gap-1 hover:underline">
          <Plus size={14} /> Enroll in a new course
        </button>
      </div>

      {records.length === 0 ? (
        <div className="text-center py-8 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-gray-200 dark:border-gray-800 space-y-3 transition-colors">
          <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-full w-16 h-16 mx-auto flex items-center justify-center">
            <BookOpen size={32} className="text-gray-400 dark:text-gray-500" />
          </div>
          <p className="text-base font-bold text-gray-600 dark:text-gray-300">You have no courses yet.</p>
        </div>
      ) : (
        records.map((record) => {
          const colors = getShieldColor(record.percentage);
          return (
            <div key={record.course_code} className={`relative overflow-hidden ${colors.bg} p-4 rounded-2xl border ${colors.border} transition-colors`}>
              {record.is_finalized && (
                <div className="absolute top-0 right-0 bg-gray-900 dark:bg-gray-700 text-white text-[10px] font-bold px-3 py-1 rounded-bl-lg flex items-center gap-1">
                  <CheckCircle size={10} /> FINALIZED
                </div>
              )}

              <div className="flex justify-between items-start mb-3 mt-1">
                <div>
                  <p className="font-black text-gray-900 dark:text-white text-lg">{record.course_code}</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400 font-semibold mt-0.5">
                    {record.attended_classes} / {record.total_planned} Classes
                    {record.total_held < record.total_planned && !record.is_finalized && ` (${record.total_planned - record.total_held} remaining)`}
                  </p>
                </div>
                <div className="text-right">
                  <p className={`font-black text-2xl ${colors.text}`}>{record.percentage}%</p>
                  {record.is_finalized && (
                    <p className="text-sm font-bold text-gray-700 dark:text-gray-300 mt-1 bg-white/50 dark:bg-black/20 px-2 py-0.5 rounded border border-gray-200 dark:border-gray-700">
                      CA: {record.ca_score} / {record.max_score}
                    </p>
                  )}
                </div>
              </div>
              
              <div className="relative w-full h-3 bg-gray-200/50 dark:bg-gray-700/50 rounded-full overflow-hidden border border-gray-300/50 dark:border-gray-600">
                <div className={`h-full ${colors.bar}`} style={{ width: `${Math.min(record.percentage, 100)}%` }} />
                <div className="absolute top-0 bottom-0 w-1 bg-gray-900/30 dark:bg-white/30" style={{ left: '70%' }} />
              </div>
              
              {!record.is_finalized && (
                 <div className="mt-2 flex justify-between text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                   <span>{record.streak} Streak ({record.streak_tier})</span>
                   <span>{record.skips_left} Safe Skips Left</span>
                 </div>
              )}
            </div>
          );
        })
      )}

      <div className="mt-8 pt-6 border-t border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-2 mb-4">
          <FileText size={18} className="text-gray-400 dark:text-gray-500" />
          <h3 className="font-bold text-gray-800 dark:text-white text-base">Attendance History</h3>
        </div>
        <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
          {history?.map((h, i) => (
            <div key={i} className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-800 p-4 rounded-xl flex justify-between items-center transition-colors">
              <div>
                <p className="font-bold text-gray-900 dark:text-white text-sm">{h.course_code}</p>
                <p className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">{new Date(h.created_at).toLocaleString()}</p>
              </div>
              {h.status === 'verified' ? (
                <span className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800 text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wide">Present</span>
              ) : h.status === 'flagged' || h.status === 'pending_override' ? (
                <span className="bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 border border-orange-200 dark:border-orange-800 text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wide">Flagged</span>
              ) : h.status === 'blocked' ? (
                <span className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800 text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wide">Blocked</span>
              ) : (
                <span className="bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wide">Absent</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}