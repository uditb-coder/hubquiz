import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://pxsemvrbchajuqhnetti.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB4c2VtdnJiY2hhanVxaG5ldHRpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY5Njk2NTcsImV4cCI6MjEwMjU0NTY1N30.wBgG5qUjrRLC8Od41RrM_dIjC8VXrb9FeyvfO4dIBkE';

const PIN = process.argv[2];
const NUM_BOTS = parseInt(process.argv[3]) || 50;

if (!PIN) {
  console.error("Please provide a PIN as the first argument.");
  process.exit(1);
}

// Master client to fetch session info
const masterClient = createClient(SUPABASE_URL, SUPABASE_ANON);

async function runBots() {
  console.log(`Fetching session for PIN: ${PIN}...`);
  const { data: session, error } = await masterClient
    .from('game_sessions')
    .select('id, status')
    .eq('pin', PIN)
    .single();

  if (error || !session) {
    console.error("Could not find active session with that PIN.", error);
    process.exit(1);
  }

  console.log(`Found session ${session.id}. Launching ${NUM_BOTS} bots...`);

  // To simulate actual concurrent connections, we need separate clients
  // OR we can just use the same client to insert players, but create separate channels if we wanted?
  // Actually, Supabase multiplexes channels over a single WebSocket.
  // To test the connection limit, we need actual separate clients configured to not multiplex, or just create them separately.
  // In Node, createClient usually creates one WebSocket per instance.
  
  const bots = [];
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < NUM_BOTS; i++) {
    // stagger the joins slightly
    await new Promise(r => setTimeout(r, 20));

    // Create a dedicated client for this bot to force a new WebSocket connection
    const botClient = createClient(SUPABASE_URL, SUPABASE_ANON, {
        auth: { persistSession: false }
    });

    const botName = `Bot_${i + 1}_${Math.floor(Math.random() * 1000)}`;

    botClient.from('players').insert([{
      session_id: session.id,
      name: botName,
      score: 0
    }]).select().then(async ({data, error}) => {
      if (error) {
        failCount++;
        console.error(`Bot ${i+1} failed to insert:`, error.message);
      } else {
        const botId = data[0].id;
        
        botClient.channel(`session:${session.id}`)
          .on('broadcast', { event: 'game:event' }, (payload) => {
             const ev = payload.payload;
             if (ev.event === 'question:start') {
                 // Random delay between 1 and 10 seconds to simulate human answering
                 setTimeout(() => {
                     const options = ['a', 'b', 'c', 'd'];
                     const chosen = options[Math.floor(Math.random() * options.length)];
                     botClient.rpc('submit_answer', {
                         p_player_id: botId,
                         p_question_id: ev.question_id,
                         p_chosen: chosen
                     }).then(({error}) => {
                         if (error) console.error(`Bot ${botId} answer err:`, error.message);
                     });
                 }, Math.random() * 9000 + 1000);
             }
          })
          .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
                successCount++;
                if (successCount % 20 === 0) console.log(`${successCount} bots connected successfully and ready to answer.`);
            } else {
                failCount++;
            }
          });
      }
    });
  }

  console.log("All join requests sent. Waiting for connections to establish...");
  // Keep script alive
  setInterval(() => {
    console.log(`Current Status: ${successCount} connected, ${failCount} failed.`);
  }, 5000);
}

runBots();
