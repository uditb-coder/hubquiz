import zlib
import base64
import urllib.request

def fetch_img(diagram, filename):
    compressed = zlib.compress(diagram.encode('utf-8'), 9)
    payload = base64.urlsafe_b64encode(compressed).decode('ascii')
    req = urllib.request.Request(
        f'https://kroki.io/mermaid/png/{payload}', 
        headers={'User-Agent': 'Mozilla/5.0'}
    )
    with urllib.request.urlopen(req) as response, open(filename, 'wb') as out_file:
        out_file.write(response.read())

diagram1 = '''flowchart TD
    subgraph Custom LMS
        LMS[LMS Dashboard] -->|Clicks SSO Link| CW(Cloudflare Worker SSO)
    end

    subgraph Edge
        CW -->|Fetches Auth Token| NGROK
        V[Vercel Frontend] -->|API & WebSockets| NGROK
    end

    subgraph JP Nagar Server
        NGROK[Ngrok Static Domain] -->|Port 54321| S_API[Supabase API / Kong]
        S_API --> S_DB[(PostgreSQL)]
        S_API --> S_RT[Supabase Realtime]
    end
    
    CW -->|Redirects with Token| V
    Student[Student Phone] --> V
    Mentor[Mentor Laptop] --> V'''

fetch_img(diagram1, r'C:\Users\DELL\.gemini\antigravity\brain\e80765cf-4531-4f18-b716-d4497fd46e04\HubQuiz_Architecture_Diagram.png')

diagram2 = '''sequenceDiagram
    participant M as Mentor (Frontend)
    participant S as Supabase (Backend)
    participant P as Student (Frontend)

    M->>S: Create game_session & generate PIN
    P->>S: Insert into players using PIN
    S-->>M: Realtime Broadcast: New Player Joined
    M->>S: Update session status to active
    S-->>P: Realtime Broadcast: Quiz Started
    
    loop Every Question
        M->>S: Update current_question_index
        S-->>P: Broadcast new question (No answers sent!)
        P->>S: Call submit_answer RPC (PostgreSQL)
        S-->>M: Broadcast answer count updated
    end
    
    M->>S: Update session status to finished
    S-->>P: Broadcast Quiz Over'''

fetch_img(diagram2, r'C:\Users\DELL\.gemini\antigravity\brain\e80765cf-4531-4f18-b716-d4497fd46e04\HubQuiz_DataFlow_Diagram.png')
print('Done!')
