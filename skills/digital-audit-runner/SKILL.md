---
name: digital-audit-runner
description: Audits dealership digital presence including website, social media, review sites, and search rankings. Generates findings and action plans.
version: "0.1.0"
metadata:
  tags:
    - audit
    - digital-presence
    - seo
    - reviews
    - website
  phase: analytics
---

## Overview

The Digital Audit Runner skill performs a comprehensive audit of a dealership's digital footprint. It evaluates the dealership's website for performance and SEO health, checks social media profiles for completeness and activity, analyzes review site ratings and sentiment, and assesses local search rankings for key automotive terms. The output is a structured findings report with severity-ranked issues and a prioritized action plan that dealership staff or the Trade Up team can execute against.

## Inputs

- **dealership** (object, required) — The dealership to audit:
  - `name` — Dealership name.
  - `website_url` — Primary website URL.
  - `social_profiles` — Object mapping platform names to profile URLs (e.g., `{ "facebook": "https://...", "instagram": "https://...", "linkedin": "https://..." }`).
  - `google_business_id` — Google Business Profile identifier (if available).
  - `location` — City, state, and ZIP code for local search ranking checks.
- **audit_modules** (array, optional, default: all) — Which audit modules to run. Options:
  - `"website"` — Page speed, mobile responsiveness, SSL, meta tags, structured data.
  - `"seo"` — Keyword rankings, backlink profile, domain authority.
  - `"social"` — Profile completeness, posting frequency, engagement rates.
  - `"reviews"` — Ratings across Google, Yelp, DealerRater, Cars.com; sentiment analysis of recent reviews.
  - `"local_search"` — Local pack rankings for target keywords in the dealership's market area.
- **benchmark_group** (string, optional) — Compare results against a peer group benchmark (e.g., "luxury_single_point", "multi_franchise_group", "independent").
- **previous_audit_id** (string, optional) — Reference a prior audit to generate a delta comparison showing improvements and regressions.

## Steps

1. Validate the dealership input and resolve all provided URLs to confirm they are reachable.
2. Run the website audit module: measure page load speed (via Lighthouse or similar), check mobile responsiveness, verify SSL certificate validity, scan meta tags and Open Graph data, and validate structured data markup (schema.org).
3. Run the SEO audit module: check keyword rankings for a standard set of automotive search terms localized to the dealership's market, evaluate the backlink profile, and pull domain authority scores.
4. Run the social media audit module: for each provided social profile, check profile completeness (bio, contact info, profile/cover images), measure posting frequency over the last 90 days, and calculate average engagement rates.
5. Run the reviews audit module: aggregate ratings from Google, Yelp, DealerRater, and Cars.com; pull the most recent reviews and run sentiment analysis to identify common praise themes and complaint patterns.
6. Run the local search audit module: simulate local searches for target keywords from the dealership's geographic area and record where the dealership appears in the local pack and organic results.
7. Score each module on a 0-100 scale based on predefined rubrics.
8. If a benchmark group is specified, compare the dealership's scores against the group median.
9. If a previous audit is referenced, compute deltas for each metric to highlight improvements and regressions.
10. Compile all findings into a structured report with severity rankings (critical, warning, info) and generate a prioritized action plan.

## Outputs

- **audit_report** (object) — The complete audit results:
  - `audit_id` — Unique identifier for this audit run.
  - `dealership` — The audited dealership name and location.
  - `run_date` — Timestamp of the audit.
  - `overall_score` — Composite score (0-100) across all modules.
  - `module_scores` — Per-module scores (website, seo, social, reviews, local_search).
  - `findings` — Array of individual findings, each with:
    - `module` — Which audit module produced the finding.
    - `severity` — "critical", "warning", or "info".
    - `title` — Short description of the issue.
    - `detail` — Explanation and evidence.
    - `recommendation` — Suggested remediation.
- **action_plan** (array) — Prioritized list of recommended actions, ordered by impact and effort:
  - `priority` — Rank order.
  - `action` — What to do.
  - `module` — Related audit module.
  - `estimated_effort` — Low, medium, or high.
  - `expected_impact` — Low, medium, or high.
- **benchmark_comparison** (object, when benchmark group is specified) — Dealership scores vs. group median for each module.
- **delta_report** (object, when previous audit is referenced) — Per-metric changes since the last audit, with direction indicators (improved, declined, unchanged).
