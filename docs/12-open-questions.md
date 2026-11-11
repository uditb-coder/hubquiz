# 12. Open Questions and Unresolved Gaps

## Overview

This document itemizes every critical operational gap, missing baseline metric, and unaddressed technical dependency identified across the HubQuiz project lifecycle [my account, conversation, code or files] [Observed]. Each open item is mapped to the organizational stakeholder or functional role capable of resolving it [code or files] [Designed].

---

## 1. Problem & Baseline Gaps

| Question / Missing Information | Context & Why It Is Missing | Who Could Answer It | Priority |
| :--- | :--- | :--- | :--- |
| **Q1: What was the exact pre-HubQuiz time baseline for assessment cycles?** | No pre-intervention clock measurements were recorded. The shift from days to minutes is an observed workflow change, not a stopwatch audit [my account] [Not found]. | Central Operations Lead / Monitoring & Evaluation Team | High |
| **Q2: What were historical student error rates on legacy Google Forms?** | Historical form response sheets were not analyzed for error distributions prior to launching HubQuiz [my account] [Not found]. | Curriculum Academic Director | Medium |
| **Q3: What were the actual historical dollar expenditures on commercial tools?** | Licensing costs for commercial platforms (Kahoot / Mentimeter) were estimated at >=10k INR per center, but formal procurement receipts were not logged [my account] [Observed]. | Finance & Procurement Manager | Medium |

---

## 2. Success Measurement & Telemetry Gaps

| Question / Missing Information | Context & Why It Is Missing | Who Could Answer It | Priority |
| :--- | :--- | :--- | :--- |
| **Q4: How do quiz accuracy scores correlate with final university exam marks (SEE/CIE)?** | HubQuiz has operated strictly as a formative classroom check. No statistical correlation studies have compared quiz performance to semester examination results [my account, code or files] [Not found]. | Academic Research Lead / University Faculty Deans | High |
| **Q5: Why do telemetry pageviews (4,327) and answer counts (4,323) mirror each other so closely?** | In single-page web applications, custom telemetry event listeners often record pageview hooks during question state transitions, creating tracking artifacts [my account, code or files] [Observed]. | Data & Analytics Engineer | Medium |
| **Q6: How will cumulative historical delivery data be permanently retained?** | Free-tier operational data-wipe routines cleared transient session rows to preserve connection quotas, resulting in unrecorded historical sessions [my account, code or files] [Observed]. | Database Administrator / Backend Engineer | High |

---

## 3. Infrastructure & Operational Gaps

| Question / Missing Information | Context & Why It Is Missing | Who Could Answer It | Priority |
| :--- | :--- | :--- | :--- |
| **Q7: Who is the designated backup maintainer for the on-premises primary server?** | The primary desktop server runs in JP Nagar under the care of a single primary maintainer. If that person is traveling or ill during a crash, recovery relies on cloud fallback [my account, conversation] [Observed]. | System Owner / Program Leadership | High |
| **Q8: When will a dedicated UPS power backup be installed on the host desktop?** | Power cuts at the host center cause immediate server dropouts. Vendor sizing specifications have been evaluated, but physical procurement remains unconfirmed [conversation, my account] [Observed]. | Regional Center Facilities Manager | High |
| **Q9: What is the long-term automated cross-database sync strategy?** | Quizzes and mentor accounts must currently be provisioned onto both the local database and the cloud instance via duplicate script runs, risking schema drift [code or files] [Observed]. | Lead Software Engineer | Medium |

---

## 4. Instructional & Adoption Gaps

| Question / Missing Information | Context & Why It Is Missing | Who Could Answer It | Priority |
| :--- | :--- | :--- | :--- |
| **Q10: Why do mentors in specific regional hubs fail to run quizzes consistently?** | Adoption is uneven across centers (e.g. one hub logged only two sessions total). Is it caused by cellular dead zones, lack of class time, or facilitator disinterest? [my account, conversation] [Observed]. | Regional Program Manager / Mentor Enablement Lead | High |
| **Q11: When will the planned video onboarding guide be recorded and distributed?** | The video walkthrough prompt was designed on November 6, 2026, but completed multimedia assets have not yet been distributed to regional mentors [conversation] [Observed]. | Instructional Media Producer / Support Lead | High |
| **Q12: How should instructors handle classrooms where multiple students lack smartphones?** | While most students possess smartphones, isolated rural classrooms have students without devices or data plans, causing mentors to abandon the quiz [my account] [Observed]. | Academic Pedagogy Lead | Medium |

---

## 5. Summary Action Matrix for Product Governance

```
┌────────────────────────────────────────────────────────┐
│ Immediate Governance Actions (Next 30 Days)            │
├────────────────────────────────────────────────────────┤
│ 1. Procure and install dedicated UPS on host desktop   │
│ 2. Name and train a secondary backup system owner      │
│ 3. Distribute mentor onboarding explainer video        │
│ 4. Deploy permanent daily aggregate counter table      │
│ 5. Review first month-end micro-survey results (v1)    │
└────────────────────────────────────────────────────────┘
```
