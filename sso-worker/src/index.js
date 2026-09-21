// HubQuiz SSO Worker - v4 (with failover)
// Tries JP Nagar first, falls back to Cloud Supabase if unreachable.
// Passes &server= param so the frontend knows which backend to connect to.

const HUB_MAP = {
  yelahanka:  { email: 'blryelahanka.hub@comedkares.org',   password: 'tDPt&b*nO!@V1!'  },
  tumkur:     { email: 'internship@erafoundationindia.org',  password: 'dQc2jlaF9MqO1!'  },
  jpnagar:    { email: 'blrjpnagar.hub@comedkares.org',     password: 'FCApyCD0C57J1!'  },
  mysoreroad: { email: 'blrgopalan.hub@comedkares.org',     password: 'GCV!K^Q3lhUu1!'  },
  mysuru:     { email: 'mysuru.hub@comedkares.org',         password: '$^fty&rP9oV#1!'  },
  mangaluru:  { email: 'mangaluru.hub@comedkares.org',      password: '%8!pu5Ys#RU*1!'  },
  belagavi:   { email: 'belagavi.hub@comedkares.org',       password: 'V0T$Pl5ADTW91!'  },
  kalaburagi: { email: 'kalaburagi.hub@comedkares.org',     password: 'XnQJ5@g78M#g1!'  },
  hubballi:   { email: 'hubballi.hub@comedkares.org',       password: 'lSh3F4tQ3P181!'  },
};

const HUBQUIZ_URL = 'https://hubquiz.vercel.app';

function spinnerPage(destination) {
  return new Response(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Signing In - HubQuiz</title>
  <style>
    body{margin:0;display:flex;align-items:center;justify-content:center;
         height:100vh;flex-direction:column;gap:16px;font-family:sans-serif;background:#f9fafb;}
    .spinner{width:48px;height:48px;border:5px solid #e5e7eb;
             border-top-color:#1a234e;border-radius:50%;animation:spin 0.8s linear infinite;}
    p{color:#1a234e;font-size:1.1rem;font-weight:600;margin:0;}
    @keyframes spin{to{transform:rotate(360deg);}}
  </style>
</head>
<body>
  <div class="spinner"></div>
  <p>Signing you in...</p>
  <script>
    window.location.href = ${JSON.stringify(destination)};
  </script>
</body>
</html>`, { headers: { 'Content-Type': 'text/html;charset=UTF-8' } });
}

/**
 * Attempt to authenticate against a Supabase server.
 * @param {object} server - { name, url, anonKey, headers }
 * @param {string} email
 * @param {string} password
 * @param {number} timeoutMs
 * @returns {Promise<{ok: boolean, access_token?: string, refresh_token?: string, error?: string}>}
 */
async function tryAuth(server, email, password, timeoutMs) {
  const targetUrl = `${server.url}/auth/v1/token?grant_type=password`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        ...server.headers,
      },
      body: JSON.stringify({ email, password }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      const errorText = await res.text();
      return { ok: false, error: `Status ${res.status}: ${errorText}` };
    }

    const { access_token, refresh_token } = await res.json();
    return { ok: true, access_token, refresh_token };
  } catch (err) {
    clearTimeout(timeoutId);
    return { ok: false, error: err.message };
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const hubId = url.searchParams.get('hub');

    if (!hubId || !HUB_MAP[hubId]) {
      return Response.redirect(HUBQUIZ_URL, 302);
    }

    const { email, password } = HUB_MAP[hubId];

    // Define servers to try in order: JP Nagar first, then Cloud
    const servers = [
      {
        name: 'jpnagar',
        url: (env.SUPABASE_URL || '').trim(),
        anonKey: '',
        headers: {
          'ngrok-skip-browser-warning': 'true',
        },
      },
      {
        name: 'cloud',
        url: (env.SUPABASE_CLOUD_URL || '').trim(),
        anonKey: (env.SUPABASE_CLOUD_ANON_KEY || '').trim(),
        headers: {
          'apikey': (env.SUPABASE_CLOUD_ANON_KEY || '').trim(),
        },
      },
    ];

    for (const server of servers) {
      if (!server.url) continue;

      console.log(`[SSO] Trying ${server.name}: ${server.url}`);
      const timeoutMs = server.name === 'jpnagar' ? 4000 : 8000;
      const result = await tryAuth(server, email, password, timeoutMs);

      if (result.ok) {
        console.log(`[SSO] Success on ${server.name}`);
        const dest = `${HUBQUIZ_URL}/?at=${encodeURIComponent(result.access_token)}&rt=${encodeURIComponent(result.refresh_token)}&server=${server.name}`;
        return spinnerPage(dest);
      }

      console.warn(`[SSO] Failed on ${server.name}: ${result.error}`);
    }

    // Both servers failed
    const debugInfo = 'Both JP Nagar and Cloud servers are unreachable. Please try again later.';
    return spinnerPage(`${HUBQUIZ_URL}/login?sso_error=${encodeURIComponent(debugInfo)}`);
  },
};
