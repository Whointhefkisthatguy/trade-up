---
name: client-status-notify
description: Monitors task status changes and sends notifications to relevant stakeholders (dealership managers, team members) via email and SMS.
version: "0.1.0"
metadata:
  tags:
    - notifications
    - status
    - email
    - sms
    - tasks
  phase: operations
---

## Overview

The Client Status Notify skill watches for task status transitions across the Trade Up platform and dispatches timely notifications to the appropriate stakeholders. When a task moves from one status to another (e.g., "pending" to "in_progress", or "in_progress" to "completed"), this skill determines who needs to know, selects the right notification template, and delivers alerts via email and/or SMS. It keeps dealership managers, team members, and other stakeholders informed without requiring them to poll dashboards.

## Inputs

- **task_event** (object, required) — The status change event, containing:
  - `task_id` — Unique identifier of the task.
  - `task_type` — Category of the task (e.g., "trade_offer", "vendor_assignment", "content_review").
  - `previous_status` — The status the task is transitioning from.
  - `new_status` — The status the task is transitioning to.
  - `changed_by` — The user or system that triggered the change.
  - `changed_at` — Timestamp of the status change.
  - `context` — Additional task-specific data (customer name, vehicle, dealership, etc.).
- **notification_rules** (array, required) — Rules that map task types and status transitions to recipient groups and channels. Each rule specifies:
  - `task_type` — Which task type the rule applies to (or `"*"` for all).
  - `transition` — The from/to status pair that triggers this rule.
  - `recipients` — List of recipient identifiers (role-based like "manager" or specific user IDs).
  - `channels` — Which channels to use (`"email"`, `"sms"`, or both).
  - `template_id` — The notification template to render.
- **recipient_directory** (object, required) — Lookup source for resolving recipient identifiers to contact information (name, email, phone).

## Steps

1. Receive the task status change event and extract the task type, previous status, and new status.
2. Match the event against the notification rules to find all applicable rules for this transition.
3. For each matched rule, resolve the recipient identifiers against the recipient directory to obtain contact details.
4. Deduplicate recipients across rules to prevent sending multiple notifications to the same person for the same event.
5. Load and compile the notification template specified by each rule.
6. Merge the task event context data into the template to produce the personalized notification body.
7. Dispatch email notifications via the configured email provider.
8. Dispatch SMS notifications via the configured SMS provider.
9. Log all notification deliveries with timestamps, recipients, channels, and delivery status.
10. Return the notification results.

## Outputs

- **notifications_sent** (array) — List of notifications that were dispatched, each containing:
  - `recipient` — Name and contact method used.
  - `channel` — Delivery channel ("email" or "sms").
  - `template_id` — The template that was rendered.
  - `message_id` — Provider tracking ID.
  - `sent_at` — Timestamp of dispatch.
- **notifications_skipped** (array) — Notifications that were not sent, with reasons (e.g., "no matching rule", "recipient missing email", "duplicate suppressed").
- **event_log** (object) — A summary record of the event processing:
  - `task_id` — The task that triggered notifications.
  - `transition` — The status transition that occurred.
  - `rules_matched` — Number of notification rules that matched.
  - `total_sent` — Total notifications dispatched.
  - `total_skipped` — Total notifications suppressed.
