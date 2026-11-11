# 06. Product Roles and RACI Framework

## Overview

In an early-stage deployment within a non-profit educational framework, several distinct functional roles are often held by a small, cross-functional team [my account, conversation] [Observed]. This document delineates the twelve specialized roles required to develop, operate, and govern HubQuiz as an enterprise-grade instructional product [my account, code or files] [Designed].

---

## 1. Role Specifications

### 1. Product Manager (PM)
* **Ownership**: Defines the product vision, core problem definition, feature scope, release priorities, and adoption strategy [conversation, code or files] [Designed].
* **Decisions Made / Would Make**: Prioritized frictionless PIN-based join over student accounts; rejected custom timers; defined anonymous micro-survey questions; approved transition to dual-tier failover [conversation, code or files] [Designed].
* **Artifacts Produced**: Product Requirements Document (PRD), Feature Roadmaps, Survey Question Specifications, Release Briefings [code or files] [Designed].
* **Evaluation Criteria**: Weekly Active Sessions Acted Upon (North Star), Mentor Adoption Rate, Product Market Fit sentiment [my account] [Designed].
* **Open Items**: Resolving mentor time-pressure barriers; driving consistent multi-hub adoption [conversation, my account] [Observed].

### 2. Technical Product Manager (TPM)
* **Ownership**: Translates operational constraints (connection limits, networking tunnels, data retention) into technical specifications and architectural milestones [conversation, code or files] [Designed].
* **Decisions Made / Would Make**: Established 200-device limit safeguards on cloud tier; scoped Single Sign-On edge worker; specified server-side RPC scoring architecture [code or files] [Designed].
* **Artifacts Produced**: Technical Architecture Documentation, API Contracts, Failover Specifications, Data Schemas [code or files] [Designed].
* **Evaluation Criteria**: System uptime, API response latency, zero cross-server data corruption during failover [code or files] [Designed].
* **Open Items**: Designing automated cross-database synchronization between local and cloud tiers [code or files] [Not found].

### 3. Technical Program Manager (PgM)
* **Ownership**: Manages multi-center cross-team execution, partner institution schedules, deployment timelines, and delivery dependencies [conversation, code or files] [Designed].
* **Decisions Made / Would Make**: Coordinated account provisioning across 9 regional centers; resolved parallel session account collisions at multi-batch college deployments [conversation, code or files] [Designed].
* **Artifacts Produced**: Rollout Timelines, Center Readiness Checklists, Cross-Team Dependency Trackers [code or files] [Designed].
* **Evaluation Criteria**: On-time delivery of regional training batches, zero programmatic session cancellations due to platform unpreparedness [code or files] [Designed].
* **Open Items**: Enforcing consistent quiz delivery across partner colleges where timetable delays occur [my account] [Observed].

### 4. Product Operations (Product Ops)
* **Ownership**: Daily platform hygiene, mentor onboarding feedback intake, operational reporting, and runbook execution [code or files] [Designed].
* **Decisions Made / Would Make**: Administered multi-hub user credentials; verified weekly session delivery logs; scheduled automated monthly audit cron tasks [conversation, code or files] [Designed].
* **Artifacts Produced**: Weekly Operations Reports, Monthly Audit Digests, Mentor Setup Guides, Site Health Records [code or files] [Designed].
* **Evaluation Criteria**: Reporting accuracy, rapid ticket resolution for mentor access issues, operational audit compliance [code or files] [Designed].
* **Open Items**: Establishing formal tracking for centers that lack consistent cellular coverage [my account] [Observed].

### 5. Product Designer (UI/UX)
* **Ownership**: User experience architecture, visual hierarchy, mobile responsive layouts, audio-visual feedback, and projector readability [conversation, code or files] [Designed].
* **Decisions Made / Would Make**: Implemented high-contrast navy and gold palette for projector visibility; structured 2x2 colored shape blocks for mobile inputs; designed celebratory podium animations [conversation, code or files] [Designed].
* **Artifacts Produced**: Interface Mockups, Design Tokens (`style.css`), Audio Effect Manifests, Mobile Wireframes [code or files] [Designed].
* **Evaluation Criteria**: Join completion velocity, zero UI contrast complaints under poor lighting, intuitive zero-training mobile navigation [conversation, code or files] [Designed].
* **Open Items**: Optimizing mobile layout for ultra-low-end smartphones with non-standard aspect ratios [conversation] [Observed].

### 6. Software Engineer (Dev)
* **Ownership**: Full-stack application codebase, PostgreSQL database schema, Realtime WebSocket implementation, and edge worker routing [code or files] [Designed].
* **Decisions Made / Would Make**: Selected zero-framework vanilla JS for ultra-fast load; authored stored procedures for atomic scoring; built client local storage recovery routines [code or files] [Designed].
* **Artifacts Produced**: Application Code (`app.js`, `index.html`), Database Migrations (`.sql`), Edge Worker Scripts, Automation daemons [code or files] [Designed].
* **Evaluation Criteria**: Zero client-side JavaScript crashes, sub-50ms query execution times, clean code maintainability [code or files] [Designed].
* **Open Items**: Consolidating local and cloud database schema update automation [code or files] [Not found].

### 7. Quality Assurance Engineer / Tester (QA)
* **Ownership**: Pre-release functional verification, cross-browser compatibility, edge-case testing, and real-world network simulation [conversation, code or files] [Designed].
* **Decisions Made / Would Make**: Identified critical phone sleep disconnect bug; validated 2-choice question rendering; uncovered mentor session loss on browser reload [conversation] [Observed].
* **Artifacts Produced**: Test Plans, Issue Logs, Automated Headless Test Scripts, Regression Verification Suites [conversation, code or files] [Designed].
* **Evaluation Criteria**: Bug detection prior to live classroom delivery, zero undetected breaking regressions in production [code or files] [Designed].
* **Open Items**: Establishing automated network latency and packet-loss test benches simulating rural mobile networks [conversation, my account] [Observed].

### 8. Data and Analytics Lead
* **Ownership**: Telemetry tracking, data integrity, counter architecture, aggregate reporting schemas, and web performance analytics [conversation, code or files] [Designed].
* **Decisions Made / Would Make**: Configured Vercel Web Analytics; authored SQL aggregation queries for micro-survey reporting; designed persistent aggregate counter model [conversation, code or files] [Designed].
* **Artifacts Produced**: Telemetry Specs, Analytical SQL Queries, Weekly/Monthly Analytics Reports, Dashboard Views [code or files] [Designed].
* **Evaluation Criteria**: Telemetry reliability, accurate session reconciliation, zero unexplainable data anomalies [conversation, code or files] [Measured].
* **Open Items**: Reconciling discrepancies between web analytics pageviews, database join records, and self-reported mentor totals [conversation, my account] [Observed].

### 9. Security and Privacy Officer
* **Ownership**: Information security posture, data privacy compliance, Row Level Security (RLS) enforcement, and cryptographic anonymity [conversation, code or files] [Designed].
* **Decisions Made / Would Make**: Enforced zero student PII collection policy; designed decoupled survey state tracking; required server-side answer sanitization via SQL views [conversation, code or files] [Designed].
* **Artifacts Produced**: Privacy Impact Assessments, RLS Policy Definitions, Secrets Hygiene Checklists [code or files] [Designed].
* **Evaluation Criteria**: Zero student data leaks, 100% adherence to privacy regulations, zero unauthorized database access [code or files] [Designed].
* **Open Items**: Conducting routine penetration reviews on local desktop tunnel exposed endpoints [code or files] [Not found].

### 10. Support and Enablement Lead
* **Ownership**: Facilitator training, instructional onboarding documentation, classroom troubleshooting playbooks, and video explainer assets [conversation, code or files] [Designed].
* **Decisions Made / Would Make**: Created step-by-step mentor launch instructions; scripted video guide demonstrating classroom engagement benefits; established escalation channels for live issues [conversation, code or files] [Designed].
* **Artifacts Produced**: Mentor User Manuals, Video Explainer Storyboards, Quick-Start Pocket Cards, Troubleshooting FAQs [code or files] [Designed].
* **Evaluation Criteria**: Mentor onboarding time (<10 minutes to first quiz), reduction in live support requests, instructor confidence ratings [my account] [Designed].
* **Open Items**: Completing final video production and delivery to regional mentors [conversation] [Observed].

### 11. Program Leadership (Executive Stakeholder)
* **Ownership**: Strategic sponsorship, institutional partnerships, budget governance, and organizational continuation decisions [my account, code or files] [Designed].
* **Decisions Made / Would Make**: Approved transition away from paid commercial tools; sanctioned initial deployment across college partner programs; requested executive usage summaries [conversation, my account] [Observed].
* **Artifacts Produced**: Strategic Directives, Partnership Memorandums, Governance Reviews [code or files] [Designed].
* **Evaluation Criteria**: Cost savings relative to commercial licenses, widespread regional adoption, high qualitative facilitator satisfaction [my account, code or files] [Observed].
* **Open Items**: Establishing official institutional policy recognizing live digital quizzes as valid continuous internal evaluation (CIE) components [my account, conversation] [Observed].

### 12. System Owner / Maintainer (Infrastructure Lead)
* **Ownership**: Physical hardware maintenance, local Docker environment, operating system updates, network tunnel uptime, and disaster recovery execution [conversation, code or files] [Designed].
* **Decisions Made / Would Make**: Deployed local Docker containers; established Windows startup scripts for tunnel restoration; executed manual server switches during diagnostics [conversation, code or files] [Measured].
* **Artifacts Produced**: Hardware Maintenance Schedules, Tunnel Recovery Scripts, Server Diagnostic Logs, Failover Runbooks [code or files] [Designed].
* **Evaluation Criteria**: Primary server availability, recovery time objective (RTO < 5 minutes) during local machine reboots [code or files] [Designed].
* **Open Items**: Procuring and installing a dedicated Uninterruptible Power Supply (UPS) for the primary desktop machine; designating a trained secondary backup maintainer [my account, conversation] [Observed].

---

## 2. RACI Governance Matrix

* **R = Responsible**: The role that conducts the actual work.
* **A = Accountable**: The sole role with final approval and ownership.
* **C = Consulted**: Roles providing essential input and domain expertise.
* **I = Informed**: Roles updated on progress and outcomes.

| Core Operational Activity | PM | TPM | PgM | Ops | Des | Dev | QA | Data | Sec | Sup | Exec | Sys |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Defining Feature Scope & Roadmaps** | **A** | R | C | C | C | C | I | C | C | C | I | I |
| **Architecture & Failover Engineering** | C | **A** | I | I | I | R | C | I | C | I | I | R |
| **Classroom Deployment & Center Rollout** | C | I | **A** | R | I | I | I | I | I | C | I | I |
| **UI Design & Projector Accessibility** | C | I | I | I | **A** | R | C | I | I | C | I | I |
| **Code Implementation & Bug Fixing** | I | C | I | I | C | **A** | C | I | C | I | I | C |
| **Pre-Release Network Simulation Testing** | I | I | I | I | I | C | **A** | I | I | I | I | I |
| **Telemetry & Metrics Reporting** | C | I | I | C | I | C | I | **A** | C | I | I | I |
| **Privacy, RLS & Anonymity Governance** | C | C | I | I | I | C | I | C | **A** | I | I | I |
| **Mentor Training & Adoption Enablement** | C | I | C | C | I | I | I | I | I | **A** | I | I |
| **Physical Server Uptime & Tunnel Care** | I | C | I | C | I | I | I | I | I | I | I | **A** |
| **Program Continuation & Budget Approval** | C | I | C | I | I | I | I | I | I | I | **A** | I |
| **Post-Quiz Survey Feedback Analysis** | **A** | I | C | R | I | I | I | R | C | C | I | I |
