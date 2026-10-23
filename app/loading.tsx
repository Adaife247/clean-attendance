// ─── app/loading.tsx ───
export default function Loading() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 font-sans">
      <div className="w-14 h-14 rounded-2xl bg-[#2563EB]/10 mb-4 flex items-center justify-center animate-pulse">
        <div className="w-8 h-8 rounded-lg bg-[#2563EB]/30" />
      </div>
      <div className="h-3 w-32 bg-gray-200 rounded-full animate-pulse mb-2" />
      <div className="h-3 w-24 bg-gray-200 rounded-full animate-pulse" />
    </div>
  );
}