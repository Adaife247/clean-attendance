'use client';
import { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { Upload, Clock, FileText, Zap, PlayCircle, MapPin, Loader2 } from 'lucide-react';
import { ConfirmModal, useConfirmModal } from '@/components/ConfirmModal';
import { getStudentHeaders } from '@/utils/api-client';

const MATRIC_REGEX = /[\/\-]/;

interface RepDeskTabProps {
  records: { id: string; course_code: string }[];
  matricNumber: string;
  activeLiveSession: { course: string; sessionId: string } | null;
  onRefresh: () => void;
  addToast: (title: string, description?: string, type?: 'success' | 'error' | 'info') => void;
}

export default function RepDeskTab({
  records,
  matricNumber,
  activeLiveSession,
  onRefresh,
  addToast,
}: RepDeskTabProps) {
  const [repCourseId, setRepCourseId] = useState('');
  const [repBatteryMatric, setRepBatteryMatric] = useState('');
  const [isLoggingBattery, setIsLoggingBattery] = useState(false);
  const [isUploadingList, setIsUploadingList] = useState(false);
  const [isStartingRepSession, setIsStartingRepSession] = useState(false);
  const [repSessionError, setRepSessionError] = useState('');

  const confirm = useConfirmModal();

  useEffect(() => {
    if (records.length > 0 && !repCourseId) {
      const id = setTimeout(() => setRepCourseId(records[0].id), 0);
      return () => clearTimeout(id);
    }
  }, [records, repCourseId]);

  const handleLogBattery = async () => {
    if (!activeLiveSession) {
      addToast('No active lecture', 'There is no live session to log against.', 'error');
      return;
    }
    if (!repBatteryMatric.trim()) {
      addToast('Matric number required', "Enter the student's matric number.", 'error');
      return;
    }

    setIsLoggingBattery(true);
    try {
      const headers = getStudentHeaders();
      const res = await fetch('/api/rep-action', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          action: 'log_dead_battery',
          sessionId: activeLiveSession.sessionId,
          matricNumber: repBatteryMatric,
        }),
      });
      const data = await res.json();

      if (res.ok) {
        addToast('Dead battery logged', 'Ask the student to see the lecturer for approval.', 'success');
        setRepBatteryMatric('');
      } else {
        addToast('Log failed', data.error || 'Failed to log battery dead.', 'error');
      }
    } catch {
      addToast('Network error', 'Check your connection and try again.', 'error');
    } finally {
      setIsLoggingBattery(false);
    }
  };

  const handleRepUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !repCourseId) return;
    setIsUploadingList(true);

    const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
    const isWord = file.name.endsWith('.docx');
    const isPdf = file.name.endsWith('.pdf');
    const reader = new FileReader();

    reader.onload = async (event) => {
      try {
        let rawMatrics: string[] = [];

        if (isExcel) {
          const data = new Uint8Array(event.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as string[][];

          jsonData.forEach((row) => {
            row.forEach((cell) => {
              if (typeof cell === 'string' && cell.length > 5 && MATRIC_REGEX.test(cell) && !cell.includes('MATRIC')) {
                rawMatrics.push(cell.trim().toUpperCase());
              }
            });
          });
        } else if (isWord) {
          const mammoth = await import('mammoth');
          const arrayBuffer = event.target?.result as ArrayBuffer;
          const result = await mammoth.extractRawText({ arrayBuffer });
          const words = result.value.split(/[\s,]+/);
          rawMatrics = words.map(w => w.trim().toUpperCase()).filter(w => w.length > 5 && MATRIC_REGEX.test(w) && !w.includes('MATRIC'));
        } else if (isPdf) {
          const pdfjs = await import('pdfjs-dist');
          pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;
          
          const arrayBuffer = event.target?.result as ArrayBuffer;
          const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
          let fullText = '';
          
          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const pageText = textContent.items.map((item: any) => item.str).join(' ');
            fullText += pageText + '\n';
          }
          
          const words = fullText.split(/[\s,]+/);
          rawMatrics = words.map(w => w.trim().toUpperCase()).filter(w => w.length > 5 && MATRIC_REGEX.test(w) && !w.includes('MATRIC'));
        } else {
          const csvText = event.target?.result as string;
          rawMatrics = csvText
            .split(/[\n,]+/)
            .map((m) => m.trim().toUpperCase())
            .filter((m) => m.length > 5 && MATRIC_REGEX.test(m) && !m.includes('MATRIC'));
        }

        const uniqueMatrics = Array.from(new Set(rawMatrics));
        if (uniqueMatrics.length === 0) {
          addToast('Invalid file', 'No valid matric numbers found. If this is a scanned PDF, please use an Excel or CSV file.', 'error');
          setIsUploadingList(false);
          e.target.value = '';
          return;
        }

        const headers = getStudentHeaders();
        const res = await fetch('/api/rep/upload-roster', {
          method: 'POST',
          headers,
          body: JSON.stringify({ courseId: repCourseId, matrics: uniqueMatrics })
        });

        const responseData = await res.json();

        if (res.ok) {
          addToast('Roster synced', `${uniqueMatrics.length} students synced.`, 'success');
          onRefresh();
        } else {
          addToast('Upload failed', responseData.error || 'Failed to sync roster.', 'error');
        }
      } catch (err) {
        console.error(err);
        addToast('File read error', 'Failed to read file. Make sure it is a valid CSV, Excel, Word, or Text-based PDF.', 'error');
      } finally {
        setIsUploadingList(false);
        e.target.value = '';
      }
    };

    if (isExcel || isWord || isPdf) reader.readAsArrayBuffer(file);
    else reader.readAsText(file);
  };

  const handleStartBackupSession = () => {
    if (!repCourseId) {
      addToast('No course selected', 'Select a course first.', 'error');
      return;
    }
    if (!navigator.geolocation) {
      addToast('GPS not supported', "Your phone doesn't support GPS.", 'error');
      return;
    }

    confirm.ask(
      `Start a backup session?`,
      'Your phone will become the GPS anchor for this class. Students will be able to check in for the next 60 minutes.',
      () => {
        setIsStartingRepSession(true);
        setRepSessionError('Getting stable GPS fix (up to 20s)...');

        let watchId = 0;
        let finished = false;

        const cleanup = () => { if (watchId) navigator.geolocation.clearWatch(watchId); };

        const createSession = async (lat: number, lng: number) => {
          try {
            const res = await fetch('/api/create-session', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                courseId: repCourseId,
                latitude: lat,
                longitude: lng,
                duration: 60,
                checkinOpensAfter: 0,
                startedBy: 'Class Rep',
                repMatric: matricNumber,
              }),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to start session');

            addToast('Backup session started', 'Students can now check in.', 'success');
            onRefresh();
          } catch (err) {
            setRepSessionError(err instanceof Error ? err.message : 'Failed to start session.');
          } finally {
            setIsStartingRepSession(false);
          }
        };

        const timeoutId = setTimeout(() => {
          if (finished) return;
          finished = true;
          cleanup();
          setRepSessionError('Could not lock onto GPS under 100m accuracy. Step outside or near a window and try again.');
          setIsStartingRepSession(false);
        }, 20000);

        watchId = navigator.geolocation.watchPosition(
          (position) => {
            if (finished) return;
            const acc = position.coords.accuracy;
            setRepSessionError(`GPS stabilizing (±${Math.round(acc)}m)...`);
            
            // Only accept highly accurate readings so the geofence is solid
            if (acc <= 100) {
              finished = true;
              clearTimeout(timeoutId);
              cleanup();
              createSession(position.coords.latitude, position.coords.longitude);
            }
          },
          (error) => {
            clearTimeout(timeoutId);
            if (finished) return;
            finished = true;
            cleanup();
            setRepSessionError(error.code === 1 ? 'Location permission denied. Allow location to start a session.' : 'GPS signal lost. Try again.');
            setIsStartingRepSession(false);
          },
          { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 }
        );
      },
      { isDangerous: false, confirmLabel: 'Start Session' }
    );
  };

  return (
    <div className="animate-in fade-in space-y-6">
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-4 rounded-xl transition-colors">
        <h3 className="font-bold text-blue-900 dark:text-white text-base mb-2 flex items-center gap-2">
          <Upload size={18} /> Upload Class List
        </h3>
        <p className="text-sm text-blue-700 dark:text-blue-300 font-medium mb-3">
          Help the lecturer by uploading the roster for a course you represent.
        </p>

        <select
          aria-label="Course to Upload List"
          value={repCourseId}
          onChange={(e) => setRepCourseId(e.target.value)}
          className="w-full bg-white dark:bg-gray-800 border border-blue-200 dark:border-blue-700 text-gray-900 dark:text-white p-3 rounded-lg text-sm font-bold mb-3 outline-none"
        >
          {records?.map((r) => (
            <option key={r.id} value={r.id}>
              {r.course_code}
            </option>
          ))}
        </select>

        <label className="cursor-pointer flex items-center justify-center gap-2 w-full py-3 bg-white dark:bg-gray-800 border border-blue-300 dark:border-blue-700 rounded-xl font-bold text-sm text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-gray-700 transition-all shadow-sm">
          {isUploadingList ? <Clock size={18} className="animate-spin" /> : <FileText size={18} />}
          {isUploadingList ? 'Uploading...' : 'Select CSV / Excel / Word / PDF'}
          <input
            type="file"
            accept=".csv, .xlsx, .xls, .docx, .pdf"
            className="hidden"
            onChange={handleRepUpload}
            disabled={isUploadingList}
          />
        </label>
      </div>

      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-4 rounded-xl transition-colors">
        <h3 className="font-bold text-amber-900 dark:text-white text-base mb-2 flex items-center gap-2">
          <Zap size={18} /> Log Dead Battery
        </h3>
        <p className="text-sm text-amber-700 dark:text-amber-300 font-medium mb-3">
          If a student&apos;s phone died, log their matric number here. <strong>Limit: 3 per class.</strong>
        </p>

        <div className="flex gap-2">
          <input
            aria-label="Student Matric Number for Dead Battery"
            type="text"
            placeholder="Student's Matric No."
            value={repBatteryMatric}
            onChange={(e) => setRepBatteryMatric(e.target.value.toUpperCase())}
            className="w-full bg-white dark:bg-gray-800 border border-amber-200 dark:border-amber-700 text-gray-900 dark:text-white p-3 rounded-lg text-sm font-bold uppercase outline-none"
          />
          <button
            onClick={handleLogBattery}
            disabled={isLoggingBattery || !repBatteryMatric}
            className="bg-amber-500 text-white px-5 py-3 rounded-lg font-bold text-sm hover:bg-amber-600 disabled:opacity-50 whitespace-nowrap"
          >
            {isLoggingBattery ? 'Logging...' : 'Log'}
          </button>
        </div>
      </div>

      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 rounded-xl transition-colors">
        <h3 className="font-bold text-red-900 dark:text-white text-base mb-2 flex items-center gap-2">
          <PlayCircle size={18} /> Backup Anchor
        </h3>
        <p className="text-sm text-red-700 dark:text-red-300 font-medium mb-3">
          If the lecturer&apos;s phone is dead or missing, start a session from your phone. Your GPS becomes the anchor for the class.
        </p>

        {activeLiveSession ? (
          <div className="bg-white dark:bg-gray-800 border border-red-200 dark:border-red-800 p-3 rounded-lg text-center text-sm font-bold text-red-600 dark:text-red-400">
            Session already active: {activeLiveSession.course}
          </div>
        ) : (
          <div className="space-y-2">
            <select
              aria-label="Course for Backup Session"
              value={repCourseId}
              onChange={(e) => setRepCourseId(e.target.value)}
              className="w-full bg-white dark:bg-gray-800 border border-red-200 dark:border-red-700 text-gray-900 dark:text-white p-3 rounded-lg text-sm font-bold outline-none"
            >
              {records?.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.course_code}
                </option>
              ))}
            </select>
            <button
              onClick={handleStartBackupSession}
              disabled={isStartingRepSession}
              className="w-full bg-red-600 text-white py-3 rounded-lg font-bold text-sm hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isStartingRepSession ? <Loader2 size={18} className="animate-spin" /> : <MapPin size={18} />}
              {isStartingRepSession ? 'Anchoring GPS...' : 'Start Backup Session'}
            </button>
            {repSessionError && <p className="text-xs text-red-600 dark:text-red-400 font-bold mt-2">{repSessionError}</p>}
          </div>
        )}
      </div>

      <ConfirmModal config={confirm.config} onClose={confirm.close} />
    </div>
  );
}