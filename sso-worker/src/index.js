// HubQuiz SSO Worker - v3
// Uses JS redirect with query params (not hash - hash is stripped by HTTP redirects).
// app.js reads at/rt params and calls setSession() directly.

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
    // window.location.href preserves query params; HTTP 302 does too.
    // We use JS here so this spinner page is visible briefly.
    window.location.href = ${JSON.stringify(destination)};
  </script>
</body>
</html>`, { headers: { 'Content-Type': 'text/html;charset=UTF-8' } });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const hubId = url.searchParams.get('hub');

    if (!hubId || !HUB_MAP[hubId]) {
      return Response.redirect(HUBQUIZ_URL, 302);
    }

    const { email, password } = HUB_MAP[hubId];
    const supabaseUrl = env.SUPABASE_URL;
    const anonKey    = env.SUPABASE_ANON_KEY;

    try {
      const targetUrl = `${supabaseUrl}/auth/v1/token?grant_type=password`;
      const authRes = await fetch(
        targetUrl,
        {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json', 
            'apikey': anonKey || 'missing',
            'ngrok-skip-browser-warning': 'true'
          },
          body: JSON.stringify({ email, password }),
        }
      );

      if (!authRes.ok) {
        const errorText = await authRes.text();
        const debugInfo = `URL: ${targetUrl} | Email: ${email} | Status: ${authRes.status} | Body: ${errorText}`;
        console.error('Auth failed:', debugInfo);
        return spinnerPage(`${HUBQUIZ_URL}/?sso_error=${encodeURIComponent(debugInfo)}`);
      }

      const { access_token, refresh_token } = await authRes.json();

      // Pass tokens as query params - they survive both HTTP redirects and JS redirects.
      // app.js reads ?at=...&rt=... and calls supabase.auth.setSession() directly.
      const dest = `${HUBQUIZ_URL}/?at=${encodeURIComponent(access_token)}&rt=${encodeURIComponent(refresh_token)}`;
      return spinnerPage(dest);

    } catch (err) {
      console.error('Worker error:', err.message);
      return spinnerPage(`${HUBQUIZ_URL}/?worker_error=${encodeURIComponent(err.message)}`);
    }
  },
};
