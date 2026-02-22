---
name: trade-offer-send
description: Generates personalized trade-in offers using dealership brand profiles and Handlebars templates, delivers via email and SMS, and tracks opens and responses.
version: "0.1.0"
metadata:
  tags:
    - offers
    - email
    - sms
    - templates
    - handlebars
    - outreach
  phase: customer-engagement
---

## Overview

The Trade Offer Send skill handles the last mile of the trade-in outreach process. It takes qualified opportunity data (typically from the service-equity-monitor skill), merges it with dealership brand profiles and Handlebars-based message templates, and delivers personalized trade-in offers to customers via email and SMS. Every message is tracked for opens, clicks, and replies so the dealership can measure campaign effectiveness and follow up with engaged prospects.

## Inputs

- **opportunities** (array, required) — One or more opportunity objects containing customer contact info, vehicle details, equity data, and appointment info. Typically produced by the service-equity-monitor skill.
- **dealership_profile** (object, required) — Brand profile for the sending dealership, including:
  - `name` — Dealership display name.
  - `logo_url` — URL to the dealership logo.
  - `primary_color` — Brand hex color for template rendering.
  - `phone` — Dealership phone number for reply-to.
  - `address` — Physical address for CAN-SPAM compliance.
- **template_id** (string, required) — The identifier for the Handlebars template to use. Templates are stored in the platform's template library and support both email (HTML) and SMS (plain text) variants.
- **channels** (array, required) — Delivery channels to use. Accepts `"email"`, `"sms"`, or both.
- **send_window** (object, optional) — Preferred delivery time window with `start_hour` and `end_hour` in the dealership's local timezone. Messages outside this window are queued.
- **sender_override** (object, optional) — Override the default sender name and reply-to address (e.g., to send from a specific salesperson rather than the dealership).

## Steps

1. Validate all opportunity objects have the required contact fields for the selected channels (email address for email, phone number for SMS).
2. Load the specified Handlebars template from the template library and compile it.
3. For each opportunity, merge the customer, vehicle, equity, and dealership profile data into the template context.
4. Render the personalized message for each channel (HTML email and/or SMS text).
5. Inject tracking pixels and unique click-tracking URLs into email messages.
6. Check the send window; queue any messages that fall outside the allowed hours.
7. Dispatch emails via the configured email service provider (SendGrid, SES, or similar).
8. Dispatch SMS messages via the configured SMS provider (Twilio or similar), respecting TCPA opt-in records.
9. Record send events (message ID, channel, timestamp, recipient) in the tracking store.
10. Return delivery results including any failures or bounces.

## Outputs

- **delivered** (array) — List of successfully dispatched messages, each containing:
  - `opportunity_id` — Reference to the source opportunity.
  - `channel` — The channel used ("email" or "sms").
  - `message_id` — Provider message ID for tracking.
  - `sent_at` — Timestamp of dispatch.
- **queued** (array) — Messages held for later delivery due to send window constraints, with scheduled send times.
- **failed** (array) — Messages that could not be sent, with error details (e.g., invalid email, phone opted out, provider error).
- **tracking_summary** (object) — Initial send statistics:
  - `total_attempted` — Number of messages attempted.
  - `total_delivered` — Number confirmed delivered.
  - `total_queued` — Number queued for later.
  - `total_failed` — Number that failed.
