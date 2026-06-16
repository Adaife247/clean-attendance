import { createClient } from '@supabase/supabase-js';

// This client bypasses RLS. ONLY use this inside the /app/api/ folders.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);