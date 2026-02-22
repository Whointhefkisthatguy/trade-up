---
name: vendor-task-manager
description: Manages tasks assigned to external vendors, tracks deadlines, sends reminders, and reports on vendor performance.
version: "0.1.0"
metadata:
  tags:
    - vendors
    - tasks
    - deadlines
    - reminders
    - performance
  phase: operations
---

## Overview

The Vendor Task Manager skill provides end-to-end lifecycle management for tasks assigned to external vendors (photographers, detailers, inspectors, transport companies, etc.). It handles task creation and assignment, monitors deadlines, sends escalating reminders as due dates approach, and aggregates performance metrics so dealership managers can evaluate vendor reliability. This skill ensures that outsourced work stays on track and that underperforming vendors are identified early.

## Inputs

- **task** (object, required for task creation) — The vendor task definition:
  - `title` — Short description of the work to be done.
  - `description` — Detailed instructions or requirements.
  - `vendor_id` — Identifier of the assigned vendor.
  - `dealership_id` — The dealership requesting the work.
  - `due_date` — Deadline for task completion.
  - `priority` — Priority level ("low", "medium", "high", "urgent").
  - `attachments` — Any files or links relevant to the task (photos, documents, etc.).
- **reminder_schedule** (object, optional) — Configuration for automated reminders:
  - `initial_reminder` — How many hours/days before the deadline to send the first reminder.
  - `follow_up_interval` — Interval between subsequent reminders.
  - `escalation_threshold` — Number of missed reminders before escalating to the dealership manager.
- **vendor_registry** (object, required) — Lookup data for vendor contact information, service categories, and historical performance records.
- **reporting_period** (object, optional) — Date range for generating vendor performance reports. Contains `start_date` and `end_date`.

## Steps

1. Validate the incoming task definition, ensuring all required fields are present and the due date is in the future.
2. Look up the assigned vendor in the vendor registry and confirm they are active and authorized for the task's service category.
3. Create the task record in the task store with status "assigned" and associate it with the vendor and dealership.
4. Send the initial task assignment notification to the vendor via their preferred contact channel (email or SMS).
5. Schedule automated reminders based on the reminder schedule configuration.
6. Monitor task status; when the vendor marks a task as complete, validate any required deliverables (e.g., uploaded photos, completed inspection forms).
7. If reminders go unanswered past the escalation threshold, notify the dealership manager and flag the task as "at_risk".
8. When a task is completed or closed, record the completion timestamp and calculate turnaround metrics.
9. On demand or on a scheduled basis, aggregate performance data across the reporting period to produce vendor scorecards.
10. Return task status or performance report depending on the operation requested.

## Outputs

- **task_record** (object) — The created or updated task, including:
  - `task_id` — Unique task identifier.
  - `status` — Current status ("assigned", "in_progress", "completed", "overdue", "at_risk", "closed").
  - `vendor` — Vendor name and contact info.
  - `dealership` — Requesting dealership.
  - `due_date` — Task deadline.
  - `completed_at` — Completion timestamp (if applicable).
  - `reminders_sent` — Count of reminders dispatched.
- **performance_report** (object, when reporting is requested) — Vendor scorecard containing:
  - `vendor_id` — The vendor being evaluated.
  - `period` — The reporting date range.
  - `tasks_assigned` — Total tasks assigned in the period.
  - `tasks_completed_on_time` — Count completed before deadline.
  - `tasks_completed_late` — Count completed after deadline.
  - `tasks_overdue` — Count still overdue.
  - `average_turnaround_hours` — Mean time from assignment to completion.
  - `on_time_percentage` — Percentage of tasks completed on time.
- **notifications_sent** (array) — Log of all notifications dispatched (assignments, reminders, escalations).
