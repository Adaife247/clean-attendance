// ─── app/dashboard/loading.tsx ───
export default function DashboardLoading() {
  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6 animate-pulse">
      {/* Header skeleton */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <div className="h-4 w-40 bg-gray-200 rounded mb-3" />
        <div className="h-8 w-64 bg-gray-200 rounded mb-4" />
        <div className="flex gap-2">
          <div className="h-3 w-24 bg-gray-100 rounded" />
          <div className="h-3 w-20 bg-gray-100 rounded" />
        </div>
      </div>

      {/* Stat cards skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="bg-white p-6 rounded-2xl border border-gray-200 h-24"
          >
            <div className="h-3 w-20 bg-gray-200 rounded mb-3" />
            <div className="h-6 w-16 bg-gray-200 rounded" />
          </div>
        ))}
      </div>

      {/* Table skeleton */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <div className="h-4 w-32 bg-gray-200 rounded" />
        </div>
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="px-6 py-4 flex items-center gap-4 border-b border-gray-50">
            <div className="h-3 w-40 bg-gray-100 rounded" />
            <div className="h-3 w-16 bg-gray-100 rounded ml-auto" />
            <div className="h-6 w-20 bg-gray-100 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}