# 02. Product Requirements Document (PRD)

## Product Identity

* **Product Name**: HubQuiz [conversation, code or files] [Designed]
* **Category**: Real-Time Formative Assessment Web Application [code or files] [Designed]
* **Target Environment**: Higher education engineering innovation labs and college smart classrooms [my account, conversation] [Observed]
* **Deployment Stage**: Initial Live Deployment [my account, conversation] [Observed]

---

## 1. Goals & Non-Goals

### Goals
* **G1: Sub-Second Assessment Visibility**: Enable instructors to review aggregate classroom comprehension within seconds of closing a question round [my account, code or files] [Designed].
* **G2: Frictionless Student Participation**: Allow any student with a smartphone browser to join a live game within 15 seconds using a 6-digit PIN and nickname, requiring zero app downloads or accounts [conversation, code or files] [Designed].
* **G3: Zero Marginal Software Cost**: Deliver full real-time interactive assessment functionality across all regional centres without recurring third-party software licensing fees [my account, code or files] [Designed].
* **G4: Multi-Cohort Scalability**: Support concurrent classroom delivery sessions exceeding 200 simultaneous connected student devices through an automated failover infrastructure [conversation, code or files] [Measured].
* **G5: Server-Side Integrity**: Prevent client-side cheating by stripping correct answers from network payloads and validating all scores server-side [code or files] [Designed].

### Non-Goals
* **NG1: Student Profile Persistence**: No student user accounts, passwords, historical portfolio tracking, or cross-session student logins will be built [conversation, code or files] [Designed].
* **NG2: Media-Rich Question Authoring**: No image, audio, or video file uploads within question prompts or option cards [conversation, code or files] [Designed].
* **NG3: Variable Question Timers**: No custom per-question countdown configurations; all timed questions enforce a uniform global 30-second duration [conversation, code or files] [Designed].
* **NG4: Team / Asynchronous Modes**: No multiplayer team collaboration modes, homework assignment links, or asynchronous offline play [conversation, code or files] [Designed].
* **NG5: Learning Outcome Verification**: No formal claims of validated academic score gains or long-term curricular retention (the product is in initial rollout) [my account] [Designed].

---

## 2. Users and Customer

* **The Users**:
  * **Instructors / Mentors**: Conduct live workshops. They log in, select or create quizzes, control the projection display, observe student submission velocity, review real-time response distributions, and advance questions [conversation, code or files] [Designed].
  * **Students**: Actively participate in the room. They join via personal mobile phones, read projected or mobile prompts, tap answer blocks within 30 seconds, and receive instant feedback on their rank and score [conversation, code or files] [Designed].
* **The Customer**:
  * **Instructors / Mentors**: The mentor is the primary customer because the software carries zero marginal cost to the organisation, and instructors alone exercise professional discretion in deciding whether to conduct a live quiz in their sessions or skip it [my account] [Observed].

---

## 3. User Stories & Acceptance Criteria

### US-1: Student Session Join
* **As a** student in a training lab,
* **I want to** join the live quiz by entering a 6-digit PIN and my name on my phone,
* **So that** I can participate immediately without registering an account.
* **Acceptance Criteria**:
  * **Given** an instructor has opened a session lobby with an active 6-digit PIN,
  * **When** a student visits the join screen, types the PIN and a nickname, and taps "Join Game",
  * **Then** the student enters the waiting lobby showing "You're in!" and their name appears live on the host screen within 500ms [code or files] [Designed].

### US-2: Host Session Launch & Realtime Countdown
* **As an** instructor,
* **I want to** project the question and start the 30-second timer,
* **So that** all students in the room answer simultaneously under equal time constraints.
* **Acceptance Criteria**:
  * **Given** at least one player has joined the session lobby,
  * **When** the instructor clicks "Start Quiz",
  * **Then** the projector displays Question 1, four coloured option cards, and an animated 30-second countdown bar driven by a server-side timestamp [code or files] [Designed].

### US-3: Student Mobile Answer Submission
* **As a** participating student,
* **I want to** tap one of the four coloured option cards on my phone screen,
* **So that** my answer is registered before the countdown reaches zero.
* **Acceptance Criteria**:
  * **Given** an active question is displayed with countdown running,
  * **When** the student taps an option block,
  * **Then** the tapped card highlights, other options lock, an "Answer Submitted" confirmation appears, and further input changes are blocked [code or files] [Designed].

### US-4: Server-Side Scoring & Anti-Cheat Validation
* **As an** assessment administrator,
* **I want** answers scored exclusively on the database server,
* **So that** technically savvy students cannot inspect browser network traffic to read answer keys.
* **Acceptance Criteria**:
  * **Given** a student submits an option choice,
  * **When** the RPC database function executes,
  * **Then** it validates the answer against the private questions table, computes speed-weighted points (up to 1000 points decaying to 500 at 30 seconds), and returns only the correctness and points awarded without exposing other question keys [code or files] [Designed].

### US-5: Question Reveal & Dynamic Points Table
* **As an** instructor,
* **I want to** view a bar chart of class responses followed by an updated leaderboard,
* **So that** I can explain the correct answer and recognize top-performing students.
* **Acceptance Criteria**:
  * **Given** the 30-second timer expires or all connected players submit answers,
  * **When** the host advances to reveal mode,
  * **Then** the projector shows the correct answer highlighted in green with participant counts per option, and advancing once more displays the updated top-five student leaderboard [code or files] [Designed].

### US-6: Host Session Recovery
* **As an** instructor,
* **I want my** active session preserved if my laptop browser accidentally refreshes,
* **So that** the ongoing quiz is not terminated abruptly for all participants.
* **Acceptance Criteria**:
  * **Given** a live quiz is currently in progress,
  * **When** the instructor refreshes the browser page or navigates away and returns to the dashboard,
  * **Then** an "Active Game Found" modal prompts the host to resume, restoring the exact current question index and player scores [code or files] [Designed].

### US-7: Student Auto-Reconnect on Mobile Screen Lock
* **As a** student whose phone screen automatically goes to sleep,
* **I want my** session restored when I wake my device,
* **So that** I do not get kicked out of the quiz.
* **Acceptance Criteria**:
  * **Given** a student is actively participating in a quiz,
  * **When** their phone locks or the mobile browser reloads,
  * **Then** client local storage restores player credentials, reconnects the WebSocket channel, and displays the current live question state [code or files] [Designed].

### US-8: Anonymous Post-Quiz Micro-Survey
* **As a** program lead,
* **I want to** collect anonymous post-session feedback from mentors and students,
* **So that** we can monitor instructional utility and network friction without identifying participants.
* **Acceptance Criteria**:
  * **Given** a quiz session finishes and reaches the final podium,
  * **When** the mentor leaves delivery mode or the student views their final score,
  * **Then** a 3-question mentor survey or 2-question student survey modal appears with a "Not now" button (capped at 3 dismissals), recording submissions with zero user IDs, zero emails, and zero session IDs [conversation, code or files] [Designed].

---

## 4. Requirements Matrix

| ID | Feature / Requirement | Priority | Status | Source | Evidence Level |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **REQ-01** | PIN-based zero-login student join | P0 | **Live** | conversation, code | Designed |
| **REQ-02** | Instructor auth via domain-restricted email | P0 | **Live** | conversation, code | Designed |
| **REQ-03** | 4-option multiple choice question engine | P0 | **Live** | conversation, code | Designed |
| **REQ-04** | 30-second global countdown synchronized via server | P0 | **Live** | conversation, code | Designed |
| **REQ-05** | Realtime WebSocket state broadcasting | P0 | **Live** | conversation, code | Designed |
| **REQ-06** | Server-side scoring RPC with speed bonus decay | P0 | **Live** | code or files | Designed |
| **REQ-07** | Sanitized student question view (no correct keys in client) | P0 | **Live** | code or files | Designed |
| **REQ-08** | Final podium with 1st, 2nd, 3rd celebratory confetti | P0 | **Live** | conversation, code | Designed |
| **REQ-09** | Dual-tier failover (Primary self-hosted + Cloud backup) | P0 | **Live** | conversation, code | Measured |
| **REQ-10** | Student auto-reconnect on mobile refresh / lock | P1 | **Live** | conversation, code | Designed |
| **REQ-11** | Host active session recovery modal | P1 | **Live** | conversation, code | Designed |
| **REQ-12** | Open-ended text response question support | P1 | **Live** | conversation, code | Designed |
| **REQ-13** | Toggle to display question text on student phones | P1 | **Live** | conversation, code | Designed |
| **REQ-14** | Single Sign-On edge worker from LMS | P1 | **Live** | code or files | Designed |
| **REQ-15** | Dedicated parallel session accounts per center | P1 | **Live** | conversation, code | Designed |
| **REQ-16** | Anonymous post-session micro-surveys (v1) | P1 | **Live** | conversation, code | Designed |
| **REQ-17** | Pre-loaded 6-week university lab curriculum quizzes | P1 | **Live** | conversation, code | Designed |
| **REQ-18** | Automated monthly audit and feedback compilation | P2 | **Live** | conversation, code | Designed |
| **REQ-19** | Instructor video onboarding guide | P2 | **Planned** | conversation | Observed |
| **REQ-20** | Multi-center aggregate persistent counters | P2 | **Planned** | my account | Designed |

---

## 5. Risks and Open Questions

### Operational Risks
* **Host Hardware Reliability**: The primary self-hosted database runs on an on-premises desktop computer that lacks dedicated UPS backup power, creating downtime risks during facility power cuts [conversation, my account] [Observed].
* **Instructor Adoption Inertia**: Mentors under tight syllabus schedules may skip formative quizzes due to perceived lack of classroom delivery time [conversation, my account] [Observed].
* **Student Connectivity Gaps**: College classrooms located in basements or rural areas occasionally suffer from severe cellular network degradation [my account, conversation] [Observed].

### Open Questions
* What is the long-term protocol for cross-database synchronization between the local primary database and the cloud disaster-recovery instance? [code or files] [Not found]
* How will historical aggregate delivery metrics be permanently archived when operating under strict 24-hour transient data-wipe policies? [my account, code or files] [Not found]
