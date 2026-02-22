---
name: social-content-pipeline
description: Manages social media content creation workflow from idea through approval to publishing. Supports Instagram, LinkedIn, and Facebook templates.
version: "0.1.0"
metadata:
  tags:
    - social-media
    - content
    - instagram
    - linkedin
    - facebook
    - publishing
  phase: marketing
---

## Overview

The Social Content Pipeline skill orchestrates the full lifecycle of social media content for dealerships, from initial idea capture through copywriting, creative review, approval, and scheduled publishing. It supports platform-specific templates for Instagram, LinkedIn, and Facebook, ensuring that content is formatted correctly for each channel. The workflow enforces an approval gate so that nothing goes live without sign-off from the designated approver, and it maintains a content calendar so teams can plan ahead.

## Inputs

- **content_idea** (object, required for new content) — The seed for a new piece of content:
  - `topic` — Brief description of the content topic or angle.
  - `platforms` — Target platforms (array of `"instagram"`, `"linkedin"`, `"facebook"`).
  - `content_type` — Type of post ("image", "carousel", "video", "text", "story").
  - `target_date` — Desired publish date.
  - `notes` — Any additional direction, hashtags, or references.
- **dealership_profile** (object, required) — Brand profile for the dealership, including name, logo, tone-of-voice guidelines, brand colors, and hashtag sets.
- **media_assets** (array, optional) — Uploaded images, videos, or design files to accompany the post.
- **approval_chain** (array, required) — Ordered list of approvers who must sign off before publishing. Each entry includes a user ID and role.
- **publishing_credentials** (object, required) — OAuth tokens or API keys for the target social media platforms.

## Steps

1. Receive the content idea and validate that all required fields are present and the target platforms are supported.
2. Create a content record in the pipeline with status "draft" and assign it to the content calendar for the target date.
3. Generate platform-specific drafts by applying the dealership's tone-of-voice guidelines and selecting the appropriate template for each platform and content type.
4. Attach any provided media assets to the content record and validate dimensions and file sizes against each platform's requirements (e.g., Instagram square 1080x1080, LinkedIn landscape 1200x627).
5. Route the drafted content to the first approver in the approval chain and notify them via email or in-app notification.
6. Track approval responses; if changes are requested, update the content record status to "revision_needed" and notify the content creator.
7. Once all approvers have signed off, update the status to "approved" and confirm the scheduled publish time.
8. At the scheduled publish time, use the platform APIs to post the content to each target platform.
9. Capture the post URLs and initial engagement data (post ID, permalink) from each platform's API response.
10. Log the publication event and return results.

## Outputs

- **content_record** (object) — The content item and its current state:
  - `content_id` — Unique identifier.
  - `status` — Current status ("draft", "in_review", "revision_needed", "approved", "scheduled", "published", "failed").
  - `platforms` — Target platforms and per-platform draft text.
  - `media` — Attached media asset references.
  - `target_date` — Scheduled publish date and time.
  - `approval_status` — Per-approver sign-off status.
- **published_posts** (array, when content is published) — One entry per platform:
  - `platform` — The social media platform.
  - `post_id` — The platform-native post identifier.
  - `permalink` — Direct URL to the published post.
  - `published_at` — Timestamp of publication.
- **calendar_view** (array, when requested) — Upcoming content items for the specified date range, with status and platform breakdowns.
- **errors** (array) — Any issues encountered during validation, approval, or publishing, with actionable details.
