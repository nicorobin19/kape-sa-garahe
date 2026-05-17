import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://yyeysurgwchkcxdzcysk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl5ZXlzdXJnd2Noa2N4ZHpjeXNrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2NTkyODksImV4cCI6MjA5MjIzNTI4OX0.X2JoV3hgu1gy7Um9B1hdAZTptPXDIhaHCRupyekShXo';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Keep-alive ping — runs every 4 days to prevent Supabase free tier from pausing
// Supabase pauses after 7 days of inactivity, so 4 days is a safe interval
const FOUR_DAYS_MS = 4 * 24 * 60 * 60 * 1000;

async function keepAlive() {
  try {
    await supabase.from('menu_items').select('id').limit(1);
    console.log('[Supabase] Keep-alive ping sent:', new Date().toISOString());
  } catch (e) {
    console.warn('[Supabase] Keep-alive failed:', e.message);
  }
}

// Ping immediately on load, then every 4 days
keepAlive();
setInterval(keepAlive, FOUR_DAYS_MS);
