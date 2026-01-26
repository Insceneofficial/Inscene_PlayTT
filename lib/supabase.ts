import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// #region agent log
if (typeof window !== 'undefined') {
  fetch('http://127.0.0.1:7242/ingest/ac7c5e46-64d1-400e-8ce5-b517901614ef',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/supabase.ts:6',message:'Supabase initialization',data:{hasSupabaseUrl:!!supabaseUrl,supabaseUrlLength:supabaseUrl.length,hasSupabaseAnonKey:!!supabaseAnonKey,supabaseAnonKeyLength:supabaseAnonKey.length,importMetaEnvKeys:Object.keys(import.meta.env||{}).filter(k=>k.includes('SUPABASE')||k.includes('VITE')).join(',')},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H5'})}).catch(()=>{});
}
// #endregion

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Check if Supabase is configured
export const isSupabaseConfigured = () => {
  return supabaseUrl && supabaseAnonKey;
};

