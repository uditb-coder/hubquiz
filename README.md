# HubQuiz Setup Guide

HubQuiz is a Kahoot-style live quiz platform built with vanilla HTML/CSS/JS and Supabase.

---

## 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign in.
2. Click **New Project** and give it a name (e.g. `hubquiz`).
3. Choose a password and region, then click **Create new project**.
4. Wait for the project to finish provisioning (~1-2 minutes).

---

## 2. Run the SQL Migrations

In your Supabase project, go to **SQL Editor** and run each file in order:

| Step | File | Description |
|---|---|---|
| 1 | `sql/01_schema.sql` | Creates all tables, enums, indexes |
| 2 | `sql/02_functions.sql` | Server-side scoring + helper functions |
| 3 | `sql/03_rls.sql` | Row Level Security policies |
| 4 | `sql/04_cron.sql` | Auto-delete finished sessions after 24h |

> **Note for step 4:** First enable the `pg_cron` extension in **Database → Extensions → pg_cron**, then run `04_cron.sql`.

---

## 3. Enable Realtime

In Supabase Dashboard → **Database → Replication**, make sure these tables have Realtime enabled:
- `game_sessions`
- `players`
- `answers`

_(The schema SQL already runs `ALTER PUBLICATION supabase_realtime ADD TABLE ...` — just verify.)_

---

## 4. Configure Your Credentials

Open `supabase.js` and replace the placeholder values:

```js
const SUPABASE_URL  = 'https://YOUR_PROJECT_REF.supabase.co';
const SUPABASE_ANON = 'YOUR_ANON_PUBLIC_KEY';
```

Find these values in Supabase Dashboard → **Project Settings → API**:
- **Project URL** → `SUPABASE_URL`
- **anon public** key → `SUPABASE_ANON`

---

## 5. Configure Auth Settings

In Supabase Dashboard → **Authentication → Settings**:
- **Site URL:** set to your deployment URL (e.g. `https://hubquiz.netlify.app`)
- **Email confirmations:** can be turned OFF for testing, ON for production
- Under **Redirect URLs**, add your deployment URL

---

## 6. Deploy

### Option A: Netlify (Recommended)

1. Drag-and-drop the `D:\HubQuiz\` folder onto [app.netlify.com/drop](https://app.netlify.com/drop)
2. Netlify assigns a URL like `https://random-name.netlify.app`
3. Update the Supabase Auth **Site URL** to match
4. Create a `_redirects` file in your project root (for client-side routing):
   ```
   /* /index.html 200
   ```

### Option B: Vercel

1. Push the folder to a GitHub repo
2. Import it on [vercel.com](https://vercel.com)
3. Add a `vercel.json` for routing:
   ```json
   {
     "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
   }
   ```

### Option C: GitHub Pages

1. Push to a repo and enable Pages on the `main` branch
2. Since GitHub Pages doesn't support SPA routing, add a `404.html` that redirects to `index.html`

---

## 7. Test the App

Open a browser to your deployment URL and:

1. Navigate to `/login` → Create a mentor account → Sign in
2. Create a quiz with 3+ questions
3. Click **Start Session** → PIN appears
4. Open a second browser tab (incognito) → Navigate to `/play`
5. Enter the PIN + a name → Join
6. Back on host tab → click **Start Quiz**
7. Play through all questions → verify leaderboard appears

---

## File Structure

```
D:\HubQuiz\
├── index.html          ← SPA shell with all 11 views
├── style.css           ← Full design system
├── app.js              ← Router + all game logic
├── audio.js            ← Web Audio API sound engine
├── confetti.js         ← Canvas confetti engine
├── supabase.js         ← Supabase client (EDIT THIS FIRST)
├── sql/
│   ├── 01_schema.sql   ← Tables, enums, indexes
│   ├── 02_functions.sql ← submit_answer, leaderboard functions
│   ├── 03_rls.sql      ← Row Level Security
│   └── 04_cron.sql     ← Auto-cleanup (requires pg_cron)
├── assets/
│   └── logo.png        ← ComedKares logo
└── README.md           ← This file
```

---

## Scoring Formula

Correct answer points are speed-weighted:
- At 0 seconds elapsed: **1000 points**
- At 30 seconds elapsed: **500 points**
- Linear interpolation: `points = 1000 - floor((elapsed/30) * 500)`
- Wrong answer: **0 points**

Computed server-side in the `submit_answer()` Postgres function. The client cannot manipulate scores.

---

## RLS Security Model

| Table | Student (anon) | Mentor (authenticated) |
|---|---|---|
| `quizzes` | No access | Read all, Write own |
| `questions` | Read (during game) | Read all, Write own |
| `game_sessions` | Read by PIN | Read/Write own |
| `players` | Insert self, Read all | Read all |
| `answers` | Via function only | Read all |

---

## Sound Effects

All audio is synthesised entirely using the **Web Audio API** — no external files are needed. The engine in `audio.js` generates:
- Lobby ambient music (looping oscillator chords)
- Countdown tension sounds
- Per-second tick
- Answer locked chime
- Time's up descending blurp
- Correct answer arpeggio (major chord)
- Incorrect answer blip (minor)
- Reveal drumroll (noise burst)
- Final fanfare (ascending arpeggio + chord)

Use the 🔊 mute toggle (top-right on every screen) to toggle all audio.
