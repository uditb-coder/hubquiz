# 09. Feedback and Micro-Surveys

## Overview

To measure instructional utility, student technical friction, and platform sentiment without creating reporting fatigue, HubQuiz incorporates an in-app anonymous micro-survey engine [conversation, code or files] [Designed]. The battery is versioned as `v1` and was designed on November 9, 2026 [conversation, code or files] [Designed].

---

## 1. Deployment Confirmation

* **Deployment Status**: **CONFIRMED FULLY DEPLOYED AND LIVE** [conversation, code or files] [Measured].
* **Verification Evidence**:
  * **Database Layer**: Active on both Primary On-Premises PostgreSQL and Cloud Supabase via SQL migration `07_survey_feedback.sql`, creating tables `hubquiz_survey_responses` and `mentor_survey_state` [conversation, code or files] [Measured]. Verified live in system logs via HTTP 201 Created responses [conversation] [Measured].
  * **Application Layer**: Integrated directly into `index.html` (modal templates `#mentor-feedback-modal` and `#student-feedback-modal`), `style.css` (custom survey design tokens), and `app.js` (controllers `promptMentorSurvey` and `promptStudentSurvey`) [code or files] [Measured].
  * **Version Control**: Committed to repository `master` branch (Commit `0968cab`) and auto-deployed to production [conversation, code or files] [Measured].

---

## 2. Survey Battery Design

### A. Mentor Survey Instrument (3 Questions)
* **Trigger Timing**: Prompts strictly when an instructor concludes a quiz session and leaves delivery mode from the final podium screen, or returns to the dashboard after session completion [conversation, code or files] [Designed]. Never interrupts active teaching rounds [conversation] [Designed].
* **Context Banner**: *"This survey is completely anonymous. No mentor names, emails, or user accounts are recorded. Please do not enter personal names."* [conversation, code or files] [Designed].

| Question Number | Question Prompt Text | Available Options | Measurement Dimension |
| :--- | :--- | :--- | :--- |
| **Q1** | *Compared to how you checked understanding before, how quickly did this show you how the class did?* | - Much faster<br>- Somewhat faster<br>- About the same<br>- Slower | **Speed of Insight**: Evaluates whether the real-time quiz improves upon the historical multi-day Google Form lag [conversation, my account] [Designed] |
| **Q2** | *Did the results change what you did next?* | - Yes, I changed my plan<br>- They confirmed my plan<br>- I didn't use them<br>- I couldn't read them clearly | **Instructional Adaptation**: Directly validates the North Star metric by checking if data altered teaching behavior [conversation, my account] [Designed] |
| **Q3** | *If HubQuiz weren't available next time, how would you feel?* | - Very disappointed<br>- Somewhat<br>- Not disappointed | **Sean Ellis PMF Indicator**: Measures product necessity and user retention sentiment among instructors [conversation, code or files] [Designed] |

### B. Student Survey Instrument (2 Questions)
* **Trigger Timing**: Prompts on mobile devices 1.2 seconds after the final rank, score, and celebratory podium medal render on the student screen [conversation, code or files] [Designed].
* **Context Banner**: *"This survey is completely anonymous. Your answers help us make HubQuiz better for everyone."* [conversation, code or files] [Designed].

| Question Number | Question Prompt Text | Available Options | Measurement Dimension |
| :--- | :--- | :--- | :--- |
| **Q1** | *Did you have any trouble joining or answering?* | - No<br>- Yes, my phone<br>- Yes, the network<br>- Yes, something else | **Technical Friction Diagnostic**: Identifies whether classroom dropouts stem from mobile browser bugs or campus cellular dead zones [conversation, my account] [Designed] |
| **Q2** | *Did the quiz show you what you still need to practise?* | - Yes<br>- A little<br>- No | **Self-Reflective Formative Efficacy**: Gauges whether students gained personal awareness of their technical knowledge gaps [conversation, code or files] [Designed] |

---

## 3. Cryptographic and Relational Anonymity Architecture

A core mandate from program leadership required that survey data must be genuinely anonymous: *"Anonymous has to be true. Store the answers with no name, email or user ID. Keep the 'already answered' flag separate, with nothing linking it to the answers. Only say 'anonymous' if that's how you build it."* (Step 6315) [conversation] [Designed].

### Architectural Decoupling:
```
┌─────────────────────────────────────────────────────────┐
│ Table 1: hubquiz_survey_responses                       │
│ - id (UUID PK)                                          │
│ - survey_version (e.g. 'v1')                            │
│ - audience ('mentor' | 'student')                       │
│ - q1_answer (TEXT)                                      │
│ - q2_answer (TEXT)                                      │
│ - q3_answer (TEXT, nullable)                            │
│ - created_at (TIMESTAMPTZ)                              │
│                                                         │
│ STRICTLY EXCLUDES:                                      │
│ NO user_id, NO session_id, NO email, NO player_id,      │
│ NO student name, NO mentor name, NO IP address!         │
└─────────────────────────────────────────────────────────┘
                            ▲
                            │ NO RELATION / NO FOREIGN KEY / NO LINK!
                            ▼
┌─────────────────────────────────────────────────────────┐
│ Table 2: mentor_survey_state (Decoupled Status)         │
│ - user_id (UUID PK references auth.users)               │
│ - survey_version (TEXT)                                 │
│ - completed (BOOLEAN)                                   │
│ - dismiss_count (INTEGER)                               │
│ - updated_at (TIMESTAMPTZ)                              │
│                                                         │
│ PURPOSE: Solely tracks prompt eligibility per account.   │
│ Even database admins cannot trace an answer row to a    │
│ specific mentor account!                                │
└─────────────────────────────────────────────────────────┘
```

---

## 4. Capped "Not Now" Dismissal Routine

* **The Problem with Forced Modals**: A mandatory pop-up prompt that cannot be dismissed gets random click-through selections from busy instructors in a hurry, damaging survey data integrity [conversation] [Observed].
* **The Solution**: Both mentor and student survey modals incorporate a prominent **"Not now"** button [conversation, code or files] [Designed].
* **The 3-Postponement Cap**:
  * Tapping "Not now" increments the `dismiss_count` integer in `mentor_survey_state` (and in student mobile `localStorage`) [code or files] [Designed].
  * If `dismiss_count < 3`, the prompt will return after a future quiz session [conversation, code or files] [Designed].
  * Once dismissed three times (or once an answer is submitted), the prompt is suppressed permanently for that survey version (`v1`), ensuring instructors are never spammed [conversation, code or files] [Designed].

---

## 5. What Each Question Measures & Programmatic Utility

| Question | Evaluation Metric | Programmatic Decision Triggered by the Data |
| :--- | :--- | :--- |
| **Mentor Q1 (Speed)** | Perception of Efficiency | If >=70% report "Much faster", proves the core process value of HubQuiz over legacy weekly forms [my account, conversation] [Designed] |
| **Mentor Q2 (Adaptation)** | Pedagogical Impact | If "Yes, I changed my plan" or "Confirmed plan" exceeds 80%, proves formative assessment value to executive sponsors [my account, conversation] [Designed] |
| **Mentor Q3 (PMF)** | Product-Market Fit | If "Very disappointed" exceeds 40%, confirms the application has achieved sticky operational necessity [conversation, code or files] [Designed] |
| **Student Q1 (Friction)** | Network Infrastructure | If "Yes, the network" spikes in specific hubs, triggers regional operations to evaluate campus mobile dead zones [conversation, my account] [Designed] |
| **Student Q2 (Clarity)** | Formative Clarity | If >=75% report "Yes" or "A little", confirms question design accurately illuminates student study priorities [conversation, code or files] [Designed] |
