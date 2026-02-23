import express from 'express';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync, readdirSync } from 'node:fs';
import { query } from './services/db.js';
import { batchAnalyze } from './services/equity-analyzer.js';
import { getValuation } from './services/valuation.js';
import { previewOffer } from './services/offer-renderer.js';
import { generateDealSheet, getDealSheet, markPresented, generateClientOffer, getClientOfferByToken } from './services/deal-sheet.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(join(__dirname, 'public')));

// DuckDB returns some numeric types as BigInt or Decimal objects
app.set('json replacer', (key, value) => {
  if (typeof value === 'bigint') return Number(value);
  if (value && typeof value === 'object' && 'width' in value && 'scale' in value && 'value' in value) {
    return Number(value.value) / Math.pow(10, value.scale);
  }
  if (value && typeof value === 'object' && 'micros' in value && Object.keys(value).length === 1) {
    return new Date(Number(value.micros) / 1000).toISOString();
  }
  return value;
});

// ── API Routes ───────────────────────────────────────────────────

// List dealerships
app.get('/api/orgs', async (req, res) => {
  try {
    const rows = await query(
      `SELECT id, name, org_type, brand_profile, website, phone, address
       FROM organizations WHERE org_type = 'dealership' ORDER BY name`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Org detail + brand profile
app.get('/api/orgs/:id', async (req, res) => {
  try {
    const rows = await query(
      `SELECT * FROM organizations WHERE id = '${req.params.id}'`
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Not found' });

    const org = rows[0];
    let brand = null;
    try {
      const profilesDir = join(__dirname, 'config', 'brand-profiles');
      const files = readdirSync(profilesDir);
      for (const file of files) {
        const raw = readFileSync(join(profilesDir, file), 'utf-8');
        const profile = JSON.parse(raw);
        if (profile.org_id === req.params.id) { brand = profile; break; }
      }
    } catch { /* brand profile not found — ok */ }

    res.json({ ...org, brand });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Vehicles with latest equity analysis
app.get('/api/orgs/:id/assets', async (req, res) => {
  try {
    const rows = await query(
      `SELECT a.*,
              c.first_name, c.last_name, c.email,
              ea.id AS analysis_id, ea.market_value, ea.payoff_amount,
              ea.equity_amount, ea.equity_type, ea.created_at AS analysis_date,
              ds.id AS deal_sheet_id, ds.status AS deal_sheet_status
       FROM assets a
       JOIN contact_org_links col ON a.contact_id = col.contact_id
       LEFT JOIN contacts c ON a.contact_id = c.id
       LEFT JOIN equity_analyses ea ON ea.asset_id = a.id
         AND ea.created_at = (
           SELECT MAX(ea2.created_at) FROM equity_analyses ea2 WHERE ea2.asset_id = a.id
         )
       LEFT JOIN deal_sheets ds ON ds.asset_id = a.id
         AND ds.created_at = (
           SELECT MAX(ds2.created_at) FROM deal_sheets ds2 WHERE ds2.asset_id = a.id
         )
       WHERE col.organization_id = '${req.params.id}' AND a.asset_type = 'vehicle'
       ORDER BY a.year DESC, a.make, a.model`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Equity pipeline stages with record counts
app.get('/api/orgs/:id/pipeline', async (req, res) => {
  try {
    const rows = await query(
      `SELECT ps.id, ps.stage_name, ps.stage_order, ps.description,
              COUNT(pr.id) AS record_count
       FROM pipeline_stages ps
       LEFT JOIN pipeline_records pr ON pr.pipeline_stage_id = ps.id
         AND pr.asset_id IN (
           SELECT a.id FROM assets a
           JOIN contact_org_links col ON a.contact_id = col.contact_id
           WHERE col.organization_id = '${req.params.id}'
         )
       WHERE ps.pipeline_name = 'equity'
       GROUP BY ps.id, ps.stage_name, ps.stage_order, ps.description
       ORDER BY ps.stage_order`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Pipeline stage records (drill-down)
app.get('/api/orgs/:id/pipeline/:stageId/records', async (req, res) => {
  try {
    const { stageId } = req.params;
    if (!/^ps-eq-\d{2}$/.test(stageId)) {
      return res.status(400).json({ error: 'Invalid stageId format' });
    }
    const rows = await query(
      `SELECT pr.id AS record_id, pr.entered_stage_at, pr.pipeline_stage_id,
              c.id AS contact_id, c.first_name, c.last_name, c.email, c.phone,
              a.id AS asset_id, a.year, a.make, a.model, a.trim, a.vin, a.mileage,
              ea.market_value, ea.payoff_amount, ea.equity_amount, ea.equity_type,
              ds.id AS deal_sheet_id, ds.status AS deal_sheet_status,
              ds.presented_at, ds.presented_by, ds.viewed_at,
              cot.token, cot.status AS token_status,
              cot.first_accessed_at, cot.access_count, cot.expires_at
       FROM pipeline_records pr
       JOIN assets a ON a.id = pr.asset_id
       JOIN contacts c ON c.id = a.contact_id
       JOIN contact_org_links col ON col.contact_id = c.id
       LEFT JOIN equity_analyses ea ON ea.asset_id = a.id
         AND ea.created_at = (
           SELECT MAX(ea2.created_at) FROM equity_analyses ea2 WHERE ea2.asset_id = a.id
         )
       LEFT JOIN deal_sheets ds ON ds.asset_id = a.id
         AND ds.created_at = (
           SELECT MAX(ds2.created_at) FROM deal_sheets ds2 WHERE ds2.asset_id = a.id
         )
       LEFT JOIN client_offer_tokens cot ON cot.deal_sheet_id = ds.id
         AND cot.created_at = (
           SELECT MAX(cot2.created_at) FROM client_offer_tokens cot2 WHERE cot2.deal_sheet_id = ds.id
         )
       WHERE pr.pipeline_stage_id = '${stageId}'
         AND col.organization_id = '${req.params.id}'
       ORDER BY pr.entered_stage_at DESC`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Pipeline value (expected conversions & gross)
app.get('/api/orgs/:id/pipeline-value', async (req, res) => {
  try {
    const rows = await query(
      `SELECT ps.id, ps.stage_name, ps.stage_order,
              COUNT(pr.id) AS record_count,
              COALESCE(SUM(ea.equity_amount), 0) AS total_equity,
              COALESCE(AVG(ea.equity_amount), 0) AS avg_equity
       FROM pipeline_stages ps
       LEFT JOIN pipeline_records pr ON pr.pipeline_stage_id = ps.id
         AND pr.asset_id IN (
           SELECT a.id FROM assets a
           JOIN contact_org_links col ON a.contact_id = col.contact_id
           WHERE col.organization_id = '${req.params.id}'
         )
       LEFT JOIN equity_analyses ea ON ea.asset_id = pr.asset_id
         AND ea.created_at = (
           SELECT MAX(ea2.created_at) FROM equity_analyses ea2 WHERE ea2.asset_id = pr.asset_id
         )
       WHERE ps.pipeline_name = 'equity'
       GROUP BY ps.id, ps.stage_name, ps.stage_order
       ORDER BY ps.stage_order`
    );

    const conversionRates = {
      identified: 0.03,
      data_enriched: 0.05,
      valuation_complete: 0.08,
      equity_calculated: 0.12,
      offer_generated: 0.20,
      offer_sent: 0.30,
      offer_opened: 0.45,
      customer_responded: 0.65,
      appointment_set: 0.85,
      converted: 1.00,
    };
    const avgGrossPerDeal = 1500;

    let totalPipelineEquity = 0;
    let totalExpectedDeals = 0;
    let totalExpectedGross = 0;

    const byStage = rows.map((r) => {
      const count = Number(r.record_count);
      const equity = Number(r.total_equity);
      const rate = conversionRates[r.stage_name] || 0;
      const expectedDeals = count * rate;
      const expectedGross = expectedDeals * avgGrossPerDeal;
      totalPipelineEquity += equity;
      totalExpectedDeals += expectedDeals;
      totalExpectedGross += expectedGross;
      return {
        id: r.id,
        stageName: r.stage_name,
        stageOrder: r.stage_order,
        recordCount: count,
        totalEquity: equity,
        conversionRate: rate,
        expectedDeals: Math.round(expectedDeals * 100) / 100,
        expectedGross: Math.round(expectedGross),
      };
    });

    res.json({
      totalPipelineEquity: Math.round(totalPipelineEquity),
      totalExpectedDeals: Math.round(totalExpectedDeals * 100) / 100,
      totalExpectedGross: Math.round(totalExpectedGross),
      averageGrossPerDeal: avgGrossPerDeal,
      byStage,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Equity summary stats
app.get('/api/orgs/:id/equity-summary', async (req, res) => {
  try {
    const rows = await query(
      `SELECT
         COUNT(*) AS total,
         COUNT(CASE WHEN ea.equity_type = 'positive' THEN 1 END) AS positive_count,
         COUNT(CASE WHEN ea.equity_type = 'negative' THEN 1 END) AS negative_count,
         COUNT(CASE WHEN ea.equity_type = 'breakeven' THEN 1 END) AS breakeven_count,
         COALESCE(SUM(ea.equity_amount), 0) AS total_equity,
         COALESCE(AVG(ea.equity_amount), 0) AS avg_equity
       FROM equity_analyses ea
       JOIN assets a ON ea.asset_id = a.id
       JOIN contact_org_links col ON a.contact_id = col.contact_id
       WHERE col.organization_id = '${req.params.id}'`
    );
    const summary = rows[0] || { total: 0, positive_count: 0, negative_count: 0, breakeven_count: 0, total_equity: 0, avg_equity: 0 };
    res.json(summary);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Batch analyze
app.post('/api/orgs/:id/batch-analyze', async (req, res) => {
  try {
    const result = await batchAnalyze(req.params.id);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Mock valuation for a vehicle
app.get('/api/assets/:id/valuation', async (req, res) => {
  try {
    const rows = await query(
      `SELECT vin, mileage FROM assets WHERE id = '${req.params.id}'`
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Asset not found' });
    const { vin, mileage } = rows[0];
    const valuation = await getValuation(vin, mileage);
    res.json(valuation);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Offer preview
app.post('/api/offers/preview', async (req, res) => {
  try {
    const { analysisId } = req.body;
    if (!analysisId) return res.status(400).json({ error: 'analysisId required' });
    const result = await previewOffer(analysisId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Deal Sheet Routes ────────────────────────────────────────────

// Generate deal sheet from equity analysis
app.post('/api/deal-sheets', async (req, res) => {
  try {
    const { analysisId } = req.body;
    if (!analysisId) return res.status(400).json({ error: 'analysisId required' });
    const result = await generateDealSheet(analysisId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Retrieve deal sheet (marks as viewed)
app.get('/api/deal-sheets/:id', async (req, res) => {
  try {
    const result = await getDealSheet(req.params.id);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// List deal sheets for org
app.get('/api/orgs/:id/deal-sheets', async (req, res) => {
  try {
    const rows = await query(
      `SELECT ds.*, c.first_name, c.last_name, a.year, a.make, a.model
       FROM deal_sheets ds
       JOIN contacts c ON c.id = ds.contact_id
       JOIN assets a ON a.id = ds.asset_id
       WHERE ds.organization_id = '${req.params.id}'
       ORDER BY ds.created_at DESC`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Mark deal sheet as presented
app.post('/api/deal-sheets/:id/present', async (req, res) => {
  try {
    const { presentedById } = req.body || {};
    const result = await markPresented(req.params.id, presentedById);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Generate client offer (gated on presented)
app.post('/api/deal-sheets/:id/client-offer', async (req, res) => {
  try {
    const result = await generateClientOffer(req.params.id);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Public: serve client offer HTML page
app.get('/offer/:token', async (req, res) => {
  try {
    const result = await getClientOfferByToken(req.params.token);
    if (result.expired || !result.html) {
      return res.status(410).send('<html><body><h1>This offer has expired</h1><p>Please contact the dealership for current offers.</p></body></html>');
    }
    res.type('html').send(result.html);
  } catch (err) {
    res.status(404).send('<html><body><h1>Offer not found</h1><p>This link may be invalid. Please contact the dealership.</p></body></html>');
  }
});

// ── Start ────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`Trade Up server running on http://localhost:${PORT}`);
});
