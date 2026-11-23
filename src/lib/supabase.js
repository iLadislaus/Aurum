import { createClient } from '@supabase/supabase-js';

// Публичный (publishable) ключ можно держать в браузере: доступ к данным закрыт правилами RLS «только владелец».
const URL = 'https://ozgorwowudjhyvdncilu.supabase.co';
const KEY = 'sb_publishable__m_20U0l39X58kjoO9RjFw_fTEIu36-';

export const sb = createClient(URL, KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' }
});
