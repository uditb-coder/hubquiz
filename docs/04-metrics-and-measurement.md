# 04. Metrics and Measurement

## Overview

HubQuiz is designed to provide immediate formative assessment in the classroom without collecting student personal data or creating administrative reporting burdens [conversation, code or files] [Designed]. Because the application is in an initial deployment phase, measurement focuses on adoption velocity, operational stability, and formative feedback loops rather than claims of long-term academic learning gains [my account] [Designed].

---

## 1. North Star Metric

### **Weekly Active Sessions Acted Upon (WAS-A)**
* **Definition**: The total number of completed quiz sessions conducted per week where the instructor reviews the aggregate score breakdown and takes instructional action (e.g. revisiting a concept or adapting subsequent lesson delivery) [my account, conversation] [Designed].
* **Why this is the North Star**: A high volume of launched sessions creates zero value if instructors simply click through results without examining where students struggled. Pairing completion with instructional adaptation directly reflects whether the product solved the core problem of blind lecture delivery [my account, conversation] [Designed].
* **Current Status**: Adoption velocity is actively tracked; qualitative action taken is measured via the post-session mentor micro-survey question: *"Did the results change what you did next?"* [conversation, code or files] [Designed].

---

## 2. Input Metrics

These leading indicators drive the North Star metric:

* **Weekly Active Facilitators (WAF)**:
  * Number of unique instructor accounts that host at least one finished quiz session during the calendar week [code or files] [Designed].
* **Classroom Join Parity**:
  * The ratio of connected student devices in the game lobby relative to the total number of students physically present in the lab room (Target: >=85% cohort participation) [my account, conversation] [Designed].
* **Answer Submission Velocity**:
  * Percentage of joined students who lock in an answer before the 30-second global countdown expires (Target: >=90% of active players) [code or files] [Designed].
* **Micro-Survey Completion Rate**:
  * Proportion of finished sessions where the host mentor and participating students complete the anonymous post-quiz survey rather than selecting "Not now" (Target: >=60% response rate across eligible prompts) [conversation, code or files] [Designed].

---

## 3. Guardrail Metrics

These operational boundaries ensure growth does not compromise privacy, technical stability, or classroom pacing:

* **Zero Student PII Retention**:
  * **Threshold**: 0 bytes of student personally identifiable information (emails, telephone numbers, university registration numbers) stored in the database [conversation, code or files] [Designed].
* **Live Session Interruption Rate**:
  * **Threshold**: <1% of initiated classroom sessions terminated prematurely due to server drops, tunnel timeouts, or account collisions [conversation, code or files] [Designed].
* **Result Reveal Latency**:
  * **Threshold**: <2.0 seconds from the conclusion of a 30-second question round to the live aggregation and display of the option distribution chart on the host screen [code or files] [Designed].
* **Survey Prompt Friction**:
  * **Threshold**: Maximum of 3 postponements via the "Not now" action before prompt suppression to prevent survey fatigue or garbage click-through entries [conversation, code or files] [Designed].

---

## 4. Exact Technical Definitions

To prevent conflicting metrics interpretations, the platform establishes strict system definitions:

### What Counts as a "Session"?
* **Definition**: A distinct row created in the `game_sessions` table that satisfies three mandatory criteria:
  1. Status must transition from `lobby` to `active` (at least Question 1 launched) [code or files] [Designed].
  2. At least two player rows must be associated with the `session_id` in the `players` table [code or files] [Designed].
  3. Status must reach `finished` upon session conclusion (either by traversing all questions to the final leaderboard or clicking the manual "End Quiz" control) [code or files] [Designed].
* **Exclusions**: Sessions created in the lobby but canceled before Question 1 starts are logged as aborted drafts and do not count toward official session totals [code or files] [Designed].

### What Counts as a "Join"?
* **Definition**: A distinct row successfully committed to the `players` table containing a valid foreign key referencing an active `session_id`, a sanitized alphanumeric nickname string, and an initial score of zero [code or files] [Designed].
* **Exclusions**: A player who loads the join page (`/play`) but abandons the screen prior to submitting a matching 6-digit PIN is treated as a web pageview, not a game join [code or files] [Designed].

### What Counts as a "Unique Student"?
* **Definition**: Within a **single live session**, a unique student is identified by an isolated `player_id` assigned to that specific `session_id` [code or files] [Designed].
* **Important Privacy Constraint**: Across **multiple sessions or weeks**, "Unique Students" are **Not Trackable by Design** [conversation, code or files] [Designed]. Because HubQuiz deliberately avoids capturing student logins, email addresses, device fingerprints, or permanent cookies, the system cannot programmatically link a student who joined on Tuesday with a student who joined on Thursday [conversation, code or files] [Designed]. Multi-week counts represent *student-participation events*, not unique individual humans [code or files] [Designed].

---

## 5. Plan for Anonymous Aggregate Counters (Surviving the 24-Hour Transient Wipe)

### Operational Context
Under free-tier cloud operating models, transient database tables (`players`, `answers`, `game_sessions`) were historically cleared on an operational schedule (or retained only for immediate 24-hour host review) to prevent exhausting row-storage and connection quotas [conversation, my account] [Observed]. Consequently, historical cumulative session totals were lost [my account] [Observed].

### Proposed Persistent Aggregate Counter Architecture
To preserve cumulative institutional metrics without collecting student data:

```
[Live Session Concludes]
          │
          ▼
┌────────────────────────────────────────────────────────┐
│ PostgreSQL Server Trigger / Stored Procedure           │
│ Function: archive_session_aggregate(p_session_id)      │
└────────────────────────────────────────────────────────┘
          │
          ├─► Extracts: session_date, hub_id, total_players,
          │             total_questions, avg_accuracy_pct
          │
          ├─► Strictly Excludes: player names, individual 
          │                      chosen options, IP addresses
          │
          ▼
┌────────────────────────────────────────────────────────┐
│ Persistent Table: daily_hubquiz_metrics                │
│ Columns:                                               │
│  - metric_date (DATE)                                  │
│  - hub_code (TEXT)                                     │
│  - completed_sessions_count (INT)                      │
│  - total_player_participations (INT)                   │
│  - total_answers_logged (INT)                          │
│  - overall_accuracy_rate (NUMERIC)                     │
└────────────────────────────────────────────────────────┘
          │
          ▼
┌────────────────────────────────────────────────────────┐
│ Nightly Cleanup Routine (24-Hour Window)               │
│ Purges raw tables: players, answers, game_sessions     │
│ Persistent aggregate table remains untouched!          │
└────────────────────────────────────────────────────────┘
```

### Architectural Guarantees of the Plan:
1. **Total Student Anonymity**: The permanent aggregate table contains zero rows representing individual students [code or files] [Designed].
2. **Quota Efficiency**: Compresses hundreds of transient daily row records into a single summary row per hub per day, keeping storage footprints negligible on free-tier infrastructure [code or files] [Designed].
3. **Audit Resilience**: Allows management update reports and central operations dashboards to track multi-month programmatic delivery trends without risking student privacy or server bloat [code or files] [Designed].
