/* js/auth.js — Supabase auth logic */

let supabaseClient = null;

function initSupabase() {
  if (supabaseClient) return supabaseClient;
  if (typeof CONFIG === 'undefined' || !CONFIG.SUPABASE_URL || !CONFIG.SUPABASE_ANON_KEY) {
    throw new Error('Configuration Supabase manquante. Vérifiez config.local.js.');
  }
  if (typeof window.supabase === 'undefined' || !window.supabase.createClient) {
    throw new Error('Bibliothèque Supabase non chargée.');
  }
  supabaseClient = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
  return supabaseClient;
}

function isSupabaseReady() {
  return !!supabaseClient;
}

async function getSession() {
  try {
    const { data: { session } } = await supabaseClient.auth.getSession();
    return session;
  } catch (error) {
    console.error(error);
    return null;
  }
}

async function login(email, password) {
  try {
    const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return { ok: true };
  } catch (error) {
    console.error(error);
    return { ok: false };
  }
}

async function logout() {
  try {
    await supabaseClient.auth.signOut();
  } catch (error) {
    console.error(error);
  }
}

// Wipes stored tokens and drops the cached client. Called when a DB call
// surfaces a 401/403 — the session is gone, so we must clear local state
// before redirecting to the login page.
function clearSession() {
  try {
    if (supabaseClient && supabaseClient.auth && typeof supabaseClient.auth.signOut === 'function') {
      supabaseClient.auth.signOut().catch(() => {});
    }
  } catch (error) {
    // ignore — we're already clearing out
  }
  try {
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith('sb-') || key.includes('supabase')) localStorage.removeItem(key);
    });
  } catch (error) {
    // ignore — storage may be unavailable
  }
  supabaseClient = null;
}