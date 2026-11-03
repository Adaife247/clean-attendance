'use client';
import { useState, useEffect } from 'react';
import { ShieldAlert, ChevronDown, ChevronUp, AlertTriangle, ShieldCheck } from 'lucide-react';
import { FLAG_REASONS, FlagCode } from '@/utils/flag-reasons';
import { getLecturerHeaders } from '@/utils/api-client';

interface FlagItem {
  id: string;
  matric_number: string;
  reason_code: string;
  reason_detail: Record<string, unknown> | null;
  created_at: string;
}

export default function FlagReview() {
  const [loading, setLoading] = useState(true);
  const [checkinFlags, setCheckinFlags] = useState<FlagItem[]>([]);
  const [regFlags, setRegFlags] = useState<FlagItem[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    const fetchFlags = async () => {
      try {
        const headers = await getLecturerHeaders();
        const res = await fetch('/api/lecturer/flags', { headers });
        if (res.ok) {
          const data = await res.json();
          setCheckinFlags(data.checkinFlags || []);
          setRegFlags(data.regFlags || []);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchFlags();
  }, []);

  if (loading) return <div className="p-8 text-center text-gray-500 animate-pulse">Loading security flags...</div>;

  const totalFlags = checkinFlags.length + regFlags.length;

  if (totalFlags === 0) {
    return (
      <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 text-center transition-colors">
        <div className="bg-emerald-50 dark:bg-emerald-900/30 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
          <ShieldCheck className="text-emerald-500" size={32} />
        </div>
        <h3 className="text-lg font-bold text-gray-900 dark:text-white">No Security Flags</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">All recent check-ins and registrations passed verification.</p>
      </div>
    );
  }

  // Group by reason_code
  const groupedFlags = [...checkinFlags, ...regFlags].reduce<Record<string, FlagItem[]>>((acc, flag) => {
    const code = flag.reason_code as FlagCode;
    if (!acc[code]) acc[code] = [];
    acc[code].push(flag);
    return acc;
  }, {});

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-red-200 dark:border-red-900/50 overflow-hidden transition-colors">
      <div className="p-6 border-b border-red-100 dark:border-red-900/30 bg-red-50/30 dark:bg-red-900/10">
        <h2 className="text-xl font-extrabold text-red-900 dark:text-red-400 flex items-center gap-2">
          <ShieldAlert size={24} /> Security Flags ({totalFlags})
        </h2>
        <p className="text-sm text-red-700 dark:text-red-300 font-medium mt-1">Review proxy attempts and location spoofing anomalies.</p>
      </div>
      <div className="divide-y divide-gray-100 dark:divide-gray-800">
        {Object.entries(groupedFlags).map(([code, flags]) => {
          const reason = FLAG_REASONS[code as FlagCode] || {
            messageLecturer: 'Unknown security flag',
            severity: 'error',
          };
          
          return (
            <div key={code}>
              <button
                onClick={() => setExpanded(expanded === code ? null : code)}
                className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${reason.severity === 'error' ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' : 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400'}`}>
                    <AlertTriangle size={18} />
                  </div>
                  <div className="text-left">
                    <p className="font-bold text-gray-900 dark:text-white">{code.replace(/_/g, ' ')}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">{reason.messageLecturer}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 text-xs font-bold px-2.5 py-1 rounded-full">
                    {flags.length}
                  </span>
                  {expanded === code ? <ChevronUp size={20} className="text-gray-400" /> : <ChevronDown size={20} className="text-gray-400" />}
                </div>
              </button>

              {expanded === code && (
                <div className="bg-gray-50 dark:bg-gray-800/30 p-4 space-y-2 border-t border-gray-100 dark:border-gray-800">
                  {flags.map((flag) => (
                    <div key={flag.id} className="bg-white dark:bg-gray-900 p-3 rounded-xl border border-gray-200 dark:border-gray-700 flex justify-between items-center shadow-sm">
                      <div className="w-full">
                        <div className="flex justify-between items-center w-full">
                          <p className="font-bold text-gray-900 dark:text-white text-sm">{flag.matric_number}</p>
                          <p className="text-[10px] text-gray-500 font-medium">{new Date(flag.created_at).toLocaleString()}</p>
                        </div>
                        {flag.reason_detail && (
                          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 font-mono bg-gray-50 dark:bg-gray-800 p-1.5 rounded break-all">
                            {JSON.stringify(flag.reason_detail).replace(/["{}]/g, '').replace(/,/g, ', ')}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}