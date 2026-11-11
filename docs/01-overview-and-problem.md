# 01. Overview and Problem

## Executive Summary

HubQuiz is a lightweight, real-time classroom assessment application built to provide synchronous formative feedback during technical training workshops [conversation, code or files] [Designed]. Inspired by the core mechanics of Kahoot, the platform enables an instructor to host a live quiz session displayed on a central classroom screen (projector or television) while students participate simultaneously from their own mobile phones using a six-digit session PIN and a self-selected display name [conversation, code or files] [Designed]. The system requires no student account creation, password management, or native application downloads [conversation, code or files] [Designed]. It is currently in initial deployment across multiple regional innovation training centres and associated engineering college cohorts [my account, conversation] [Observed].

---

## The Problem

### 1. Who Has the Problem?
* **Primary Stakeholders (Instructors / Mentors)**: Technical facilitators responsible for delivering hands-on prototyping and design thinking modules across regional innovation hubs and college campus classrooms [my account, conversation] [Observed].
* **Secondary Stakeholders (Students)**: Undergraduate engineering students attending fast-paced, multi-week project training sessions where retention of foundational engineering principles is essential for subsequent laboratory build phases [conversation, code or files] [Observed].
* **Institutional Context**: Classrooms typically seat cohorts of 40 to 60 students per division, with group activities subdivided into teams of 4 to 6 participants [conversation, code or files] [Observed].

### 2. What Happens Today (Pre-Intervention Workflow)?
* Before the deployment of HubQuiz, end-of-session knowledge checks were conducted primarily using centralized Google Forms administered by an external central operations team [my account] [Observed].
* Individual instructors did not have immediate administrative access to view incoming form submissions or completion tallies during or immediately following their class [my account] [Observed].
* Assessment responses were compiled asynchronously, with aggregated spreadsheets and completion reports typically returned to instructors days later, often toward the end of the instructional week [my account] [Observed].
* Form submission windows were open-ended without enforced countdown timers, allowing students to browse external search engines or generative AI assistants to retrieve answers rather than recalling concepts covered during lecture delivery [my account] [Observed].

### 3. Why It Hurts?
* **Blind Instructional Delivery**: Facilitators completed instructional units with zero real-time confirmation regarding whether the core concepts had been absorbed by the cohort [my account] [Observed].
* **Lost Formative Window**: Because response summaries arrived days after the session, the pedagogical moment to address widespread misconceptions, clarify foundational errors, or revisit difficult topics in class had already passed [my account] [Observed].
* **Evaluation Skew**: Unmonitored, untimed form completion allowed external search lookups, masking genuine comprehension gaps and producing artificially inflated score distributions that did not reflect actual classroom understanding [my account] [Observed].
* **Low Student Responsiveness**: Static asynchronous questionnaires felt like administrative homework rather than an engaging classroom reflection, causing variable submission rates across student cohorts [my account] [Observed].

### 4. How We Would Know It Is Solved (Outcome-Driven, Solution-Free Criteria)?
To define true operational success without referencing specific software mechanics:
* 100% of instructors can review accurate, aggregate student comprehension data before dismissing the cohort from the room [my account, conversation] [Designed].
* Facilitators detect specific topic misunderstandings immediately and adjust subsequent discussion or review before concluding the class session [my account, conversation] [Designed].
* Classroom feedback latency drops from days to seconds, allowing immediate closure of conceptual feedback loops [my account] [Designed].
* Cohort comprehension indicators reflect individual student recall rather than external search lookups or asynchronous collaboration [my account] [Designed].

### 5. Baseline Measurement Context
* Quantitative baseline metrics (such as exact minutes previously spent compiling forms or historical student error rates) were not formally measured prior to HubQuiz deployment [my account] [Not found].
* The transition from multi-day reporting to immediate in-class visibility represents an observed process change rather than a formal pre-intervention clock measurement [my account] [Observed].

---

## Options Considered

### Option 1: Centralized Google Forms
* **Description**: Web-based survey forms distributed via static URLs or QR codes, managed through central administrative accounts [my account, code or files] [Observed].
* **Why Considered**: Already integrated into existing administrative routines for end-of-module attendance and feedback tracking [code or files] [Observed].
* **Why Rejected**:
  * Multi-day feedback delay prevented real-time instructional adaptation [my account] [Observed].
  * Absence of question timers allowed students to consult external websites during assessments [my account] [Observed].
  * Instructors could not view live submissions without administrative sheet permissions [my account] [Observed].

### Option 2: Commercial Game-Based Quiz Platforms (Kahoot)
* **Description**: Industry-standard commercial real-time gamified quiz application utilizing host projection and mobile player inputs [conversation, my account] [Observed].
* **Why Considered**: Highly engaging, interactive classroom mechanics proven to capture student attention and provide immediate visual podium feedback [conversation, my account] [Observed].
* **Why Rejected**:
  * Commercial licensing fees: Commercial pro tier licenses across nine regional training hubs were estimated at 10,000 INR or more per center per year, creating an unsustainable recurring software expenditure for a non-profit educational program [my account] [Observed].
  * Vendor lock-in and student account requirements for advanced reporting [my account] [Observed].

### Option 3: Commercial Audience Polling Systems (Mentimeter)
* **Description**: Interactive slide presentation and live audience polling tool [code or files] [Designed].
* **Why Considered**: Supported embedded live quiz questions directly inside lecture slide presentations [code or files] [Designed].
* **Why Rejected**:
  * High recurring subscription cost across multiple regional facilitator accounts [code or files] [Designed].
  * Identified in program documentation as an external paid tool targeted for replacement by an in-house asset [code or files] [Designed].

### Option 4: Standalone Cloud Backend Hosting (Single-Tier Supabase Cloud)
* **Description**: Hosting the full quiz application on free-tier cloud managed backend infrastructure [conversation, code or files] [Measured].
* **Why Considered**: Rapid deployment, built-in WebSocket realtime messaging, and zero upfront infrastructure cost [conversation, code or files] [Designed].
* **Why Rejected as Sole Architecture**:
  * The cloud free tier enforces a strict limit of 200 concurrent Realtime WebSocket connections across the entire project [conversation, code or files] [Measured].
  * When regional workshops ran concurrent cohorts, peak connected devices threatened to exceed this threshold, requiring the engineering of a self-hosted primary server with cloud automatic failover [conversation, code or files] [Measured].

### Option 5: Dedicated Classroom Local Wi-Fi Router Setup
* **Description**: Transporting portable physical Wi-Fi routers to college classrooms to create local offline local area networks [conversation] [Observed].
* **Why Considered**: Explored to eliminate dependence on varying mobile cellular network quality across rural or basement college labs [conversation] [Observed].
* **Why Rejected**:
  * Added hardware transport overhead, mentor configuration complexity, and setup friction before class delivery [conversation] [Observed].
  * Explicitly rejected by leadership in favor of standard mobile web access over cellular data: "forget wifi router only pc and sdisplay" (Step 5684) [conversation] [Observed].

---

## Summary of Decisions

| Evaluated Option | Selected? | Primary Reason for Decision |
| :--- | :--- | :--- |
| **Google Forms** | No | Asynchronous multi-day latency; no timers; prevented in-session instructional adaptation [my account] [Observed] |
| **Kahoot / Mentimeter** | No | Prohibitive commercial recurring licensing costs across 9 innovation centers [my account, code or files] [Observed] |
| **Cloud-Only Backend** | Modified (Kept as Failover) | 200-device connection limit on free tier led to dual-tier self-hosted architecture [conversation, code or files] [Measured] |
| **Classroom Local Router** | No | High hardware setup friction; dropped in favor of zero-friction mobile web access [conversation] [Observed] |
| **HubQuiz (In-House)** | **Yes** | Zero licensing cost, instant live results, server-side anti-cheat scoring, zero student friction [conversation, code or files] [Designed] |
