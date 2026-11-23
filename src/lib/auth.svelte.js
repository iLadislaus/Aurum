import { sb } from './supabase.js';

export const auth = $state({ ready: false, session: null, error: '' });

export function startAuth() {
  sb.auth.getSession().then(({ data }) => {
    auth.session = data.session;
    auth.ready = true;
  });
  sb.auth.onAuthStateChange((_e, s) => {
    auth.session = s;
    auth.ready = true;
  });
}

export async function signInGoogle() {
  auth.error = '';
  const { error } = await sb.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: location.origin + location.pathname }
  });
  if (error) auth.error = error.message;
}

export const signOut = () => sb.auth.signOut();
