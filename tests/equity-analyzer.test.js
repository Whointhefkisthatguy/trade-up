import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeEquity, batchAnalyze, getOrgRules, isEligible } from '../services/equity-analyzer.js';
import { query, run, close } from '../services/db.js';

// Clean up all equity_analyses rows created during tests and close DB
after(async () => {
  await run("DELETE FROM equity_analyses").catch(() => {});
  await run("DELETE FROM assets WHERE id LIKE 'test-%'").catch(() => {});
  await close();
});

// ──────────────────────────────────────────────────────────────────
// getOrgRules
// ──────────────────────────────────────────────────────────────────

describe('getOrgRules', () => {
  it('should return defaults for unknown org', () => {
    const rules = getOrgRules('nonexistent-org');
    assert.equal(rules.min_positive_equity, 1000);
    assert.equal(rules.max_vehicle_age_years, 7);
    assert.equal(rules.min_mileage, 15000);
    assert.equal(rules.max_mileage, 120000);
  });

  it('should merge overrides for Summit', () => {
    const rules = getOrgRules('org-dealer-summit');
    assert.equal(rules.min_positive_equity, 500);
    assert.equal(rules.max_vehicle_age_years, 8);
    // Defaults still present for keys without overrides
    assert.equal(rules.min_mileage, 15000);
    assert.equal(rules.max_mileage, 120000);
  });
});

// ──────────────────────────────────────────────────────────────────
// isEligible
// ──────────────────────────────────────────────────────────────────

describe('isEligible', () => {
  const defaultRules = getOrgRules('__defaults__');

  it('should accept an eligible vehicle (2020, 32k mi)', () => {
    const asset = { vin: '1FA6P8TH5L5100001', year: 2020, mileage: 32000 };
    assert.equal(isEligible(asset, defaultRules), true);
  });

  it('should reject too-new and too-old vehicles', () => {
    assert.equal(
      isEligible({ vin: 'X', year: 2025, mileage: 30000 }, defaultRules),
      false,
      'age 1 < min_vehicle_age_years 2'
    );
    assert.equal(
      isEligible({ vin: 'X', year: 2010, mileage: 30000 }, defaultRules),
      false,
      'age 16 > max_vehicle_age_years 7'
    );
  });

  it('should reject assets without VIN or mileage', () => {
    assert.equal(
      isEligible({ year: 2020, mileage: 30000 }, defaultRules),
      false,
      'missing VIN'
    );
    assert.equal(
      isEligible({ vin: 'X', year: 2020 }, defaultRules),
      false,
      'missing mileage'
    );
  });

  it('should reject mileage out of range', () => {
    assert.equal(
      isEligible({ vin: 'X', year: 2022, mileage: 5000 }, defaultRules),
      false,
      '5k < min_mileage 15k'
    );
    assert.equal(
      isEligible({ vin: 'X', year: 2022, mileage: 150000 }, defaultRules),
      false,
      '150k > max_mileage 120k'
    );
  });
});

// ──────────────────────────────────────────────────────────────────
// analyzeEquity
// ──────────────────────────────────────────────────────────────────

describe('analyzeEquity', () => {
  it('should identify positive equity when market value exceeds payoff', async () => {
    const result = await analyzeEquity('ast-01', 'ct-cust-01', 25000, 18000);
    assert.equal(result.equity, 7000);
    assert.equal(result.equityType, 'positive');
    assert.ok(result.recommendation.includes('positive equity'));
  });

  it('should identify negative equity when payoff exceeds market value', async () => {
    const result = await analyzeEquity('ast-01', 'ct-cust-01', 15000, 20000);
    assert.equal(result.equity, -5000);
    assert.equal(result.equityType, 'negative');
    assert.ok(result.recommendation.includes('not recommended'));
  });

  it('should identify breakeven within threshold', async () => {
    const result = await analyzeEquity('ast-01', 'ct-cust-01', 20000, 20500);
    assert.equal(result.equity, -500);
    assert.equal(result.equityType, 'breakeven');
    assert.ok(result.recommendation.includes('breakeven'));
  });

  it('should store analysis results in equity_analyses table', async () => {
    const result = await analyzeEquity('ast-01', 'ct-cust-01', 25000, 18000);
    const rows = await query(`SELECT * FROM equity_analyses WHERE id = '${result.id}'`);
    assert.equal(rows.length, 1);
    assert.equal(Number(rows[0].market_value), 25000);
    assert.equal(Number(rows[0].payoff_amount), 18000);
    assert.equal(Number(rows[0].equity_amount), 7000);
    assert.equal(rows[0].equity_type, 'positive');
  });

  it('should calculate equityPercent correctly', async () => {
    const result = await analyzeEquity('ast-01', 'ct-cust-01', 20000, 15000);
    // (5000 / 20000) × 100 = 25
    assert.equal(result.equityPercent, 25);
  });
});

// ──────────────────────────────────────────────────────────────────
// batchAnalyze
// ──────────────────────────────────────────────────────────────────

describe('batchAnalyze', () => {
  it('should process eligible assets for an organization', async () => {
    const result = await batchAnalyze('org-dealer-summit');
    assert.equal(typeof result.processed, 'number');
    assert.equal(typeof result.opportunities, 'number');
    assert.equal(typeof result.errors, 'number');
    assert.equal(typeof result.skipped, 'number');
    assert.ok(result.processed > 0, 'should process at least one asset');
  });

  it('should skip assets without VIN', async () => {
    await run(
      "INSERT INTO assets (id, contact_id, organization_id, asset_type, year, make, model, mileage) VALUES ('test-no-vin', 'ct-cust-01', 'org-dealer-summit', 'vehicle', 2020, 'Test', 'NoVin', 30000)"
    );
    try {
      const result = await batchAnalyze('org-dealer-summit');
      assert.ok(result.skipped >= 1, 'should skip at least one asset (no VIN)');
    } finally {
      await run("DELETE FROM assets WHERE id = 'test-no-vin'");
    }
  });

  it('should apply org-specific rules (Coastal narrower age window)', async () => {
    // Coastal: max_vehicle_age_years = 5 (default is 7).
    // Insert a 2019 vehicle (age 7) — eligible under defaults, too old for Coastal.
    await run(
      "INSERT INTO assets (id, contact_id, organization_id, asset_type, vin, year, make, model, mileage) VALUES ('test-old-coastal', 'ct-cust-10', 'org-dealer-coastal', 'vehicle', '1G1YY22G465TEST01', 2019, 'Chevrolet', 'Malibu', 50000)"
    );
    try {
      const result = await batchAnalyze('org-dealer-coastal');
      assert.ok(result.skipped >= 1, 'should skip vehicle outside Coastal age window');
    } finally {
      await run("DELETE FROM assets WHERE id = 'test-old-coastal'");
    }
  });
});
