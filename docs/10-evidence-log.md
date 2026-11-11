# 10. Quantitative Evidence Log

## Overview

This document compiles every numerical metric, technical threshold, and usage figure cited in the project history, conversation logs, source code, and executive briefing records [my account, conversation, code or files] [Observed]. Sources are preserved independently and analyzed for discrepancies without artificial reconciliation [my account] [Observed].

---

## 1. Master Evidence Log

| Metric Description | Quoted Value | Source | Date Recorded | Evidence Level | Reconciliation & Source Notes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Cloud Free-Tier Connection Limit** | 200 concurrent devices | code or files, conversation | Aug 20, 2026 | **Measured** | Hard limit enforced by Supabase Realtime free tier; triggered dual-tier self-hosted architecture [code or files] |
| **Global Question Timer Duration** | 30 seconds | conversation, code or files | Aug 17, 2026 | **Designed** | Fixed global countdown configured across all standard questions; not configurable per question [code or files] |
| **Session PIN Length** | 6 digits | conversation, code or files | Aug 17, 2026 | **Designed** | Random numeric PIN generated per live session in `game_sessions` table [code or files] |
| **Speed Bonus Maximum Points** | 1000 points | code or files | Aug 17, 2026 | **Designed** | Awarded for instantaneous correct answers, decaying linearly to 500 points at 30 seconds [code or files] |
| **Speed Bonus Minimum Floor** | 500 points | code or files | Aug 17, 2026 | **Designed** | Base score for any correct answer submitted before the 30-second timer reaches zero [code or files] |
| **Regional Innovation Hubs** | 9 centers | conversation, code or files | Sep 10, 2026 | **Measured** | Nine regional training hub accounts provisioned across Karnataka state [conversation, code or files] |
| **VTU Curriculum Quizzes** | 6 weekly modules | conversation, code or files | Aug 18, 2026 | **Measured** | 6 pre-loaded template quizzes mapped to university Design Thinking syllabus units [conversation, code or files] |
| **RNSIT Pre-Assessment Questions** | 14 questions | conversation, code or files | Nov 02, 2026 | **Measured** | Curated questions extracted from institutional curriculum spreadsheet [code or files] |
| **Parallel Accounts (RNSIT)** | 7 sub-accounts | conversation, code or files | Nov 09, 2026 | **Measured** | Created to resolve parallel session collisions across simultaneous sections [conversation, code or files] |
| **Survey Postponement Cap** | 3 dismissals | conversation, code or files | Nov 09, 2026 | **Designed** | Maximum times an instructor or student can click "Not now" before prompt suppression [code or files] |
| **Primary Server Health Timeout** | 3 to 5 seconds | code or files | Sep 21, 2026 | **Measured** | Client-side timeout before automatically falling back to cloud disaster-recovery instance [code or files] |
| **Commercial License Cost Estimate** | >= 10,000 INR / center / yr | my account | Nov 11, 2026 | **Observed** | Self-reported estimate of third-party commercial quiz software license costs across 9 hubs [my account] |
| **Standard Class Cohort Size** | 40 to 60 students | conversation, code or files | Aug 18, 2026 | **Observed** | University syllabus guideline for faculty-to-student batch ratios in lab divisions [conversation] |
| **Cumulative Unique Visitors** | 849 visitors | conversation, code or files | Nov 02, 2026 | **Measured** | Logged via Vercel Web Analytics dashboard screenshot [conversation, code or files] |
| **Cumulative Page Views** | 4,327 page views | conversation, code or files | Nov 02, 2026 | **Measured** | Logged via Vercel Web Analytics dashboard screenshot [conversation, code or files] |
| **Web Analytics Bounce Rate** | 19% (+19% change) | conversation, code or files | Nov 02, 2026 | **Measured** | Logged via Vercel Web Analytics dashboard screenshot [conversation, code or files] |
| **Reported Answer Events** | 4,323 answers | my account | Nov 11, 2026 | **Measured** | Quoted in project review; near-identical to pageviews (4,327), likely tracking artifact [my account] |
| **Dashboard Active Sessions** | 22 live sessions | my account | Nov 11, 2026 | **Measured** | Extracted from administrative dashboard snapshot at a specific operational evaluation point [my account] |
| **Dashboard Total Player Joins** | 693 student joins | my account, code or files | Nov 07, 2026 | **Measured** | Cumulative join records logged across database session histories [my account, code or files] |
| **System Answer Accuracy Rate** | 68.6% correct | my account | Nov 11, 2026 | **Measured** | Proportion of student answers matching correct key; measures answer accuracy, not learning gain [my account] |
| **Isolated Hub Deployment Volume** | 2 sessions, 2 joins | my account | Nov 11, 2026 | **Measured** | Single hub record illustrating uneven initial adoption and test runs [my account] |
| **Management Report Total Sessions** | 31 live sessions | code or files | Nov 07, 2026 | **Measured** | Formally reported in statewide executive operations update report [code or files] |
| **Weekly Delivery Performance** | 3 sessions, 71 players | conversation, code or files | Nov 06, 2026 | **Measured** | Weekly delivery summary recorded between Nov 01 and Nov 06, 2026 [conversation, code or files] |
| **Self-Reported 30-Day Estimate** | ~60 sessions, 40-50/class | my account | Nov 11, 2026 | **Observed** | Estimate from coaching session recollection; does not reconcile with database records [my account] |

---

## 2. Analysis of Conflicting Metrics and Sources

### Discrepancy A: Session Totals (22 vs. 31 vs. ~60 Sessions)
* **The Conflict**:
  * Dashboard report recorded **22 sessions** [my account] [Measured].
  * Statewide management update report recorded **31 sessions** as of November 07, 2026 [code or files] [Measured].
  * User self-reported recollection estimated **approximately 60 sessions** over 30 days [my account] [Observed].
* **Reconciliation Analysis**:
  * The 22 sessions figure represents an earlier query snapshot or a single server instance (e.g. Cloud only or JP Nagar only) before data reconciliation [my account] [Observed].
  * The 31 sessions figure represents verified database records aggregated across both servers up to November 07, 2026 [code or files] [Measured].
  * The 60 sessions figure represents an informal mental estimate of intended or observed training sessions across all hubs, which did not all result in committed digital HubQuiz records due to offline paper delivery or server downtime [my account] [Observed].

### Discrepancy B: Total Joins vs. Cohort Multiplication (693 vs. 1,200 - 3,000 Joins)
* **The Conflict**:
  * System database records consistently report **693 total player joins** [my account, code or files] [Measured].
  * Multiplying 31 sessions (or 60 sessions) by typical class sizes (40 to 50 students) would mathematically yield between 1,240 and 3,000 player participations [my account] [Observed].
* **Reconciliation Analysis**:
  * Early deployment sessions included small pilot test runs (e.g. one hub recorded exactly 2 sessions with 2 joins total) [my account] [Measured].
  * In several college classrooms, cellular dead zones or lack of smartphones prevented the entire room from joining simultaneously, resulting in partial cohort participation [my account] [Observed].
  * Transient database wipe routines conducted during free-tier testing may have purged unarchived join records before cumulative reporting was initiated [my account, code or files] [Observed].

### Discrepancy C: Page Views vs. Answer Events (4,327 vs. 4,323)
* **The Conflict**:
  * Vercel Web Analytics recorded **4,327 total page views** [conversation, code or files] [Measured].
  * A metric of **4,323 answer events** was cited in coaching review [my account] [Measured].
* **Reconciliation Analysis**:
  * In a single-page application (SPA), route changes and question interactions may have triggered custom telemetry events that mapped closely to pageview transitions [code or files] [Observed].
  * The near-identical match (4,327 vs 4,323) is an analytical artifact of event tracking rather than an exact 1:1 parity between visits and answer clicks [my account, code or files] [Observed].
