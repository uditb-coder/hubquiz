// HubQuiz SSO Worker
// Accepts ?hub=<hub_id>, signs in the hub account against local Supabase,
// and redirects to hubquiz.vercel.app with the session tokens in the URL hash.
// The browser/HubQuiz app detects the tokens and logs the user in automatically.

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

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const hubId = url.searchParams.get('hub');

    // ---- Unknown hub: fall through to normal login ----
    if (!hubId || !HUB_MAP[hubId]) {
      return Response.redirect(HUBQUIZ_URL, 302);
    }

    const { email, password } = HUB_MAP[hubId];
    const supabaseUrl = env.SUPABASE_URL;
    const anonKey    = env.SUPABASE_ANON_KEY;

    try {
      // Call Supabase's password grant endpoint to exchange creds for a session
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
        const err = await authRes.text();
        console.error('Supabase auth failed:', authRes.status, err);
        // Redirect to login page on failure — user can log in manually
        return Response.redirect(HUBQUIZ_URL, 302);
      }

      const session = await authRes.json();
      const { access_token, refresh_token, expires_in } = session;

      // Build the redirect URL with tokens in the hash fragment.
      // supabase-js with detectSessionInUrl: true will pick these up automatically.
      const redirectTo = new URL(HUBQUIZ_URL);
      redirectTo.hash = [
        `access_token=${encodeURIComponent(access_token)}`,
        `refresh_token=${encodeURIComponent(refresh_token)}`,
        `expires_in=${expires_in}`,
        `token_type=bearer`,
        `type=sso`,
      ].join('&');

      return Response.redirect(redirectTo.toString(), 302);

    } catch (err) {
      console.error('Worker error:', err.message);
      return Response.redirect(HUBQUIZ_URL, 302);
    }
  },
};
