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
