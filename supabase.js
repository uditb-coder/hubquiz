// ============================================================
// supabase.js - Supabase client with automatic failover
// Tries JP Nagar (local) first, falls back to Cloud if unreachable
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
 * Initialize Supabase client with automatic failover.
 * @param {string|null} forceServer - 'jpnagar' or 'cloud' to skip health check (used by SSO)
 * @returns {Promise<object>} The initialized Supabase client
 */
async function initSupabase(forceServer) {
  let serverKey;

  // 1. Check URL parameter (?server=jpnagar or ?server=cloud)
  const urlParam = new URLSearchParams(window.location.search).get('server');

  // 2. Check saved user preference in localStorage
  const savedServer = localStorage.getItem('hq_forced_server');

  if (forceServer && HQ_SERVERS[forceServer]) {
    serverKey = forceServer;
    localStorage.setItem('hq_forced_server', forceServer);
    console.log(`[Failover] Forced server from SSO: ${forceServer}`);
  } else if (urlParam && HQ_SERVERS[urlParam]) {
    serverKey = urlParam;
    localStorage.setItem('hq_forced_server', urlParam);
    console.log(`[Failover] Forced server from URL: ${urlParam}`);
  } else if (savedServer && HQ_SERVERS[savedServer]) {
    // If user explicitly chose JP Nagar, verify it is reachable first
    if (savedServer === 'jpnagar') {
      serverKey = await checkPrimaryHealth();
    } else {
      serverKey = 'cloud';
    }
    console.log(`[Failover] Using saved server preference: ${serverKey}`);
  } else {
    // Auto-detect: check JP Nagar
    serverKey = await checkPrimaryHealth();
  }

  const server = HQ_SERVERS[serverKey];
  console.log(`[Failover] Connecting to: ${server.name} (${server.url})`);

  const client = window.supabase.createClient(server.url, server.anonKey, {
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

  // Expose globally
  window.HQ_SUPABASE = client;
  window.HQ_ACTIVE_SERVER = serverKey;
  window.HQ_SERVER_NAME   = server.name;
  window.HQ_SERVER_URL    = server.url;

  return client;
}

/**
 * Check if the JP Nagar primary server is reachable.
 * Uses /auth/v1/health which has open CORS and doesn't require an API key.
 * Returns 'jpnagar' if alive, 'cloud' if unreachable.
 */
async function checkPrimaryHealth() {
  const primary = HQ_SERVERS.jpnagar;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

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
 * Manual Server Switcher helper
 */
window.switchServer = function(target) {
  const current = window.HQ_ACTIVE_SERVER || 'cloud';
  const next = target || (current === 'jpnagar' ? 'cloud' : 'jpnagar');
  localStorage.setItem('hq_forced_server', next);
  const url = new URL(window.location.href);
  url.searchParams.set('server', next);
  window.location.href = url.toString();
};
