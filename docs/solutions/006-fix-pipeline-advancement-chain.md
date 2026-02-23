# Solution 006: Fix Pipeline Advancement Chain

## References
- Problem: [docs/issues/006-pipeline-not-advancing-on-deal-sheet-send.md](../issues/006-pipeline-not-advancing-on-deal-sheet-send.md)

## Solution

Three targeted fixes to close the gaps in the pipeline advancement chain.

### Fix 1: Add missing first stage advance in `batchAnalyze()`

**File:** `services/equity-analyzer.js` — inside the `batchAnalyze()` for-loop

Add the missing `ps-eq-01 → ps-eq-02` call before the existing two:

```js
// Advance pipeline: identified → data_enriched         ← NEW
await advancePipeline(asset.id, 'ps-eq-01', 'ps-eq-02');
// Advance pipeline: data_enriched → valuation_complete  (existing)
await advancePipeline(asset.id, 'ps-eq-02', 'ps-eq-03');
// Advance pipeline: valuation_complete → equity_calculated (existing)
await advancePipeline(asset.id, 'ps-eq-03', 'ps-eq-04');
```

**Why:** `batchAnalyze()` does the work of all three transitions (enrichment +
valuation + equity calc). It should advance through all three corresponding
pipeline stages. The `advancePipeline()` calls are idempotent — if the record
isn't at the `fromStage`, the call silently does nothing, so adding the extra
call is safe for records already past `ps-eq-01`.

### Fix 2: Try multiple source stages in `markPresented()`

**File:** `services/deal-sheet.js` — `markPresented()` function

Replace the single advance call with a chain that covers records stuck at
earlier stages:

```js
// Try advancing from wherever the record currently sits
await advancePipeline(dealSheet.asset_id, 'ps-eq-01', 'ps-eq-05');
await advancePipeline(dealSheet.asset_id, 'ps-eq-02', 'ps-eq-05');
await advancePipeline(dealSheet.asset_id, 'ps-eq-03', 'ps-eq-05');
await advancePipeline(dealSheet.asset_id, 'ps-eq-04', 'ps-eq-05');
```

**Why:** Only one of these will match (the one where the record currently sits),
and the rest will silently no-op. This ensures the pipeline catches up regardless
of what stage the record was stranded at.

### Fix 3: Try multiple source stages in `generateClientOffer()`

**File:** `services/deal-sheet.js` — `generateClientOffer()` function

Same approach:

```js
await advancePipeline(dealSheet.asset_id, 'ps-eq-04', 'ps-eq-06');
await advancePipeline(dealSheet.asset_id, 'ps-eq-05', 'ps-eq-06');
```

**Why:** Covers the case where `markPresented()` already jumped the record
to `ps-eq-05`, as well as the case where it's still stuck at an earlier stage.

## Expected Result After Fix

| Step | Pipeline Stage | Funnel Shows |
|------|---------------|--------------|
| Batch analysis completes | ps-eq-04 (equity_calculated) | +1 in "Equity Calculated" |
| Deal sheet marked presented | ps-eq-05 (offer_generated) | +1 in "Offer Generated" |
| Client offer sent | ps-eq-06 (offer_sent) | +1 in "Offer Sent" |
| Customer opens offer link | ps-eq-07 (offer_opened) | +1 in "Offer Opened" |

## Verification

1. Reset the test by deleting deal_sheets for the org
2. Run Batch Analysis
3. Open deal sheet → Mark as Presented → pipeline funnel shows 1 in "Offer Generated"
4. Send Client Offer → pipeline funnel shows 1 in "Offer Sent"
5. Open `/offer/{token}` → pipeline funnel shows 1 in "Offer Opened"
