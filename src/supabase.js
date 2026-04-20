import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://yyeysurgwchkcxdzcysk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl5ZXlzdXJnd2Noa2N4ZHpjeXNrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2NTkyODksImV4cCI6MjA5MjIzNTI4OX0.X2JoV3hgu1gy7Um9B1hdAZTptPXDIhaHCRupyekShXo';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
