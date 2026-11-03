'use client';
import { 
  BellRing, Edit3, Save, ChevronDown, BookOpen, 
  CheckCircle, Plus, FileText, Award, Star, Inbox, AlertTriangle, Info
} from 'lucide-react';

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
  totalXP: number;
  levelData: { level: number; title: string; currentXP: number; nextLevelXP: number };
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
  totalXP,
  levelData,
}: DashboardTabProps) {
  
  const getShieldColor = (pct: number) => {
    if (pct >= 70) return { bar: 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]', text: 'text-emerald-700 dark:text-emerald-400', bg: 'bg-white dark:bg-gray-900', border: 'border-gray-200 dark:border-gray-800' };
    if (pct >= 50) return { bar: 'bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.5)]', text: 'text-amber-700 dark:text-amber-400', bg: 'bg-white dark:bg-gray-900', border: 'border-gray-200 dark:border-gray-800' };
    return { bar: 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]', text: 'text-red-700 dark:text-red-400', bg: 'bg-white dark:bg-gray-900', border: 'border-gray-200 dark:border-gray-800' };
  };

  if (!records) return null;

  const progressPercent = Math.min(100, Math.round((levelData.currentXP / levelData.nextLevelXP) * 100));

  return (
    <div className="space-y-6 animate-in fade-in">
      
      {/* XP / LEVEL CARD */}
      <div className="bg-linear-to-br from-gray-900 to-gray-800 dark:from-gray-800 dark:to-gray-900 rounded-2xl p-5 shadow-lg relative overflow-hidden text-white">
        <div className="absolute top-0 right-0 p-4 opacity-10">
          <Award size={80} />
        </div>
        <div className="relative z-10">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Current Status</p>
              <h3 className="text-2xl font-black text-white">{levelData.title}</h3>
            </div>
            <div className="bg-white/20 px-3 py-1.5 rounded-lg border border-white/10 backdrop-blur-sm">
              <p className="text-sm font-black text-white">{totalXP} XP</p>
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between text-[10px] font-bold text-gray-300 uppercase tracking-wider">
              <span>Level {levelData.level}</span>
              <span>{levelData.currentXP} / {levelData.nextLevelXP} XP</span>
            </div>
            <div className="h-2.5 bg-black/30 rounded-full overflow-hidden">
              <div 
                className="h-full bg-[#2563EB] shadow-[0_0_10px_rgba(37,99,235,0.8)] transition-all duration-1000 ease-out" 
                style={{ width: `${progressPercent}%` }} 
              />
            </div>
          </div>

          <div className="mt-3 flex items-start gap-1.5 text-[10px] text-gray-400 font-medium bg-black/20 p-2 rounded-lg">
            <Info size={12} className="shrink-0 mt-0.5" />
            <p>Earn 10 XP per class attended, plus 5 XP for every current streak point. Reach 500 XP for Level 2!</p>
          </div>
        </div>
      </div>

      {isSupported && permission !== 'granted' && !isSubscribed && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-4 rounded-2xl flex items-center justify-between shadow-sm animate-in slide-in-from-top-4">
          <div className="flex items-center gap-3">
            <div className="bg-blue-100 dark:bg-blue-900/50 p-2 rounded-full text-[#2563EB] dark:text-blue-400"><BellRing size={20} /></div>
            <div>
              <p className="font-bold text-gray-900 dark:text-white text-sm">Never miss a class</p>
              <p className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">Enable alerts for when class starts.</p>
            </div>
          </div>
          <button onClick={subscribe} className="bg-[#2563EB] text-white text-xs font-bold px-4 py-2 rounded-lg shadow-sm hover:bg-blue-700 transition-all">
            Allow
          </button>
        </div>
      )}

      {/* Profile Section */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4 rounded-2xl space-y-2 transition-colors shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Profile:</span>
            {isEditingNickname ? (
              <input aria-label="Nickname" type="text" value={nickname} onChange={e => setNickname(e.target.value)} className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1 text-base font-bold text-gray-900 dark:text-white outline-none w-32 focus:ring-2 focus:ring-[#2563EB]" placeholder="Nickname" maxLength={15} />
            ) : (
              <span className="text-base font-black text-gray-900 dark:text-white">{savedNickname || 'Not set'}</span>
            )}
          </div>
          {isEditingNickname ? (
            <button aria-label="Save Profile" onClick={saveProfile} className="p-2 bg-[#2563EB] text-white rounded-lg shadow-sm hover:bg-blue-700 transition-all"><Save size={16} /></button>
          ) : (
            <button aria-label="Edit Profile" onClick={() => setIsEditingNickname(true)} className="p-2 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-all"><Edit3 size={16} /></button>
          )}
        </div>
        
        {isEditingNickname && (
          <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
            <div className="relative">
              <select aria-label="Department" value={studentDept} onChange={e => setStudentDept(e.target.value)} className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm font-bold text-gray-900 dark:text-white outline-none w-full appearance-none cursor-pointer focus:ring-2 focus:ring-[#2563EB]">
                <option value="">Select Dept</option>
                {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-3 text-gray-400 dark:text-gray-500 pointer-events-none" />
            </div>
            <div className="relative">
              <select aria-label="Level" value={studentLevel} onChange={e => setStudentLevel(e.target.value)} className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm font-bold text-gray-900 dark:text-white outline-none w-full appearance-none cursor-pointer focus:ring-2 focus:ring-[#2563EB]">
                <option value="">Select Level</option>
                {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-3 text-gray-400 dark:text-gray-500 pointer-events-none" />
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-end">
        <button onClick={() => setShowEnrollModal(true)} className="text-xs font-bold text-[#2563EB] dark:text-blue-400 flex items-center gap-1 hover:underline">
          <Plus size={14} /> Enroll in a new course
        </button>
      </div>

      {/* Course Cards */}
      {records.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 dark:bg-gray-800/30 rounded-2xl border border-dashed border-gray-300 dark:border-gray-700">
          <div className="w-16 h-16 bg-white dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
            <BookOpen className="text-gray-400" size={28} />
          </div>
          <h3 className="text-base font-bold text-gray-900 dark:text-white">No courses yet</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-xs mx-auto">You are not enrolled in any courses. Click the button above to join a class roster.</p>
        </div>
      ) : (
        records.map((record) => {
          const colors = getShieldColor(record.percentage);
          return (
            <div key={record.course_code} className={`relative overflow-hidden bg-white dark:bg-gray-900 p-5 rounded-2xl border ${colors.border} shadow-sm transition-colors`}>
              {record.is_finalized && (
                <div className="absolute top-0 right-0 bg-gray-900 dark:bg-gray-700 text-white text-[10px] font-bold px-3 py-1 rounded-bl-lg flex items-center gap-1">
                  <CheckCircle size={10} /> FINALIZED
                </div>
              )}

              <div className="flex justify-between items-start mb-4">
                <div>
                  <p className="font-black text-gray-900 dark:text-white text-lg tracking-tight">{record.course_code}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-semibold mt-1">
                    {record.attended_classes} / {record.total_planned} Classes
                    {record.total_held < record.total_planned && !record.is_finalized && ` (${record.total_planned - record.total_held} left)`}
                  </p>
                </div>
                <div className="text-right">
                  <p className={`font-black text-2xl ${colors.text}`}>{record.percentage}%</p>
                  {record.is_finalized && (
                    <p className="text-sm font-bold text-gray-700 dark:text-gray-300 mt-1 bg-gray-50 dark:bg-gray-800 px-2 py-0.5 rounded-lg border border-gray-200 dark:border-gray-700">
                      CA: {record.ca_score} / {record.max_score}
                    </p>
                  )}
                </div>
              </div>
              
              <div className="relative w-full h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden border border-gray-200/50 dark:border-gray-700/50">
                <div className={`h-full ${colors.bar}`} style={{ width: `${Math.min(record.percentage, 100)}%` }} />
                <div className="absolute top-0 bottom-0 w-0.5 bg-gray-900/20 dark:bg-white/20" style={{ left: '70%' }} />
              </div>
              
              {!record.is_finalized && (
                 <div className="mt-3 flex justify-between text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                   <span className="flex items-center gap-1"><Star size={10} className={record.streak > 0 ? 'text-amber-500 fill-amber-500' : ''} /> {record.streak} Streak ({record.streak_tier})</span>
                   <span>{record.skips_left} Safe Skips Left</span>
                 </div>
              )}
            </div>
          );
        })
      )}

      {/* History Section */}
      <div className="mt-8 pt-6 border-t border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-2 mb-4">
          <FileText size={18} className="text-gray-400 dark:text-gray-500" />
          <h3 className="font-bold text-gray-900 dark:text-white text-base">Recent Attendance</h3>
        </div>
        
        <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
          {history?.map((h, i) => (
            <div key={i} className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 p-4 rounded-xl flex justify-between items-center transition-colors shadow-sm hover:border-gray-200 dark:hover:border-gray-700">
              <div>
                <p className="font-bold text-gray-900 dark:text-white text-sm">{h.course_code}</p>
                <p className="text-[10px] text-gray-500 dark:text-gray-400 font-medium mt-0.5">{new Date(h.created_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</p>
              </div>
              {h.status === 'verified' ? (
                <span className="bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800 text-[10px] font-bold px-2.5 py-1 rounded-md uppercase tracking-wider flex items-center gap-1"><CheckCircle size={10} /> Present</span>
              ) : h.status === 'flagged' || h.status === 'pending_override' ? (
                <span className="bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 border border-orange-100 dark:border-orange-800 text-[10px] font-bold px-2.5 py-1 rounded-md uppercase tracking-wider flex items-center gap-1"><AlertTriangle size={10} /> Flagged</span>
              ) : h.status === 'blocked' ? (
                <span className="bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-100 dark:border-red-800 text-[10px] font-bold px-2.5 py-1 rounded-md uppercase tracking-wider flex items-center gap-1"><AlertTriangle size={10} /> Blocked</span>
              ) : (
                <span className="bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 text-[10px] font-bold px-2.5 py-1 rounded-md uppercase tracking-wider">Absent</span>
              )}
            </div>
          ))}
          {(!history || history.length === 0) && (
            <div className="text-center py-8 bg-gray-50 dark:bg-gray-800/30 rounded-xl border border-dashed border-gray-300 dark:border-gray-700">
              <Inbox className="text-gray-400 mx-auto mb-2" size={24} />
              <p className="text-xs font-bold text-gray-500 dark:text-gray-400">No attendance history yet.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}