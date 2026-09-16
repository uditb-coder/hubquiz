// HubQuiz SSO Worker
// Returns an HTML page that does a JS redirect with tokens in the hash.
// HTTP 302 redirects cannot carry hash fragments, but JS window.location.href can.

const HUB_MAP = {
  yelahanka:  { email: 'blryelahanka.hub@comedkares.org',   password: 'B#SU9^My8AE81!'  },
  tumkur:     { email: 'internship@erafoundationindia.org',  password: 'dpDCm@3GTu!a1!'  },
  jpnagar:    { email: 'blrjpnagar.hub@comedkares.org',     password: 'P#%YBFzOggnO1!'  },
  mysoreroad: { email: 'blrgopalan.hub@comedkares.org',     password: 'qICrvHAtN^q41!'  },
  mysuru:     { email: 'mysuru.hub@comedkares.org',         password: 'U7UPozn%%z#n1!'  },
  mangaluru:  { email: 'mangaluru.hub@comedkares.org',      password: 'PkZAfPyp8@IJ1!'  },
  belagavi:   { email: 'belagavi.hub@comedkares.org',       password: 'ACKzkc@qToba1!'  },
  kalaburagi: { email: 'kalaburagi.hub@comedkares.org',     password: 'G*jUOl9X8BG&1!' },
  hubballi:   { email: 'hubballi.hub@comedkares.org',       password: 'eZ7w!sF9BY0X1!'  },
};

const HUBQUIZ_URL = 'https://hubquiz.vercel.app';

function htmlRedirect(url, message = 'Signing you in...') {
  // JS redirect preserves the hash fragment, HTTP 302 does not.
  return new Response(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>HubQuiz - Signing In</title>
  <style>
    body { margin:0; display:flex; align-items:center; justify-content:center;
           height:100vh; flex-direction:column; gap:16px;
           font-family:sans-serif; background:#f9fafb; }
    .spinner { width:48px; height:48px; border:5px solid #e5e7eb;
               border-top-color:#1a234e; border-radius:50%;
               animation:spin 0.8s linear infinite; }
    p { color:#1a234e; font-size:1.1rem; font-weight:600; }
    @keyframes spin { to { transform:rotate(360deg); } }
  </style>
</head>
<body>
  <div class="spinner"></div>
  <p>${message}</p>
  <script>
    // Use JS redirect so the hash fragment is preserved by the browser
    window.location.href = ${JSON.stringify(url)};
  </script>
</body>
</html>`, {
    headers: { 'Content-Type': 'text/html;charset=UTF-8' },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const hubId = url.searchParams.get('hub');

    if (!hubId || !HUB_MAP[hubId]) {
      return htmlRedirect(HUBQUIZ_URL, 'Redirecting...');
    }

    const { email, password } = HUB_MAP[hubId];
    const supabaseUrl = env.SUPABASE_URL;
    const anonKey    = env.SUPABASE_ANON_KEY;

    try {
      const authRes = await fetch(
        `${supabaseUrl}/auth/v1/token?grant_type=password`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': anonKey,
          },
          body: JSON.stringify({ email, password }),
        }
      );

      if (!authRes.ok) {
        console.error('Supabase auth failed:', authRes.status, await authRes.text());
        return htmlRedirect(HUBQUIZ_URL, 'Redirecting to login...');
      }

      const session = await authRes.json();
      const { access_token, refresh_token, expires_in } = session;

      // Build the redirect URL with tokens in the hash.
      // We use JS redirect (not HTTP 302) so the hash is preserved.
      const redirectUrl = `${HUBQUIZ_URL}/#access_token=${encodeURIComponent(access_token)}&refresh_token=${encodeURIComponent(refresh_token)}&expires_in=${expires_in}&token_type=bearer&type=sso`;

      return htmlRedirect(redirectUrl, 'Signing you in...');

    } catch (err) {
      console.error('Worker error:', err.message);
      return htmlRedirect(HUBQUIZ_URL, 'Redirecting...');
    }
  },
};
