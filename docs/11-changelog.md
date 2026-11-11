# 11. Engineering Changelog and Build History

## Overview

This changelog chronicles the engineering evolution of HubQuiz, synthesized chronologically from git commit logs, database schema migrations, and project trajectory transcripts [conversation, code or files] [Measured].

---

## August 2026: Genesis and Core Engine

### August 17, 2026: Initial Architecture & Proof of Concept
* **Milestone**: Project Kickoff via comprehensive build prompt [conversation] [Designed].
* **Deliverables**:
  * Scoped minimal Kahoot-style mechanics: 2 roles, 2 screens, 30-second global countdown, 6-digit session PIN [conversation, code or files] [Designed].
  * Deployed pure Vanilla HTML/CSS/JS frontend to Vercel CDN (`hubquiz.vercel.app`) [code or files] [Designed].
  * Built initial Supabase PostgreSQL schema (`quizzes`, `questions`, `game_sessions`, `players`, `answers`) with Row Level Security (RLS) [code or files] [Designed].
  * Enforced mentor authentication restrictions strictly to educational foundation email domains [conversation, code or files] [Designed].
  * Implemented server-side scoring stored procedure with decaying speed bonus [code or files] [Designed].
* **Git Activity**: Initial repository initialization and deployment setup [code or files] [Measured].

### August 17, 2026 (Night): Open-Ended Extension & UI Theming
* **Milestone**: Multi-format question support and styling adaptations [conversation, code or files] [Designed].
* **Deliverables**:
  * Adapted user interface from pure dark theme to branded light theme, introducing ComedKares gold and navy visual elements [conversation, code or files] [Designed].
  * Added QR code generation on host lobby screen linking to student join URL [conversation, code or files] [Designed].
  * Implemented SQL migration `05_open_ended.sql`, adding `question_type` column, making MCQ options nullable, and authoring `submit_open_answer` stored procedure for text input [conversation, code or files] [Designed].

### August 18, 2026: Internal Pilot Testing & Hardening
* **Milestone**: Real-room testing feedback remediation [conversation, code or files] [Observed].
* **Deliverables**:
  * Fixed phone screen sleep disconnects by caching player tokens in mobile `localStorage` and adding automatic reconnection handlers [conversation, code or files] [Designed].
  * Added "Active Game Found" modal on host dashboard to prevent accidental browser refresh from killing running games [conversation, code or files] [Designed].
  * Resolved light theme white-on-white text contrast bugs across participant answer screens [conversation, code or files] [Designed].
  * Deferred correct answer reveal until host transitions to points table to preserve student suspense [conversation, code or files] [Designed].
  * Added student post-question feedback view displaying points earned, current position, and encouraging copy [conversation, code or files] [Designed].
  * Built 24-hour Game PIN history in mentor dashboard [conversation, code or files] [Designed].
  * Swapped countdown timer audio with custom 30-second game show MP3 track [conversation, code or files] [Designed].
  * Injected 6 standardized VTU Innovation & Design Thinking Lab curriculum template quizzes into database [conversation, code or files] [Designed].
  * Added lobby "Cancel Quiz" button for early exits [conversation, code or files] [Designed].

### August 20 - 27, 2026: Concurrency Limits & Scaling Strategy
* **Milestone**: Identification of free-tier connection thresholds [conversation, code or files] [Measured].
* **Deliverables**:
  * Diagnosed 200 concurrent Realtime WebSocket connection ceiling on cloud backend [conversation, code or files] [Measured].
  * Formulated plan to prevent project-wide dropouts during simultaneous multi-center workshops [conversation, code or files] [Designed].

### August 29, 2026: Dual-Tier On-Premises Architecture
* **Milestone**: Transition to local Dockerized backend with cloud failover [conversation, code or files] [Measured].
* **Deliverables**:
  * Deployed containerized Supabase instance on local desktop computer at primary regional hub [conversation, code or files] [Measured].
  * Configured static edge tunnel to expose local port 54321 to public web without requiring local Wi-Fi pairing [conversation, code or files] [Measured].
  * Engineered client failover logic in `supabase.js` to execute automatic 3-second healthcheck fallback to cloud backup [code or files] [Designed].

---

## September 2026: Enterprise Hardening and SSO

### September 10, 2026: Hub Account Provisioning & SSO Gateway
* **Milestone**: Multi-center operational rollout and LMS Single Sign-On [conversation, code or files] [Designed].
* **Deliverables**:
  * Provisioned dedicated mentor credentials across nine regional innovation centers [conversation, code or files] [Designed].
  * Deployed serverless Cloudflare Edge Worker (`hubquiz-sso`) to provide seamless 1-click authentication from custom LMS portal [code or files] [Designed].
  * Implemented Windows startup background script on local host desktop ensuring Ngrok tunnel auto-boots silently after power outages [code or files] [Designed].

### September 21, 2026: Failover UI & Administrative Telemetry
* **Milestone**: Server transparency and admin dashboard [conversation, code or files] [Designed].
* **Deliverables**:
  * Injected Server Status Badge in mentor and admin dashboard headers, displaying live connection mode (Primary On-Premises vs Cloud Fallback) and capacity warnings [conversation, code or files] [Designed].
  * Built dedicated `/admin` dashboard restricted to administrative credentials, displaying live active sessions and concurrent connected players [code or files] [Designed].

---

## October 2026: Institutional Deployment and Analytics

### October 22 - 31, 2026: Institutional Campus Program
* **Milestone**: High-volume classroom delivery at engineering partner institution (RNSIT) [conversation, code or files] [Measured].
* **Deliverables**:
  * Conducted classroom assessment deliveries across multi-batch departmental cohorts [conversation, code or files] [Measured].
  * Integrated Vercel Web Analytics tracking to monitor visitor volume and session pageviews [conversation, code or files] [Measured].
  * Dropped dedicated hardware classroom Wi-Fi router concept in favor of zero-friction mobile web access [conversation] [Observed].

---

## November 2026: Governance, Anonymity, and Automation

### November 02, 2026: RNSIT Pre-Assessment Curricular Sync
* **Milestone**: Ingestion of official 14-question Design Thinking pre-assessment [code or files] [Measured].
* **Deliverables**:
  * Extracted questions from institutional curriculum spreadsheet and synced to all mentor accounts on both database instances [code or files] [Measured].

### November 06, 2026: Adoption Review & Video Guide Initiative
* **Milestone**: Discovery of mentor adoption barriers [conversation] [Observed].
* **Deliverables**:
  * Documented mentor adoption reluctance in conversation logs [conversation] [Observed].
  * Authored comprehensive video guide explainer prompt for instructional coaching [conversation, code or files] [Designed].

### November 09, 2026: Parallel Sub-Accounts & Decoupled Micro-Surveys
* **Milestone**: Anti-collision scaling and anonymous feedback engine [conversation, code or files] [Measured].
* **Deliverables**:
  * Provisioned 7 dedicated section accounts (`rns-1` through `rns-7`) on both database instances to prevent mentors in parallel sections from terminating each other's live games [conversation, code or files] [Measured].
  * Designed and deployed post-quiz anonymous micro-survey engine (v1) with 3 mentor questions and 2 student questions [conversation, code or files] [Measured].
  * Implemented decoupled database architecture (`hubquiz_survey_responses` and `mentor_survey_state`) guaranteeing zero PII and zero relational linkage to answers [conversation, code or files] [Measured].
  * Built capped "Not now" postponement routine (maximum 3 dismissals) [conversation, code or files] [Measured].
  * Engineered automated monthly audit background script (`monthly_audit.py`) and scheduled sidecar [conversation, code or files] [Measured].
  * Updated statewide management reports and mentor briefings with complete survey documentation [code or files] [Measured].
* **Git Commits**:
  * `0968cab`: *feat: add post-quiz anonymous micro-surveys for mentors and students with decoupled tracking* [code or files] [Measured].
  * `96239ef`: *feat: add automated monthly audit script for feedback and quiz analytics* [code or files] [Measured].
