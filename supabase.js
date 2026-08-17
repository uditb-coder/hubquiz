// ============================================================
// supabase.js — Supabase client initialisation
// Replace SUPABASE_URL and SUPABASE_ANON_KEY with your project values
// from: Supabase Dashboard → Project Settings → API
// ============================================================

// TODO: Replace these with your actual Supabase project credentials
const SUPABASE_URL  = 'https://pxsemvrbchajuqhhnetti.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB4c2VtdnJiY2hhanVxaG5ldHRpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY5Njk2NTcsImV4cCI6MjEwMjU0NTY1N30.wBgG5qUjrRLC8Od41RrM_dIjC8VXrb9FeyvfO4dIBkE';

// Create and export the Supabase client (loaded via CDN in index.html)
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

window.HQ_SUPABASE = supabase;
