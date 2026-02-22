---
name: service-equity-monitor
description: Monitors upcoming DMS service appointments, cross-references with equity data, and identifies customers with positive equity positions for trade-in outreach.
version: "0.1.0"
metadata:
  tags:
    - service
    - equity
    - dms
    - pipeline
    - trade-in
  phase: opportunity-detection
---

## Overview

The Service Equity Monitor skill bridges the service department and the sales floor by continuously monitoring upcoming service appointments from the dealership's DMS (Dealer Management System) and cross-referencing each customer's vehicle against current equity data. Customers whose vehicles have positive equity — meaning the market value exceeds the remaining loan balance — are flagged as trade-in candidates and fed into the outreach pipeline. This turns routine service visits into proactive sales opportunities.

## Inputs

- **dms_connection** (object, required) — Connection credentials and configuration for the dealership's DMS integration (supports CDK, Reynolds & Reynolds, Dealertrack).
- **appointment_window** (object, required) — The date range of service appointments to scan. Contains `start_date` and `end_date` fields.
- **equity_source** (string, required) — The valuation provider to use for equity calculations (e.g., "black_book", "kbb", "galves").
- **equity_threshold** (number, optional, default: 0) — Minimum positive equity amount in dollars for a customer to qualify as an outreach candidate.
- **exclusion_filters** (object, optional) — Criteria to exclude certain customers, such as those contacted within the last N days, those already in an active deal, or those on a do-not-contact list.

## Steps

1. Connect to the dealership's DMS and retrieve all service appointments within the specified date window, including customer contact information and vehicle VIN.
2. For each appointment, decode the vehicle VIN (using the vin-decoder skill) to obtain year, make, model, and trim.
3. Query the configured equity source to obtain the current wholesale and retail market values for each vehicle.
4. Retrieve payoff or estimated remaining balance data from the DMS or lender integration for each customer's vehicle loan.
5. Calculate equity position: market value minus remaining loan balance.
6. Apply the equity threshold filter to retain only customers with equity at or above the configured minimum.
7. Apply exclusion filters to remove customers who should not be contacted.
8. Rank qualified customers by equity amount and upcoming appointment date.
9. Output the qualified opportunity list for downstream consumption by the trade-offer-send skill or CRM.

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
