# Issue 006: Pipeline Funnel Not Reflecting Deal Sheet Status Changes

## Problem

After sending a client offer through the deal sheet workflow, the `deal_sheets` table
correctly shows `status = 'client_offer_sent'` and the vehicle table shows the
"Offer Sent" badge — but the Equity Pipeline funnel still shows **0** for
"offer_generated" and "offer_sent" stages.

The pipeline_records table is never updated, so the funnel counts don't change.

## Root Cause

The `advancePipeline()` helper uses **strict exact-match** queries:

```js
SELECT id FROM pipeline_records
WHERE asset_id = '${assetId}' AND pipeline_stage_id = '${fromStageId}'
```

It only updates a record if it's currently at the **exact expected `fromStageId`**.
If the record is at a different stage, it silently returns `false` and does nothing.

There are **two compounding gaps** in the advancement chain:

### Gap 1: `batchAnalyze()` skips `ps-eq-01 → ps-eq-02`

`batchAnalyze()` in `equity-analyzer.js` only attempts two advances:

```
ps-eq-02 (data_enriched)     → ps-eq-03 (valuation_complete)
ps-eq-03 (valuation_complete) → ps-eq-04 (equity_calculated)
```

It never advances from `ps-eq-01 (identified)` → `ps-eq-02 (data_enriched)`.
Assets seeded at `ps-eq-01` (like ast-03 / Jennifer Lee) are permanently stuck
there because neither call matches their current stage.

### Gap 2: Deal sheet workflow assumes record is at `ps-eq-04`

`markPresented()` calls `advancePipeline(assetId, 'ps-eq-04', 'ps-eq-05')`, and
`generateClientOffer()` calls `advancePipeline(assetId, 'ps-eq-05', 'ps-eq-06')`.

Both silently fail for any asset whose pipeline record never reached `ps-eq-04`.

### Trace for ast-03 (Jennifer Lee's Camry, seeded at ps-eq-01)

| Step | Action | Expected From | Actual Stage | Result |
|------|--------|---------------|--------------|--------|
| 1 | `batchAnalyze` call 1 | ps-eq-02 | ps-eq-01 | SKIP (no match) |
| 2 | `batchAnalyze` call 2 | ps-eq-03 | ps-eq-01 | SKIP (no match) |
| 3 | `markPresented` | ps-eq-04 | ps-eq-01 | SKIP (no match) |
| 4 | `generateClientOffer` | ps-eq-05 | ps-eq-01 | SKIP (no match) |

**Result:** Pipeline record stays at `ps-eq-01` forever, while `deal_sheets.status`
correctly reaches `client_offer_sent`. The two systems are out of sync.

## Affected Files

| File | Line(s) | Issue |
|------|---------|-------|
| `services/equity-analyzer.js` | 188-190 | Missing `ps-eq-01 → ps-eq-02` advancement |
| `services/deal-sheet.js` | ~174 | `markPresented` only tries from `ps-eq-04` |
| `services/deal-sheet.js` | ~207 | `generateClientOffer` only tries from `ps-eq-05` |
