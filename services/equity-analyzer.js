/**
 * Equity Analyzer Service
 *
 * Compares a vehicle's current market value against the customer's
 * remaining loan payoff to determine equity position (positive,
 * negative, or breakeven) and generates trade-up opportunity scores.
 */

import { v4 as uuidv4 } from 'uuid';
import { readFileSync } from 'node:fs';
import { query, run } from './db.js';
import { getMultiSourceValuation } from './valuation.js';

const CONFIG_PATH = new URL('../config/equity-rules.json', import.meta.url);

// ── Internal helpers ─────────────────────────────────────────────

/**
 * Advance a pipeline record from one stage to the next.
 * Returns true if a matching record was found and updated.
 */
async function advancePipeline(assetId, fromStageId, toStageId) {
  const rows = await query(
    `SELECT id FROM pipeline_records WHERE asset_id = '${assetId}' AND pipeline_stage_id = '${fromStageId}'`
  );
  if (rows.length > 0) {
    await run(
      `UPDATE pipeline_records SET pipeline_stage_id = '${toStageId}', entered_stage_at = current_timestamp, updated_at = current_timestamp WHERE id = '${rows[0].id}'`
    );
    return true;
  }
  return false;
}

/**
 * Estimate remaining loan payoff (mock — real payoff comes from DMS in a future phase).
 * Assumes a typical 60-month auto loan at 90 % of retail value.
 */
function estimatePayoff(retailValue, mileage, year) {
  const currentYear = new Date().getFullYear();
  const vehicleAge = currentYear - year;
  const loanTermMonths = 60;
  const monthsElapsed = Math.min(vehicleAge * 12, loanTermMonths);
  const progress = monthsElapsed / loanTermMonths;
  const originalLoan = retailValue * 0.90;
  const remaining = originalLoan * (1 - progress);
  return Math.round(remaining * 100) / 100;
}

// ── Exports ──────────────────────────────────────────────────────

/**
 * Load equity rules for an organization, merging defaults with
 * any org-specific overrides from config/equity-rules.json.
 *
 * @param {string} orgId - Organisation identifier (e.g. 'org-dealer-summit').
 * @returns {object} Fully-resolved rules object.
 */
export function getOrgRules(orgId) {
  const raw = readFileSync(CONFIG_PATH, 'utf-8');
  const config = JSON.parse(raw);
  const rules = { ...config.defaults };
  if (config.overrides[orgId]) {
    Object.assign(rules, config.overrides[orgId]);
  }
  return rules;
}

/**
 * Check whether a vehicle asset is eligible for equity analysis
 * based on the given rules (vehicle age + mileage windows).
 *
 * @param {object} asset - Asset row with at least { vin, year, mileage }.
 * @param {object} rules - Resolved rules from getOrgRules().
 * @returns {boolean}
 */
export function isEligible(asset, rules) {
  if (!asset.vin || asset.mileage == null) return false;

  const currentYear = new Date().getFullYear();
  const age = currentYear - asset.year;

  if (age < rules.min_vehicle_age_years || age > rules.max_vehicle_age_years) return false;
  if (asset.mileage < rules.min_mileage || asset.mileage > rules.max_mileage) return false;

  return true;
}

/**
 * Analyse the equity position for a single asset/contact pair.
 *
 * Calculates equity, classifies it, generates a recommendation,
 * and persists the result to the equity_analyses table.
 *
 * @param {string} assetId     - Internal vehicle asset identifier.
 * @param {string} contactId   - Internal contact identifier.
 * @param {number} marketValue - Estimated current market value in dollars.
 * @param {number} payoff      - Remaining loan payoff amount in dollars.
 * @returns {Promise<{id: string, assetId: string, contactId: string, marketValue: number, payoff: number, equity: number, equityPercent: number, equityType: string, recommendation: string}>}
 */
export async function analyzeEquity(assetId, contactId, marketValue, payoff) {
  const rules = getOrgRules('__defaults__'); // standalone calls use global defaults

  const equity = marketValue - payoff;
  const equityPercent = Math.round((equity / marketValue) * 100 * 100) / 100;

  const [low, high] = rules.breakeven_range;
  let equityType;
  if (equity > high) equityType = 'positive';
  else if (equity < low) equityType = 'negative';
  else equityType = 'breakeven';

  let recommendation;
  if (equityType === 'positive') {
    recommendation = `Strong trade-up candidate — $${equity} positive equity`;
  } else if (equityType === 'breakeven') {
    recommendation = 'Near breakeven — may respond to incentive offer';
  } else {
    recommendation = `Negative equity of $${Math.abs(equity)} — not recommended for outreach`;
  }

  const id = uuidv4();
  const analysisData = JSON.stringify({ equityPercent, recommendation }).replace(/'/g, "''");

  await run(
    `INSERT INTO equity_analyses (id, asset_id, contact_id, market_value, payoff_amount, equity_amount, equity_type, valuation_source, analysis_data)
     VALUES ('${id}', '${assetId}', '${contactId}', ${marketValue}, ${payoff}, ${equity}, '${equityType}', 'mock', '${analysisData}')`
  );

  return {
    id,
    assetId,
    contactId,
    marketValue,
    payoff,
    equity,
    equityPercent,
    equityType,
    recommendation,
  };
}

/**
 * Run equity analysis for every eligible asset within an organisation.
 *
 * For each eligible vehicle:
 *   1. Obtain composite valuation via getMultiSourceValuation
 *   2. Estimate payoff (mock)
 *   3. Calculate and persist equity via analyzeEquity
 *   4. Advance pipeline: data_enriched → valuation_complete → equity_calculated
 *
 * @param {string} orgId - Organisation / dealer identifier.
 * @returns {Promise<{processed: number, opportunities: number, errors: number, skipped: number}>}
 */
export async function batchAnalyze(orgId) {
  const rules = getOrgRules(orgId);

  const assets = await query(
    `SELECT DISTINCT a.* FROM assets a
     JOIN contact_org_links col ON a.contact_id = col.contact_id
     WHERE col.organization_id = '${orgId}' AND a.asset_type = 'vehicle'`
  );

  let processed = 0;
  let opportunities = 0;
  let errors = 0;
  let skipped = 0;

  for (const asset of assets) {
    if (!isEligible(asset, rules)) {
      skipped++;
      continue;
    }

    try {
      const valuation = await getMultiSourceValuation(asset.vin, asset.mileage);
      const marketValue = valuation.composite.tradeIn;
      const payoff = estimatePayoff(valuation.composite.retail, asset.mileage, asset.year);

      const result = await analyzeEquity(asset.id, asset.contact_id, marketValue, payoff);
      processed++;

      if (result.equityType === 'positive') {
        opportunities++;
      }

      // Advance pipeline: identified → data_enriched
      await advancePipeline(asset.id, 'ps-eq-01', 'ps-eq-02');
      // Advance pipeline: data_enriched → valuation_complete
      await advancePipeline(asset.id, 'ps-eq-02', 'ps-eq-03');
      // Advance pipeline: valuation_complete → equity_calculated
      await advancePipeline(asset.id, 'ps-eq-03', 'ps-eq-04');
    } catch (err) {
      errors++;
    }
  }

  return { processed, opportunities, errors, skipped };
}
