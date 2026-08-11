import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

// Keep the publishable key in environment variables. Never place a service-role
// key in browser code: it bypasses all Row Level Security policies.
export const supabase = url && key ? createClient(url, key) : null;

export const supabaseConfigured = Boolean(supabase);
