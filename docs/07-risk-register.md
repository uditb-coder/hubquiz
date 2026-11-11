# 07. Risk Register (RAID Log)

## Overview

This RAID (Risks, Assumptions, Issues, Dependencies) register documents operational, technical, and organizational factors governing HubQuiz across its regional deployment environments [my account, conversation, code or files] [Observed].

---

## 1. Risks (Potential Threats to Project Success)

| ID | Category | Risk Description | Owner | Impact | Likelihood | Mitigation Strategy | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **RSK-01** | Value / Adoption | Instructors perceive tight curriculum pacing and skip live quizzes to prioritize hardware builds [conversation, my account] [Observed] | Product Manager / Support Lead | High | High | Deliver pre-loaded 1-click university curriculum quizzes; provide concise video onboarding demonstrating time savings [conversation, code or files] [Designed] | **Open / Active** |
| **RSK-02** | Infrastructure | Primary on-premises desktop server loses power due to local electrical outage, causing downtime [conversation, my account] [Observed] | System Owner | High | High | Automated client health check fails over to cloud backup within 3 to 5 seconds; evaluate hardware UPS procurement [conversation, code or files] [Measured] | **Mitigated / Monitoring** |
| **RSK-03** | Concurrency | Regional simultaneous workshops exceed the 200-connection limit on Cloud disaster backup tier [conversation, code or files] [Measured] | Technical Product Manager | High | Medium | Primary on-premises server handles unlimited connections; visual UI badge warns instructors when operating on cloud fallback [conversation, code or files] [Designed] | **Mitigated** |
| **RSK-04** | Usability / Network | College classrooms in basements suffer cellular degradation, preventing students from joining [my account, conversation] [Observed] | Technical Program Manager | High | Medium | Lightweight vanilla JS bundle (<250 KB); toggle to display question text directly on phones when projector is distant [conversation, code or files] [Designed] | **Open / Active** |
| **RSK-05** | Single Point of Failure | System Owner is unavailable during an on-premises server or network tunnel crash [my account] [Observed] | System Owner / Program Leadership | High | Medium | Automated Windows startup scripts restore tunnels silently on machine reboot; secondary cloud fallback runs independently [conversation, code or files] [Designed] | **Open / Action Required** |

---

## 2. Assumptions (Underlying Operating Hypotheses)

| ID | Category | Assumption Description | Owner | Validation Status | Evidence Level |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **ASM-01** | Student Hardware | At least 90% of students attending engineering lab workshops have access to a personal web-enabled smartphone [my account, conversation] | Product Operations | **Partially Validated**: Most students possess smartphones, but isolated cohorts contain students without devices [my account] | Observed |
| **ASM-02** | Network Environment | College lab venues provide sufficient commercial cellular data coverage (3G/4G/5G) to support WebSocket text traffic [my account, conversation] | Technical Program Manager | **Partially Validated**: Generally functional, but dead zones occur in basement laboratories [my account] | Observed |
| **ASM-03** | Free Tier Viability | Free hosting tiers (Vercel CDN, Cloud Supabase free tier, Ngrok static free tier) will maintain current pricing and quota structures [code or files] | Technical Product Manager | **Valid**: Operates successfully within existing project tier boundaries [code or files] | Measured |
| **ASM-04** | Formative Utility | Immediate classroom aggregate visibility enables instructors to explain concepts better than delayed weekly forms [my account] | Product Manager | **Hypothesis Under Test**: Initial deployment stage; monitored via post-quiz anonymous micro-survey battery [my account, conversation] | Designed |

---

## 3. Issues (Current Active Operational Problems)

| ID | Category | Issue Description | Owner | Severity | Resolution / Action Plan | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **ISS-01** | Operations | Multiple instructors sharing one generic hub login at a multi-batch college aborted each other's live quizzes [conversation] [Observed] | Technical Program Manager | High | Provisioned seven dedicated section sub-accounts per center with isolated session namespaces [conversation, code or files] [Designed] | **Resolved** |
| **ISS-02** | Usability | Students were disconnected from quizzes when their smartphones entered sleep mode or reloaded [conversation] [Observed] | Software Engineer | High | Implemented client-side local storage caching and automatic WebSocket reconnection handlers [conversation, code or files] [Designed] | **Resolved** |
| **ISS-03** | Usability | Accidental laptop browser refresh by host redirected instructor to dashboard, losing active quiz [conversation] [Observed] | Software Engineer | Medium | Built an active session recovery modal that detects running games upon host dashboard reload [conversation, code or files] [Designed] | **Resolved** |
| **ISS-04** | Telemetry | Cumulative historical delivery session counts were unrecorded due to transient database wipe policies [my account, code or files] [Observed] | Data & Analytics Lead | Medium | Designed permanent aggregate counter table that stores session metrics without saving student PII [code or files] [Designed] | **Planned / Under Build** |
| **ISS-05** | Infrastructure | On-premises desktop server machine in JP Nagar lacks standalone UPS power backup [conversation, my account] [Observed] | System Owner | High | Sizing vendor load specifications to procure an appropriate uninterruptible power supply [conversation] [Observed] | **In Progress** |

---

## 4. Dependencies (External Technical and Organizational Links)

| ID | Dependency Description | Dependent Component | Impact if Failed | Risk Management Plan |
| :--- | :--- | :--- | :--- | :--- |
| **DEP-01** | Static Edge CDN Hosting (Vercel) | Frontend Delivery (`hubquiz.vercel.app`) | Complete inability for mentors and students to access interface [code or files] | Frontend is pure static HTML/CSS/JS and can be mirrored to GitHub Pages or Netlify within minutes [code or files] |
| **DEP-02** | Edge Tunnel Provider (Ngrok Static Domain) | Primary On-Premises Server Connectivity | Loss of primary server; triggers automatic client failover to cloud backup [code or files] | Cloudflare Tunneling evaluated as alternative; automatic cloud fallback protects uptime [code or files] |
| **DEP-03** | Serverless Edge Worker (Cloudflare Workers) | LMS Single Sign-On Access | Mentors cannot access via 1-click LMS buttons [code or files] | Direct credential email/password login is maintained as an independent fallback [code or files] |
| **DEP-04** | Institutional Portal Alignment | Regional Training Curriculum Schedule | Assessments misaligned with student syllabus [code or files] | Standardized VTU Design Thinking quizzes mapped directly to weekly academic syllabus units [conversation, code or files] |
| **DEP-05** | Regional Lead Buy-In | Classroom Delivery Adoption | Facilitators bypass platform, reducing active volume [my account] | Monthly executive reporting highlights active hub usage to regional management [conversation, code or files] |
