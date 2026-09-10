// ============================================================
// supabase.js — Supabase client initialisation
// Replace SUPABASE_URL and SUPABASE_ANON_KEY with your project values
// from: Supabase Dashboard → Project Settings → API
// ============================================================

// TODO: Replace these with your actual Supabase project credentials
const SUPABASE_URL  = 'https://immune-climb-identifies-kitty.trycloudflare.com';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

// Create and export the Supabase client
const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON, {
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

window.HQ_SUPABASE = client;
