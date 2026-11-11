# 03. Product Risks Analysis

## Overview

Following modern product discovery frameworks, any digital product initiative faces four fundamental risks: **Value Risk**, **Usability Risk**, **Feasibility Risk**, and **Viability Risk**. This document evaluates each risk category within the context of HubQuiz's live operational deployment across regional higher education engineering labs [my account, conversation] [Observed].

---

## 1. Value Risk

> *Will customers buy it, or will users choose to use it?*

### Assessment
* In HubQuiz, the instructor / mentor is the core customer because mentors exercise sole discretion over whether to conduct a live quiz during their assigned classroom slot [my account] [Observed].
* **Observed Evidence of Value Friction**:
  * On November 6, 2026, project records document that mentors across regional cohorts were not utilizing the application consistently in active sessions [conversation] [Observed].
  * Several instructors cited compressed workshop timetables, noting that hands-on hardware builds or prototyping milestones left insufficient time to run live digital assessments [my account, conversation] [Observed].
  * Some instructors reported that classes run inside partner institutions where student arrival is unpunctual or institutional faculty assign low priority to informal knowledge checks [my account] [Observed].
  * When cohorts contained students without smartphones or with completely dead cellular connectivity, facilitators skipped the quiz entirely rather than running partial assessments [my account] [Observed].
* **Mitigation Strategy Underway**:
  * Developing a targeted video walkthrough guide demonstrating instructional benefits, time-efficiency, and instant classroom insights to convince hesitant instructors [conversation] [Designed].
  * Introducing pre-loaded 1-click university curriculum quizzes (VTU Innovation & Design Thinking lab sets) so instructors do not have to write questions manually before class [conversation, code or files] [Designed].

---

## 2. Usability Risk

> *Can users figure out how to use it?*

### Assessment
* Usability applies to two distinct interfaces: the host desktop projection dashboard and the student mobile participation screen [conversation, code or files] [Designed].
* **Observed Usability Breakdowns & Fixes**:
  * **Student Mobile Disconnection**: Early testing revealed that if a student's smartphone went to sleep or the browser reloaded, the WebSocket connection dropped and kicked the student out of the game [conversation] [Observed]. This was mitigated by persisting credentials in local storage and implementing automatic reconnection routines [conversation, code or files] [Designed].
  * **Host Accidental Refresh**: Facilitators refreshing their laptop screen were redirected directly to the dashboard, prematurely aborting live classroom games [conversation] [Observed]. This was fixed by building an active session recovery modal that detects running games upon dashboard reload [conversation, code or files] [Designed].
  * **Light Theme Readability**: Initial transitions from dark to light mode resulted in white font rendering over white cards, making text invisible under classroom projector lighting [conversation] [Observed]. This was resolved by implementing a high-contrast deep navy and gold palette [conversation, code or files] [Designed].
  * **Post-Question Feedback**: Participants initially saw only a static "Wait for host" placeholder. Usability was upgraded to display points earned, live rank standing, and encouraging feedback after each question [conversation, code or files] [Designed].

---

## 3. Feasibility Risk

> *Can our engineers build it within available technology, time, and infrastructure constraints?*

### Assessment
* Feasibility centered around engineering synchronous, sub-second Realtime WebSocket communication for multi-center cohorts while operating strictly within zero-budget infrastructure tiers [conversation, code or files] [Measured].
* **Observed Feasibility Challenges & Fixes**:
  * **Cloud Connection Limits**: The managed cloud database tier enforces a hard ceiling of 200 concurrent Realtime WebSocket connections across the entire project [conversation, code or files] [Measured]. Concurrently running workshops across multiple regional centers risked dropping incoming connections [conversation, code or files] [Measured].
  * **The Hybrid Self-Hosted Resolution**: The engineering team established a self-hosted backend stack running inside Docker on a local desktop computer at a primary regional hub, bridged to the public internet via a secure static edge tunnel [code or files] [Measured].
  * **Automatic Dual-Backend Failover**: To prevent single-point-of-failure lockouts when the local desktop lost power or restarted, the frontend client was engineered with an automatic 3-second healthcheck routine that redirects clients to cloud backup if the primary server is unreachable [code or files] [Measured].
  * **Single Sign-On Integration**: Facilitators needed frictionless access from their existing LMS dashboard without memorizing separate credentials. A serverless edge worker was deployed to securely inject authentication tokens based on hub parameters [code or files] [Designed].

---

## 4. Viability Risk

> *Does this solution work for our business, legal, privacy, and operational model?*

### Assessment
* The product must align with non-profit educational operating constraints, student data protection policies, and multi-campus organizational structures [my account, code or files] [Designed].
* **Operational & Legal Alignment**:
  * **Zero Commercial Licensing Cost**: Replaced third-party commercial tools (Kahoot, Mentimeter) whose licenses across 9 centers would cost 10,000 INR or more per center per year, fully eliminating external software subscription expenses [my account, code or files] [Observed].
  * **Student Privacy Compliance**: HubQuiz enforces a strict zero-PII architectural policy. No student email addresses, phone numbers, roll numbers, or persistent student accounts are ever captured or stored [conversation, code or files] [Designed].
  * **Micro-Survey Anonymity**: Post-session survey responses are stored in an unlinked table containing zero user IDs, zero student names, and zero session IDs, preventing any potential evaluation bias or punitive tracking of facilitators [conversation, code or files] [Designed].
  * **Parallel Session Conflict Resolution**: Multiple instructors sharing a single generic hub credential at an institutional campus experienced game collisions where one mentor's actions aborted another mentor's live game [conversation] [Observed]. This was resolved by provisioning isolated sub-accounts per parallel classroom track [conversation, code or files] [Designed].

---

## The Biggest Risk Named: Value Risk (Mentor Adoption & Instructional Habituation)

### Analytical Justification
While **Feasibility** required intricate engineering (self-hosted Docker, static tunneling, dual-tier automatic failover, server-side scoring), every technical barrier was successfully resolved and verified in code [code or files] [Measured]. 

Similarly, **Usability** and **Viability** have been thoroughly de-risked through zero-login PIN flows, mobile reconnection recovery, and zero student data collection [conversation, code or files] [Designed].

**Value Risk remains the single greatest threat to the product's ultimate success** [my account, conversation] [Observed]. If instructors view the assessment as an optional administrative chore rather than an essential formative teaching tool, or if they choose to skip the quiz due to crowded academic timetables and patchy cellular reception, the platform will sit idle regardless of its technical sophistication [my account, conversation] [Observed]. 

Overcoming this adoption inertia through instructional coaching, curriculum alignment, and measurable time-saving proof points is the primary operational hurdle moving forward [my account, conversation] [Observed].
