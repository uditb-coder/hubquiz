// ============================================================
// supabase.js - Supabase client with automatic failover
// Resilient dual-tier architecture: Cloud (primary/fallback) + JP Nagar
// ============================================================

const HQ_SERVERS = {
  jpnagar: {
    name: 'JP Nagar',
    url:  'https://acid-tribute-ninth.ngrok-free.dev',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0',
    extraHeaders: { 'ngrok-skip-browser-warning': 'true' },
  },
  cloud: {
    name: 'Cloud',
    url:  'https://pxsemvrbchajuqhnetti.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB4c2VtdnJiY2hhanVxaG5ldHRpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY5Njk2NTcsImV4cCI6MjEwMjU0NTY1N30.wBgG5qUjrRLC8Od41RrM_dIjC8VXrb9FeyvfO4dIBkE',
    extraHeaders: {},
  },
};

// Realtime connection limit for free tier cloud
const CLOUD_REALTIME_LIMIT = 200;

/**
 * Helper to construct a Supabase client for a given server configuration.
 */
function createHQClient(server) {
  if (typeof window === 'undefined' || !window.supabase) {
    console.error('[Failover] Supabase SDK script not loaded yet');
    return null;
  }
  return window.supabase.createClient(server.url, server.anonKey, {
    global: {
      headers: { ...server.extraHeaders },
    },
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  });
}

// ------------------------------------------------------------
// Synchronous initial client
// Cloud is default high-availability tier unless explicitly requested
// ------------------------------------------------------------
const _initialParam = (typeof window !== 'undefined' && window.location) 
  ? new URLSearchParams(window.location.search).get('server') 
  : null;
const _initialSaved = (typeof localStorage !== 'undefined') 
  ? localStorage.getItem('hq_forced_server') 
  : null;
const _initialKey = (_initialParam && HQ_SERVERS[_initialParam]) 
  ? _initialParam 
  : ((_initialSaved && HQ_SERVERS[_initialSaved]) ? _initialSaved : 'cloud');
const _initialServerObj = HQ_SERVERS[_initialKey] || HQ_SERVERS.cloud;

let _activeClient = createHQClient(_initialServerObj);
window._HQ_ACTIVE_CLIENT = _activeClient;

// Define dynamic getter so HQ_SUPABASE and window.HQ_SUPABASE ALWAYS
// point to the current active client and never get shadowed
try {
  Object.defineProperty(window, 'HQ_SUPABASE', {
    get() { return window._HQ_ACTIVE_CLIENT; },
    set(c) { window._HQ_ACTIVE_CLIENT = c; },
    configurable: true,
  });
} catch (_) {
  window.HQ_SUPABASE = _activeClient;
}
var HQ_SUPABASE = _activeClient;

window.HQ_ACTIVE_SERVER = _initialKey;
window.HQ_SERVER_NAME = _initialServerObj.name;
window.HQ_SERVER_URL = _initialServerObj.url;

/**
 * Initialize Supabase client with automatic failover.
 * @param {string|null} forceServer - 'jpnagar' or 'cloud' to skip health check (used by SSO)
 * @returns {Promise<object>} The initialized Supabase client
 */
async function initSupabase(forceServer) {
  let serverKey;

  const urlParam = (typeof window !== 'undefined' && window.location) 
    ? new URLSearchParams(window.location.search).get('server') 
    : null;
  const savedServer = (typeof localStorage !== 'undefined') 
    ? localStorage.getItem('hq_forced_server') 
    : null;

  if (forceServer && HQ_SERVERS[forceServer]) {
    serverKey = forceServer;
    localStorage.setItem('hq_forced_server', forceServer);
    console.log(`[Failover] Forced server from parameter: ${forceServer}`);
  } else if (urlParam && HQ_SERVERS[urlParam]) {
    serverKey = urlParam;
    localStorage.setItem('hq_forced_server', urlParam);
    console.log(`[Failover] Forced server from URL: ${urlParam}`);
  } else if (savedServer && HQ_SERVERS[savedServer]) {
    // If user previously set a preference, verify or use it
    if (savedServer === 'jpnagar') {
      serverKey = await checkPrimaryHealth();
    } else {
      serverKey = 'cloud';
    }
  } else {
    // Auto-detect: if JP Nagar is healthy within 2.5s, connect to local hub
    // Otherwise, seamlessly use Cloud
    serverKey = await checkPrimaryHealth();
  }

  const server = HQ_SERVERS[serverKey];
  console.log(`[Failover] Connecting to: ${server.name} (${server.url})`);

  // Update client if server changed or client missing
  if (serverKey !== window.HQ_ACTIVE_SERVER || !window.HQ_SUPABASE) {
    const client = createHQClient(server);
    window._HQ_ACTIVE_CLIENT = client;
    window.HQ_SUPABASE = client;
    HQ_SUPABASE = client;
    window.HQ_ACTIVE_SERVER = serverKey;
    window.HQ_SERVER_NAME   = server.name;
    window.HQ_SERVER_URL    = server.url;
  } else {
    console.log(`[Failover] Active server confirmed: ${window.HQ_SERVER_NAME}`);
  }

  return window.HQ_SUPABASE;
}

/**
 * Check if the JP Nagar primary server is reachable.
 * Uses /auth/v1/health which has open CORS and doesn't require an API key.
 * Returns 'jpnagar' if alive within 2500ms, 'cloud' if unreachable or slow.
 */
async function checkPrimaryHealth() {
  const primary = HQ_SERVERS.jpnagar;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);

    const res = await fetch(primary.url + '/auth/v1/health', {
      method: 'GET',
      headers: {
        ...primary.extraHeaders,
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      console.log('[Failover] JP Nagar is ONLINE (/auth/v1/health OK)');
      return 'jpnagar';
    }
    console.warn('[Failover] JP Nagar returned status:', res.status);
    return 'cloud';
  } catch (err) {
    console.warn('[Failover] JP Nagar is OFFLINE:', err.message);
    return 'cloud';
  }
}

/**
 * Manual Server Switcher helper (Used by Admin)
 */
window.switchServer = function(target) {
  const current = window.HQ_ACTIVE_SERVER || 'cloud';
  const next = target || (current === 'jpnagar' ? 'cloud' : 'jpnagar');
  localStorage.setItem('hq_forced_server', next);
  const url = new URL(window.location.href);
  url.searchParams.set('server', next);
  window.location.href = url.toString();
};
