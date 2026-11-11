# 05. Architecture and Decisions

## System Architecture Overview

HubQuiz employs a resilient hybrid architecture designed to maintain high availability under zero-budget constraints: a globally distributed static frontend decoupled from a dual-backend database tier (an on-premises primary server and a cloud failover instance), bridged by a secure edge tunnel and a serverless Single Sign-On (SSO) worker [code or files] [Designed].

```
                     ┌─────────────────────────────┐
                     │ Custom Regional LMS Portal  │
                     └──────────────┬──────────────┘
                                    │ (Clicks "Start Live Quiz")
                                    ▼
                     ┌─────────────────────────────┐
                     │ Cloudflare Worker SSO Edge  │
                     └──────┬───────────────┬──────┘
                            │ (1. Try Local)│ (2. Fallback)
                            ▼               ▼
┌─────────────────────────────────┐   ┌─────────────────────────────────┐
│ Primary Server (On-Premises PC) │   │ Cloud Backend (Disaster Backup) │
│ - Host: Local Desktop Hub       │   │ - Host: Managed Cloud Provider  │
│ - Stack: Dockerized PostgreSQL, │   │ - Limit: 200 Max Connections    │
│   PostgREST, Realtime engine    │   │ - Status: Active Standby        │
│ - Tunnel: Static Ngrok domain   │   │                                 │
└────────────────┬────────────────┘   └────────────────┬────────────────┘
                 │ (WebSocket & REST)                  │ (WebSocket & REST)
                 └──────────────┐       ┌──────────────┘
                                ▼       ▼
                     ┌─────────────────────────────┐
                     │ Static Frontend Client      │
                     │ - Host: Vercel CDN          │
                     │ - Stack: Vanilla HTML/CSS/JS│
                     └──────────────┬──────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    ▼                               ▼
       ┌────────────────────────┐      ┌────────────────────────┐
       │ Instructor Laptop      │      │ Student Smartphones    │
       │ (Projector Display)    │      │ (Browser, Zero Login)  │
       └────────────────────────┘      └────────────────────────┘
```

---

## 1. Core Technical Components

### A. Static Web Frontend
* **Hosting**: Distributed globally via Vercel CDN edge nodes [code or files] [Designed].
* **Technology Stack**: Pure Vanilla ECMAScript 6, HTML5, and CSS3. Strictly zero heavy JavaScript framework dependencies (e.g. no React, Vue, or Next.js build overhead) [code or files] [Designed].
* **Performance Rationale**: Minimizes client-side payload footprints (<250 KB total transfer), enabling instant initial page renders on low-end smartphones connected to congested 3G or 4G mobile networks [code or files] [Designed].
* **State Management**: Orchestrated via a unified, reactive client-side state controller (`app.js`) coordinating views, timers, audio engines, and channel subscriptions [code or files] [Designed].

### B. Dual-Tier Backend & Database Engine
* **Primary Server (On-Premises Desktop)**:
  * **Location**: Physical desktop workstation situated at a primary regional innovation hub [code or files] [Measured].
  * **Engine**: Full self-hosted containerized Supabase stack (PostgreSQL database, GoTrue authentication, PostgREST API gateway, and Realtime WebSocket daemon) running via Docker [code or files] [Measured].
  * **Connection Limits**: High concurrency (supporting large campus cohorts without connection throttling) [code or files] [Measured].
  * **Networking Tunnel**: Connected to the public web via a static Ngrok edge tunnel, secured with automated Windows service startup scripts to guarantee automatic recovery after system reboots [code or files] [Measured].
* **Secondary Server (Cloud Disaster Recovery)**:
  * **Role**: Automated disaster recovery fallback taking over when the local desktop experiences facility power outages or local internet downtime [code or files] [Designed].
  * **Connection Limits**: Bound to free-tier ceiling of 200 concurrent Realtime WebSocket connections [conversation, code or files] [Measured].

### C. Failover Logic & Client Routing
* **Healthcheck Detection**: Upon application launch, the frontend executes a synchronous 3-to-5 second healthcheck ping against the primary local server endpoint [code or files] [Designed].
* **Automated Redirection**: If the primary endpoint fails to respond within the timeout window, client requests automatically fall back to the secondary cloud instance [code or files] [Designed].
* **Visual Status Indication**: The mentor dashboard injects a live visual indicator badge in the navigation bar showing the active host server and alerting instructors when operating under cloud concurrency limits [conversation, code or files] [Designed].

### D. Single Sign-On (SSO) Edge Gateway
* **Technology**: Serverless Cloudflare Edge Worker [code or files] [Designed].
* **Operational Flow**: Mentors click an embedded assessment link in their institutional portal. The worker intercepts the request, maps the regional center identifier, retrieves corresponding authentication credentials from secure environment variables, queries the active database to generate short-lived JWT tokens, and redirects the mentor directly into the authenticated host dashboard, completely scrubbing tokens from the final browser address bar [code or files] [Designed].

---

## 2. Security and Anti-Cheat Architecture

### Server-Side Answer Evaluation & Scoring
* Rather than trusting client devices to report answer validity, answer verification is executed entirely inside a PostgreSQL stored procedure (`submit_answer`) running under `SECURITY DEFINER` privileges [code or files] [Designed].
* The procedure verifies active question timing, evaluates correctness against the private `questions` table, calculates a decaying speed bonus (1000 points at 0 seconds decaying linearly to 500 points at 30 seconds), writes the result to `answers`, and updates the player total score atomically [code or files] [Designed].

### Sanitized Student Schema Views
* To prevent technical students from inspecting client network requests or local memory to view answer keys, students read questions exclusively through a sanitized database view (`student_questions`) [code or files] [Designed].
* This view intentionally excludes the `correct_option` column entirely on the server side, ensuring answer keys never physically transmit over the network until the host advances to the reveal phase [code or files] [Designed].

### Cryptographic Anonymity for Micro-Surveys
* Survey submissions (`hubquiz_survey_responses`) are inserted into an isolated table with zero foreign keys, zero user IDs, zero player IDs, and zero session IDs [conversation, code or files] [Designed].
* Account completion flags are recorded in a separate status table (`mentor_survey_state`) that possesses zero relational connections to response records, preventing any internal or external actor from linking specific feedback to individual mentors [conversation, code or files] [Designed].

---

## 3. Decision Log

| Date | Decision | Options Considered | Rationale | What Changed Later |
| :--- | :--- | :--- | :--- | :--- |
| **Aug 17, 2026** | Build minimal Kahoot-style quiz on vanilla JS + Supabase [conversation] [Designed] | React / Next.js vs Vanilla HTML/CSS/JS [conversation] [Designed] | Zero build tool complexity, instant load on poor mobile networks [conversation, code or files] [Designed] | Maintained throughout all releases [code or files] [Designed] |
| **Aug 17, 2026** | Domain restriction for mentor authentication [conversation] [Designed] | Open signup vs admin approval vs domain check [conversation] [Designed] | Enforced mentor logins strictly to educational foundation domains [conversation, code or files] [Designed] | Maintained; added LMS SSO gateway [code or files] [Designed] |
| **Aug 17, 2026** | Add open-ended text response questions [conversation] [Designed] | Strict 4-option MCQ only vs open text input [conversation] [Designed] | Facilitators required formative brainstorming and vocabulary checks [conversation, code or files] [Designed] | Added `05_open_ended.sql` migration [code or files] [Designed] |
| **Aug 18, 2026** | Add client-side session reconnection [conversation] [Designed] | Hard session drop vs local storage persistence [conversation] [Designed] | Students were dropped when phone screens locked or reloaded [conversation, code or files] [Observed] | Built `localStorage` player state cache [code or files] [Designed] |
| **Aug 18, 2026** | Add active host session recovery modal [conversation] [Designed] | Immediate dashboard redirect vs resume modal [conversation] [Designed] | Accidental laptop browser refresh lost live running games [conversation, code or files] [Observed] | Added "Active Game Found" modal in `app.js` [code or files] [Designed] |
| **Aug 29, 2026** | Transition to dual-tier self-hosted architecture [conversation] [Measured] | Cloud-only paid upgrade vs on-premises self-hosted [conversation] [Measured] | Free cloud tier capped at 200 live connections; budget was zero [conversation, code or files] [Measured] | Deployed local Docker + Cloud failover [code or files] [Measured] |
| **Sep 10, 2026** | Establish Single Sign-On edge worker [code or files] [Designed] | Separate login credentials vs LMS embedded SSO [code or files] [Designed] | Mentors complained of memorizing dual sets of login passwords [code or files] [Observed] | Deployed Cloudflare Worker SSO layer [code or files] [Designed] |
| **Oct 27, 2026** | Drop dedicated classroom Wi-Fi router setup [conversation] [Observed] | Portable local Wi-Fi router vs cellular data [conversation] [Observed] | Hardware transport and setup friction was excessive [conversation] [Observed] | Fully standardized on web-only access [conversation] [Observed] |
| **Nov 09, 2026** | Provision dedicated parallel mentor accounts [conversation] [Observed] | 1 shared account per hub vs unique section sub-accounts [conversation] [Observed] | Shared hub accounts at multi-batch colleges caused instructors to end each other's live games [conversation] [Observed] | Added dedicated sub-accounts for parallel tracks [conversation, code or files] [Designed] |
| **Nov 09, 2026** | Deploy decoupled anonymous post-quiz surveys [conversation] [Designed] | Linked survey rows vs decoupled anonymous state [conversation] [Designed] | True anonymity required complete decoupling of tracking flags from answer rows [conversation, code or files] [Designed] | Added `hubquiz_survey_responses` and `mentor_survey_state` [code or files] [Designed] |
| **Nov 09, 2026** | Implement automated monthly audit script [conversation, code or files] [Designed] | Manual monthly SQL exports vs automated cron sidecar [conversation, code or files] [Designed] | Central operations required recurring monthly digest without manual data pulling [conversation, code or files] [Designed] | Deployed `monthly_audit.py` automation [code or files] [Designed] |
