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

  if (forceServer && HQ_SERVERS[forceServer]) {
    // SSO Worker told us which server the token was minted on
    serverKey = forceServer;
    console.log(`[Failover] Forced server: ${forceServer} (from SSO)`);
  } else {
    // Auto-detect: try JP Nagar with 3s timeout
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
 * Returns 'jpnagar' if alive, 'cloud' if unreachable.
 */
async function checkPrimaryHealth() {
  const primary = HQ_SERVERS.jpnagar;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const res = await fetch(primary.url + '/rest/v1/', {
      method: 'HEAD',
      headers: {
        ...primary.extraHeaders,
        'apikey': primary.anonKey,
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.ok || res.status === 404 || res.status === 406) {
      // Server is alive (404/406 is fine, it means PostgREST responded)
      console.log('[Failover] JP Nagar is ONLINE');
      return 'jpnagar';
    }
    console.warn('[Failover] JP Nagar returned unexpected status:', res.status);
    return 'cloud';
  } catch (err) {
    console.warn('[Failover] JP Nagar is OFFLINE:', err.message);
    return 'cloud';
  }
}
