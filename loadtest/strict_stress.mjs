import WebSocket from 'ws';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://pxsemvrbchajuqhnetti.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB4c2VtdnJiY2hhanVxaG5ldHRpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY5Njk2NTcsImV4cCI6MjEwMjU0NTY1N30.wBgG5qUjrRLC8Od41RrM_dIjC8VXrb9FeyvfO4dIBkE';

const PIN = '820441';
const NUM_BOTS = 850;

const masterClient = createClient(SUPABASE_URL, SUPABASE_ANON);

async function run() {
  console.log(`Fetching session for PIN: ${PIN}...`);
  const { data: session, error } = await masterClient
    .from('game_sessions')
    .select('id')
    .eq('pin', PIN)
    .single();

  if (error || !session) {
    console.error("Could not find session", error);
    process.exit(1);
  }

  console.log(`Found session ${session.id}. Launching ${NUM_BOTS} raw WebSockets...`);

  let connectedCount = 0;
  let rejectedCount = 0;
  let errorCount = 0;

  const wsUrl = `wss://pxsemvrbchajuqhnetti.supabase.co/realtime/v1/websocket?apikey=${SUPABASE_ANON}&vsn=1.0.0`;

  for (let i = 0; i < NUM_BOTS; i++) {
    // stagger by 150ms
    await new Promise(r => setTimeout(r, 150));

    try {
        const botName = `RawBot_${i + 1}`;

        // 1. Insert player into database (using master client to not skew WS count)
        const { data: pData } = await masterClient.from('players').insert([{
            session_id: session.id,
            name: botName,
            score: 0
        }]).select();
        
        // 2. Open a raw WebSocket connection
        const ws = new WebSocket(wsUrl);

        ws.on('open', () => {
            // Join the Phoenix channel manually
            const joinPayload = {
                topic: `realtime:public:game_sessions:id=eq.${session.id}`,
                event: 'phx_join',
                payload: { config: {} },
                ref: '1'
            };
            ws.send(JSON.stringify(joinPayload));
        });

        ws.on('message', (data) => {
            const msg = JSON.parse(data.toString());
            
            // Check for connection success
            if (msg.event === 'phx_reply' && msg.ref === '1') {
                if (msg.payload.status === 'ok') {
                    connectedCount++;
                    if (connectedCount % 20 === 0) console.log(`Connected ${connectedCount} raw sockets.`);
                }
            }

            // Check for broadcast events (e.g. host started question)
            if (msg.event === 'broadcast' && msg.payload?.payload?.event === 'question:start') {
                const questionId = msg.payload.payload.question_id;
                const botId = pData[0].id;
                
                setTimeout(() => {
                     const options = ['a', 'b', 'c', 'd'];
                     const chosen = options[Math.floor(Math.random() * options.length)];
                     
                     // Use masterClient to submit answer so we don't need 850 auth headers manually
                     masterClient.rpc('submit_answer', {
                         p_player_id: botId,
                         p_question_id: questionId,
                         p_chosen: chosen
                     }).then(({error}) => {
                         if (error) console.error(`Bot ${botId} answer err:`, error.message);
                     });
                 }, Math.random() * 9000 + 1000);
            }
        });

        ws.on('error', (err) => {
            errorCount++;
            console.error(`Socket ${i+1} Error:`, err.message);
        });

        ws.on('unexpected-response', (request, response) => {
            rejectedCount++;
            console.error(`Socket ${i+1} Rejected: HTTP ${response.statusCode}`);
        });

    } catch (e) {
        console.error("Loop error", e);
    }
  }

  setInterval(() => {
    console.log(`Status: ${connectedCount} connected | ${rejectedCount} rejected | ${errorCount} errors`);
  }, 3000);
}

run();
