/* js/auth.js — Supabase auth logic */

let supabase = null;

function initSupabase() {
  if (supabase) return supabase;
  if (typeof CONFIG === 'undefined' || !CONFIG.SUPABASE_URL || !CONFIG.SUPABASE_ANON_KEY) {
    throw new Error('Configuration Supabase manquante. Vérifiez config.local.js.');
  }
  if (typeof window.supabase === 'undefined' || !window.supabase.createClient) {
    throw new Error('Bibliothèque Supabase non chargée.');
  }
  supabase = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
  return supabase;
}

function isSupabaseReady() {
  return !!supabase;
}

async function getSession() {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    return session;
  } catch (error) {
    console.error(error);
    return null;
  }
}

async function login(email, password) {
  try {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return { ok: true };
  } catch (error) {
    console.error(error);
    return { ok: false };
  }
}

async function logout() {
  try {
    await supabase.auth.signOut();
  } catch (error) {
    console.error(error);
  }
}