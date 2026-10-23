// ─── types/db.ts ───
// Hand-written Supabase schema types.
// If you later run `supabase gen types`, delete this file and use the generated one.

export interface Course {
  id: string;
  lecturer_id: string;
  course_code: string;
  department: string | null;
  level: string | null;
  total_planned_classes: number;
  max_attendance_score: number;
  is_finalized: boolean;
  roster: string[] | null;
  created_at: string;
}

export interface Enrollment {
  id: string;
  course_id: string;
  matric_number: string;
}

export interface LectureSession {
  session_id: string;
  course_code: string;
  anchor_latitude: number;
  anchor_longitude: number;
  is_active: boolean;
  expires_at: string | null;
  created_at: string;
  checkin_opens_after_minutes: number;
  started_by: string | null;
}

export type AttendanceStatus =
  | 'verified'
  | 'flagged'
  | 'pending_override'
  | 'absent'
  | 'blocked';

export interface AttendanceLog {
  id: string;
  session_id: string;
  matric_number: string;
  status: AttendanceStatus;
  device_info: string | null;
  device_hash: string;
  check_in_time: string;
  approved_by: string | null;
  override_timestamp: string | null;
}

export interface StudentProfile {
  matric_number: string;
  nickname: string | null;
  department: string | null;
  level: string | null;
  is_class_rep: boolean;
}

export interface Lecturer {
  id: string;
  email: string;
  full_name: string;
  department: string | null;
  created_at?: string;
}

export interface SessionRating {
  id: string;
  session_id: string;
  rating: number;
  tags: string[];
  created_at: string;
}

export interface CampusUpdate {
  id: string;
  title: string;
  content: string;
  author: string;
  course_code: string | null;
  link_url: string | null;
  expires_at: string | null;
  created_at: string;
}

export interface UserDevice {
  matric_number: string;
  credential_id: string;
  public_key: string;
  counter: number;
  transports: unknown;
  device_hash: string;
  created_at: string;
}

// ── Composite shapes used by the UI ──

export interface DashboardLog {
  id: string;
  matricNumber: string;
  nickname?: string | null;
  status: AttendanceStatus;
  time: string;
  reason?: string | null;
  isBiometric?: boolean;
}

export interface DashboardData {
  course: string;
  isActive: boolean;
  createdAt: string | null;
  logs: DashboardLog[];
  startedBy?: string;
}