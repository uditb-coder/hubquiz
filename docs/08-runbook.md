# 08. Operational Runbook

## Overview

This runbook establishes standard operating procedures (SOPs) for classroom facilitators, regional operations staff, and system administrators operating HubQuiz [code or files] [Designed].

---

## 1. Starting a Live Classroom Quiz Session (Instructor Walkthrough)

### Phase 1: Pre-Session Setup (5 Minutes Prior to Class)
1. **Connect Display**: Connect the instructor laptop to the classroom projector or large television display via HDMI or wireless cast [conversation, code or files] [Designed].
2. **Access Portal**: Open a modern web browser and navigate to the application URL, or click the **Start Live Quiz** link directly from your institutional LMS dashboard [code or files] [Designed].
3. **Log In**: Enter your assigned mentor credentials (ending in `@erafoundationindia.org` or `@comedkares.org`). If accessing via the LMS Single Sign-On link, authentication completes automatically [conversation, code or files] [Designed].
4. **Verify Server Status**: Inspect the Server Status Badge in the top right corner:
   * **Green Badge**: Connected to Primary On-Premises Server (Unlimited Concurrency) [code or files] [Designed].
   * **Orange Badge**: Connected to Secondary Cloud Server (Capped at 200 Concurrent Devices) [code or files] [Designed].

### Phase 2: Launching the Lobby
1. **Select Quiz**: Under the dashboard quiz list, select the target curriculum quiz (e.g. VTU Week 1 to 6 module, or custom quiz) [conversation, code or files] [Designed].
2. **Click Start Session**: Click the green **Start Session** button. The system generates a unique 6-digit PIN and renders the host lobby screen [code or files] [Designed].
3. **Project to Room**: Maximize browser window (press F11 for fullscreen). Project the lobby screen displaying the large PIN and join QR code [conversation, code or files] [Designed].
4. **Student Entry**: Instruct students to scan the QR code with their mobile cameras, or visit the join URL and type the 6-digit PIN followed by their name [conversation, code or files] [Designed].
5. **Monitor Lobby Count**: Watch player nicknames appear dynamically on the screen. Confirm joined count aligns with classroom attendance [code or files] [Designed].

### Phase 3: Live Gameplay & Question Control
1. **Launch Game**: Once the cohort has joined, click **Start Quiz** [code or files] [Designed].
2. **Question Countdown**: Question text, four colored shape blocks, and a 30-second countdown bar appear on the projector screen. Students tap matching blocks on their phones [code or files] [Designed].
3. **Reveal Mode**: When the timer reaches zero (or all students submit early), the system displays the correct answer highlighted in green and shows a bar chart of class responses [code or files] [Designed].
4. **Formative Review**: Spend 30 to 60 seconds discussing the answer distribution, especially if a large proportion of the room selected an incorrect option [my account] [Designed].
5. **Leaderboard**: Click **Next** to display the top student leaderboard and score progression [code or files] [Designed].
6. **Repeat**: Repeat through all questions until the final podium screen appears, displaying 1st, 2nd, and 3rd place winners with celebratory confetti [code or files] [Designed].

### Phase 4: Session Wrap-Up
1. **End Session**: Click **End Session** to terminate the session and clear socket connections [code or files] [Designed].
2. **Complete Anonymous Survey**: If the 3-question mentor feedback modal appears, select your responses (or tap "Not now" if transitioning between rapid classes). Submissions are completely anonymous [conversation, code or files] [Designed].

---

## 2. Dual-Server Failover Verification & Manual Toggle

### Automated Failover Behavior
* The application runs an automatic 3-to-5 second healthcheck ping against the primary on-premises server upon initial client load [code or files] [Designed].
* If the primary local server is offline, the client automatically points all WebSocket and REST calls to the cloud disaster-recovery instance [code or files] [Designed].

### Manual Server Switch Procedure (Admin Only)
1. Log in using authorized central administrative credentials (`admin@comedkares.org`) [code or files] [Designed].
2. Navigate to the admin dashboard route (`/#/admin`) [code or files] [Designed].
3. Locate the **Server Management** card displaying current server connectivity [code or files] [Designed].
4. Click **Switch to Cloud** or **Switch to Primary Server** [code or files] [Designed].
5. Confirm the browser prompt. The client updates global server variables and re-executes authentication instantly [code or files] [Designed].

---

## 3. Provisioning a New College, Center, or Parallel Mentor Account

### Operational Context
To prevent instructors delivering concurrent sections from accidentally overriding each other's live sessions, every parallel teaching track must use an isolated account [conversation] [Observed].

### Step-by-Step Account Creation Procedure:
1. **Generate Identifier**: Define a standardized account email conforming to organizational domain rules (e.g. `center-section@erafoundationindia.org`) [conversation, code or files] [Designed].
2. **Execute Provisioning Script**:
   * Run the administrative provisioning script against **both** the primary local database and the cloud database instances [conversation, code or files] [Designed].
   * The script creates the user in `auth.users`, sets a secure temporary password, and marks the email as confirmed [code or files] [Designed].
3. **Synchronize Curriculum Quizzes**:
   * Run the quiz synchronization script to clone the standard university syllabus question bank into the newly created user account [code or files] [Designed].
4. **Deliver Credentials**: Transmit credentials securely to the designated lead facilitator. Advise them to verify login 24 hours prior to first classroom delivery [conversation, code or files] [Designed].

---

## 4. Disaster Recovery: Power Cuts & Tunnel Failures

### Scenario A: Local Workstation Power Cut at Host Site
* **Symptom**: Primary on-premises server drops offline; browser shows healthcheck timeout [conversation] [Observed].
* **System Automated Response**: The application automatically redirects all active and incoming traffic to the Cloud Supabase fallback instance [code or files] [Designed].
* **Instructor Action**: None required. Mentors will observe the Server Badge change from Green (Primary) to Orange (Cloud Fallback) [code or files] [Designed].
* **Capacity Constraint Warning**: Mentors must ensure combined concurrent devices do not exceed the 200-device cloud limit during fallback operation [conversation, code or files] [Measured].

### Scenario B: Ngrok Edge Tunnel Interruption
* **Symptom**: Local computer remains powered on, but public static tunnel drops [code or files] [Observed].
* **System Owner Action**:
  1. Access the host workstation desktop.
  2. Verify if Docker Desktop containers (`supabase-db`, `supabase-kong`, `supabase-realtime`) are running.
  3. If tunnel process halted, launch the automated startup script (`run_tunnel.bat`) located on the system desktop [code or files] [Designed].
  4. The script reconnects to the permanent static domain silently.
  5. Confirm endpoint connectivity via healthcheck query [code or files] [Designed].

---

## 5. New Site Launch Readiness Checklist

Complete this checklist 24 hours before launching HubQuiz at a new institutional campus or college facility:

- [ ] **Classroom Display**: Laptop connects to projector/TV with readable resolution (1080p recommended) [code or files].
- [ ] **Cellular Coverage Check**: Facilitator smartphone verifies at least 2 bars of commercial 4G/5G signal inside the room [my account].
- [ ] **LMS / SSO Authentication**: Mentor signs into account and verifies that curriculum quizzes appear in the dashboard [code or files].
- [ ] **Server Badge Verification**: Confirm that Server Badge renders Green (Primary) or Orange (Cloud) [code or files].
- [ ] **Lobby Test**: Mentor starts a test session, joins via their own phone using the PIN, verifies display name appears, and ends test session [conversation, code or files].
- [ ] **Audio Check**: Confirm laptop speakers or projector audio can play the countdown timer music audibly across the room [conversation, code or files].
- [ ] **Survey Clearance**: Verify that test session entries are dismissed or cleared so live delivery starts clean [code or files].
