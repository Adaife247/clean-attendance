'use client';
import { Megaphone, Calendar, Inbox, PenTool } from 'lucide-react';
import type { CampusUpdate } from '@/types/db';

interface FeedTabProps {
  feed: CampusUpdate[];
  lastSeenTimestamp: number;
}

export default function FeedTab({ feed, lastSeenTimestamp }: FeedTabProps) {
  return (
    <div className="animate-in fade-in">
      <div className="flex items-center gap-2 mb-6">
        <Megaphone size={18} className="text-[#2563EB] dark:text-blue-400" />
        <h3 className="font-extrabold text-gray-900 dark:text-white text-lg tracking-tight">Campus Updates</h3>
      </div>
      
      <div className="space-y-4">
        {feed.map((post) => {
          const isUnread = new Date(post.created_at).getTime() > lastSeenTimestamp;
          return (
            <div
              key={post.id}
              className={`bg-white dark:bg-gray-900 border p-5 rounded-2xl transition-all shadow-sm ${
                isUnread
                  ? 'border-blue-200 dark:border-blue-800 ring-1 ring-blue-100 dark:ring-blue-900/30'
                  : 'border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700'
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-gray-900 dark:text-white text-base tracking-tight">{post.title}</h4>
                  {isUnread && (
                    <span className="w-2 h-2 rounded-full bg-[#2563EB] dark:bg-blue-400 shadow-[0_0_8px_rgba(37,99,235,0.6)]" />
                  )}
                </div>
                <span className={`text-[10px] font-bold px-2 py-1 rounded-md border uppercase tracking-wider ${
                  post.course_code 
                    ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 border-blue-100 dark:border-blue-800' 
                    : 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/30 border-purple-100 dark:border-purple-800'
                }`}>
                  {post.course_code || '🌍 Global'}
                </span>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed mb-4">{post.content}</p>
              
              {/* Author & Date Footer */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-t border-gray-100 dark:border-gray-800 pt-3">
                <div className="flex items-center gap-1.5 text-xs font-bold text-gray-700 dark:text-gray-300">
                  <PenTool size={12} className="text-[#2563EB] dark:text-blue-400" /> 
                  Signed by: {post.author}
                </div>
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                  <Calendar size={12} /> {new Date(post.created_at).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                </div>
              </div>
            </div>
          );
        })}
        
        {feed.length === 0 && (
          <div className="text-center py-12 bg-gray-50 dark:bg-gray-800/30 rounded-2xl border border-dashed border-gray-300 dark:border-gray-700">
            <div className="w-16 h-16 bg-white dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
              <Inbox className="text-gray-400" size={28} />
            </div>
            <h3 className="text-base font-bold text-gray-900 dark:text-white">All caught up!</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">No new announcements from your lecturers yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}