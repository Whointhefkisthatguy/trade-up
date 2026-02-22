---
name: service-equity-monitor
description: Monitors upcoming DMS service appointments, cross-references with equity data, and identifies customers with positive equity positions for trade-in outreach.
version: "0.2.0"
metadata:
  tags:
    - service
    - equity
    - dms
    - pipeline
    - trade-in
    - valuation
  phase: opportunity-detection
---

## Overview

The Service Equity Monitor skill bridges the service department and the sales floor by continuously monitoring upcoming service appointments from the dealership's DMS (Dealer Management System) and cross-referencing each customer's vehicle against current equity data. Customers whose vehicles have positive equity — meaning the market value exceeds the remaining loan balance — are flagged as trade-in candidates and fed into the outreach pipeline. This turns routine service visits into proactive sales opportunities.

## Valuation Integration

Vehicle valuations are obtained through a provider-pattern dispatcher (`services/valuation.js`) that delegates to one or more pricing providers. The current default is a deterministic mock provider (`services/valuation-mock.js`) that derives values purely from the VIN string and mileage without external API calls.

**Mock provider behaviour:**
- Extracts model year from VIN position 10 (standard VIN spec)
- Computes a deterministic base MSRP from a VIN character-code hash ($22k–$55k)
- Applies a depreciation curve: 15 % year 1, 10 % years 2–5, 7 % years 6+
- Applies a mileage deduction of ~$800 per 15k miles
- Returns wholesale, retail (×1.18), and trade-in (×1.06) values

**Multi-source composite:** `getMultiSourceValuation()` applies per-source variance factors (KBB ×1.00, NADA ×1.03, Black Book ×0.97) and returns a composite average alongside individual source breakdowns.

## Equity Analysis Engine

The equity analyzer (`services/equity-analyzer.js`) is the core calculation engine for the equity pipeline.

**`analyzeEquity(assetId, contactId, marketValue, payoff)`** — Calculates equity position for a single asset/contact pair:
- `equity = marketValue − payoff`
- Classifies as positive / negative / breakeven using the `breakeven_range` from `config/equity-rules.json`
- Calculates `equityPercent = (equity / marketValue) × 100`
- Generates a recommendation string
- Persists results to the `equity_analyses` table

**`batchAnalyze(orgId)`** — Runs equity analysis across all eligible vehicles for an organisation:
1. Loads org-specific rules via `getOrgRules(orgId)` (merges defaults with overrides)
2. Queries all vehicle assets linked to the org
3. Filters with `isEligible(asset, rules)` (age + mileage windows)
4. For each eligible asset: obtains composite valuation, estimates payoff, calls `analyzeEquity()`
5. Advances pipeline records: `data_enriched` → `valuation_complete` → `equity_calculated`
6. Returns `{ processed, opportunities, errors, skipped }`

**`getOrgRules(orgId)`** — Loads and merges equity rules from config, applying org-specific overrides on top of defaults.

**`isEligible(asset, rules)`** — Validates that a vehicle has the required data (VIN, mileage) and falls within the age and mileage windows defined by the rules.

## Inputs

- **dms_connection** (object, required) — Connection credentials and configuration for the dealership's DMS integration (supports CDK, Reynolds & Reynolds, Dealertrack).
- **appointment_window** (object, required) — The date range of service appointments to scan. Contains `start_date` and `end_date` fields.
- **equity_source** (string, required) — The valuation provider to use for equity calculations (e.g., "black_book", "kbb", "galves").
- **equity_threshold** (number, optional, default: 0) — Minimum positive equity amount in dollars for a customer to qualify as an outreach candidate.
- **exclusion_filters** (object, optional) — Criteria to exclude certain customers, such as those contacted within the last N days, those already in an active deal, or those on a do-not-contact list.

## Steps

1. Connect to the dealership's DMS and retrieve all service appointments within the specified date window, including customer contact information and vehicle VIN.
2. For each appointment, decode the vehicle VIN via `decodeVin()` to obtain year, make, model, and trim.
3. Obtain composite market valuation via `getMultiSourceValuation(vin, mileage)`.
4. Retrieve payoff or estimated remaining balance data from the DMS or lender integration for each customer's vehicle loan (mock: `estimatePayoff` based on retail value, age, and loan progress).
5. Calculate equity position via `analyzeEquity(assetId, contactId, marketValue, payoff)`.
6. Apply the equity threshold filter to retain only customers with equity at or above the configured minimum.
7. Apply exclusion filters to remove customers who should not be contacted.
8. Advance pipeline records through `data_enriched` → `valuation_complete` → `equity_calculated`.
9. Rank qualified customers by equity amount and upcoming appointment date.
10. Output the qualified opportunity list for downstream consumption by the trade-offer-send skill or CRM.

## Outputs

- **opportunities** (array) — A list of qualified trade-in opportunity objects, each containing:
  - `customer` — Name, phone, email, and DMS customer ID.
  - `vehicle` — Decoded vehicle details (year, make, model, trim, mileage).
  - `appointment` — Service appointment date, time, and service type.
  - `equity` — Calculated equity amount, market value used, and estimated payoff.
  - `score` — A composite ranking score based on equity amount and appointment proximity.
- **summary** (object) — Aggregate statistics for the scanned window:
  - `total_appointments` — Number of appointments scanned.
  - `qualified_count` — Number meeting the equity threshold.
  - `average_equity` — Mean equity amount among qualified customers.
  - `top_equity` — Highest equity amount found.
- **skipped** (array) — List of appointments that were excluded, with reasons (e.g., "contacted within 30 days", "active deal in CRM").
