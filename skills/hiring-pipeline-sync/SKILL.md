---
name: hiring-pipeline-sync
description: Manages the recruitment pipeline from sourcing candidates through interviews to onboarding. Tracks candidate progress and automates follow-ups.
version: "0.1.0"
metadata:
  tags:
    - hiring
    - recruitment
    - candidates
    - onboarding
    - pipeline
  phase: operations
---

## Overview

The Hiring Pipeline Sync skill manages the full recruitment lifecycle for dealership positions. It tracks candidates from initial sourcing through screening, interviews, offer, and onboarding. The skill automates repetitive follow-up communications, keeps hiring managers informed of pipeline status, and ensures no candidate falls through the cracks. It integrates with job boards and applicant tracking systems to centralize candidate data and provides pipeline analytics so hiring managers can identify bottlenecks and optimize their process.

## Inputs

- **position** (object, required for pipeline creation) — The open position definition:
  - `title` — Job title (e.g., "Sales Consultant", "Service Advisor", "Finance Manager").
  - `dealership_id` — The dealership with the opening.
  - `department` — Department (sales, service, finance, parts, admin).
  - `hiring_manager_id` — The user responsible for hiring decisions.
  - `requirements` — Key qualifications and experience requirements.
  - `target_start_date` — Desired start date for the new hire.
- **candidate** (object, required for candidate actions) — Candidate information:
  - `name` — Full name.
  - `email` — Email address.
  - `phone` — Phone number.
  - `resume_url` — Link to uploaded resume.
  - `source` — Where the candidate was found (e.g., "Indeed", "LinkedIn", "referral", "walk-in").
  - `notes` — Recruiter notes or initial impressions.
- **pipeline_stage_update** (object, optional) — A stage transition for an existing candidate:
  - `candidate_id` — The candidate to update.
  - `new_stage` — Target stage ("sourced", "screening", "phone_interview", "in_person_interview", "offer_extended", "offer_accepted", "onboarding", "hired", "rejected", "withdrawn").
  - `notes` — Notes about the transition (interview feedback, rejection reason, etc.).
- **follow_up_rules** (object, optional) — Automation rules for candidate follow-ups:
  - `days_without_update` — Number of days of inactivity before sending a follow-up.
  - `max_follow_ups` — Maximum number of automated follow-ups before escalating.
  - `escalate_to` — User to notify when follow-ups are exhausted.

## Steps

1. When a new position is created, initialize the hiring pipeline with the defined stages and associate it with the dealership and hiring manager.
2. When a new candidate is added, create the candidate record, attach their resume, and place them in the "sourced" stage.
3. Send the candidate an acknowledgment message confirming their application was received.
4. When a candidate's stage is updated, record the transition with timestamp and notes, and trigger any stage-specific actions:
   - "screening" -- notify the recruiter to review the resume.
   - "phone_interview" -- send the candidate available time slots for scheduling.
   - "in_person_interview" -- send confirmation with dealership address and interview details.
   - "offer_extended" -- generate and send the offer communication.
   - "offer_accepted" -- trigger onboarding preparation tasks.
   - "rejected" -- send a respectful rejection notification.
5. Monitor candidate records for inactivity based on the follow-up rules. Send automated follow-ups to candidates or hiring managers who have not taken action.
6. If automated follow-ups are exhausted without response, escalate to the configured escalation contact.
7. Track time-in-stage metrics for each candidate to identify pipeline bottlenecks.
8. Generate pipeline summary reports on demand, showing candidate counts per stage, average time per stage, and source effectiveness.
9. When a candidate reaches "hired" status, close the pipeline position (or keep it open if multiple hires are needed) and archive candidate records.
10. Return the requested pipeline state, candidate record, or analytics report.

## Outputs

- **pipeline_summary** (object) — Current state of the hiring pipeline:
  - `position` — Job title and dealership.
  - `status` — Pipeline status ("open", "filled", "on_hold", "closed").
  - `stages` — Candidate counts per stage.
  - `total_candidates` — Total candidates in the pipeline.
  - `days_open` — Number of days the position has been open.
- **candidate_record** (object) — Individual candidate state:
  - `candidate_id` — Unique identifier.
  - `name` — Candidate name.
  - `current_stage` — Current pipeline stage.
  - `stage_history` — Array of stage transitions with timestamps and notes.
  - `follow_ups_sent` — Count of automated follow-ups dispatched.
  - `days_in_current_stage` — Time spent in the current stage.
- **analytics** (object, when reporting is requested) — Pipeline performance metrics:
  - `average_time_to_hire` — Mean days from sourced to hired.
  - `stage_conversion_rates` — Percentage of candidates advancing from each stage to the next.
  - `source_effectiveness` — Candidate counts and hire rates by source channel.
  - `bottleneck_stages` — Stages with the longest average dwell times.
- **notifications_sent** (array) — Log of all automated messages dispatched to candidates, hiring managers, and escalation contacts.
