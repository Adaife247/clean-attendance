'use client';
import { Megaphone, Calendar } from 'lucide-react';
import type { CampusUpdate } from '@/types/db';

interface FeedTabProps {
  feed: CampusUpdate[];
  lastSeenTimestamp: number;
}

export default function FeedTab({ feed, lastSeenTimestamp }: FeedTabProps) {
  return (
    <div className="animate-in fade-in">
      <div className="flex items-center gap-2 mb-4">
        <Megaphone size={18} className="text-[#2563EB] dark:text-blue-400" />
        <h3 className="font-bold text-gray-800 dark:text-white text-base">Campus Updates</h3>
      </div>
      <div className="space-y-4">
        {feed.map((post) => {
          const isUnread = new Date(post.created_at).getTime() > lastSeenTimestamp;
          return (
            <div
              key={post.id}
              className={`bg-gray-50 dark:bg-gray-800/50 border p-4 rounded-xl transition-colors ${
                isUnread
                  ? 'border-blue-200 dark:border-blue-800 ring-1 ring-blue-100 dark:ring-blue-900/30'
                  : 'border-gray-200 dark:border-gray-800'
              }`}
            >
              <div className="flex justify-between items-start mb-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-extrabold text-gray-900 dark:text-white text-sm">{post.title}</h4>
                  {isUnread && (
                    <span className="w-1.5 h-1.5 rounded-full bg-[#2563EB] dark:bg-blue-400" />
                  )}
                </div>
                {post.course_code && (
                  <span className="text-[9px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded border border-blue-100 dark:border-blue-800">
                    {post.course_code}
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed mb-2">{post.content}</p>
              <div className="flex items-center gap-1 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                <Calendar size={10} /> {new Date(post.created_at).toLocaleDateString()}
              </div>
            </div>
          );
        })}
        {feed.length === 0 && (
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center">No updates yet.</p>
        )}
      </div>
    </div>
  );
}