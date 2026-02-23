/**
 * Deal Sheet Service
 *
 * Two-phase deal system: generates internal deal sheets for the sales team
 * and gated client-facing offer pages accessed via unique tokens.
 */

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { v4 as uuidv4 } from 'uuid';
import Handlebars from 'handlebars';
import { query, run } from './db.js';
import { loadBrandProfile, formatCurrency } from './offer-renderer.js';
import { decodeVin } from './vin-decoder.js';
import { getMultiSourceValuation } from './valuation.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = join(__dirname, '..', 'templates', 'deal-sheets');

const templateCache = new Map();

// ── Internal helpers ─────────────────────────────────────────────

function getTemplate(name) {
  if (templateCache.has(name)) return templateCache.get(name);
  const source = readFileSync(join(TEMPLATES_DIR, `${name}.hbs`), 'utf-8');
  const compiled = Handlebars.compile(source);
  templateCache.set(name, compiled);
  return compiled;
}

function sourceDisplayName(source) {
  const names = {
    kbb_mock: 'KBB',
    nada_mock: 'NADA',
    blackbook_mock: 'Blackbook',
  };
  return names[source] || source;
}

function buildRecommendation(equityType, equity, row) {
  const name = `${row.first_name} ${row.last_name}`;
  const vehicle = `${row.year} ${row.make} ${row.model}`;
  const absEquity = formatCurrency(Math.abs(Number(equity)));

  if (equityType === 'positive') {
    return `${name} has ${absEquity} in positive equity on their ${vehicle}. This is a strong trade-up candidate.\n\nTalking points:\n- Their vehicle is worth more than they owe — they can apply equity toward a new purchase\n- Current market conditions favor pre-owned vehicles like theirs\n- Highlight monthly payment reduction potential or upgrade options\n- Create urgency: market values fluctuate, now is a great time to act`;
  } else if (equityType === 'breakeven') {
    return `${name} is near breakeven on their ${vehicle}. With the right incentive, this is still a viable opportunity.\n\nTalking points:\n- Their loan is nearly paid down to the vehicle's current value\n- Even a small incentive or rebate could tip the balance\n- Focus on the benefits of a newer vehicle (warranty, features, safety)\n- Present as a low-pressure "no cost to switch" opportunity`;
  } else {
    return `${name} has ${absEquity} in negative equity on their ${vehicle}. Proceed with caution.\n\nTalking points:\n- Negative equity can be rolled into a new loan if the customer is motivated\n- Focus on situations where the customer needs a different vehicle (growing family, commute change)\n- Manufacturer rebates or dealer incentives may offset the gap\n- Only pursue if the customer expresses genuine interest in upgrading`;
  }
}

function buildClientMessage(equityType, equity) {
  const absEquity = formatCurrency(Math.abs(Number(equity)));

  if (equityType === 'positive') {
    return `Great news! Based on our analysis, your vehicle has built up <strong>${absEquity} in equity</strong>. This means your vehicle is worth more than what you owe on it. You could use this equity toward a newer model, lower your monthly payments, or both. Now is an excellent time to take advantage of strong market demand for pre-owned vehicles like yours.`;
  } else if (equityType === 'breakeven') {
    return `Based on current market conditions, your vehicle's value closely matches your remaining balance. This puts you in a great position to upgrade to a newer model with little to no additional cost. We'd love to show you what's possible — stop by for a test drive and let us walk you through your options.`;
  } else {
    return `We've been keeping an eye on market conditions for vehicles like yours. While the market continues to evolve, we have some exciting options that could work well for your situation. We'd love to sit down with you and explore the possibilities — schedule a visit to see what we can do for you.`;
  }
}

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

function escapeSQL(str) {
  if (str == null) return 'NULL';
  return `'${String(str).replace(/'/g, "''")}'`;
}

// ── Exports ──────────────────────────────────────────────────────

/**
 * Generate an internal deal sheet from an equity analysis.
 */
export async function generateDealSheet(equityAnalysisId) {
  // 1. Load equity analysis with related data
  const rows = await query(
    `SELECT ea.*, a.vin, a.year, a.make, a.model, a.trim, a.mileage, a.color,
            a.organization_id, a.id AS asset_id,
            c.first_name, c.last_name, c.email, c.phone,
            o.name AS org_name, o.phone AS org_phone, o.website AS org_website
     FROM equity_analyses ea
     JOIN assets a ON ea.asset_id = a.id
     JOIN contacts c ON ea.contact_id = c.id
     LEFT JOIN organizations o ON a.organization_id = o.id
     WHERE ea.id = '${equityAnalysisId}'`
  );

  if (rows.length === 0) {
    throw new Error(`Equity analysis not found: ${equityAnalysisId}`);
  }

  const row = rows[0];

  // 2. VIN decode for rich specs
  let vinSpecs = {};
  try {
    vinSpecs = await decodeVin(row.vin);
  } catch {
    // If VIN decode fails, use what we have from the asset
    vinSpecs = { vin: row.vin, year: row.year, make: row.make, model: row.model, trim: row.trim };
  }

  // 3. Multi-source valuation
  const valuation = await getMultiSourceValuation(row.vin, row.mileage);

  // 4. Brand profile
  const brand = loadBrandProfile(row.organization_id);

  // 5. Build recommendation
  const equityType = row.equity_type;
  const equity = Number(row.equity_amount);
  const recommendedApproach = buildRecommendation(equityType, equity, row);

  // Build snapshots for storage
  const vehicleSpecs = {
    vin: vinSpecs.vin || row.vin,
    year: vinSpecs.year || row.year,
    make: vinSpecs.make || row.make,
    model: vinSpecs.model || row.model,
    trim: vinSpecs.trim || row.trim,
    bodyClass: vinSpecs.bodyClass || null,
    driveType: vinSpecs.driveType || null,
    engineCylinders: vinSpecs.engineCylinders || null,
    displacementL: vinSpecs.displacementL || null,
    fuelType: vinSpecs.fuelType || null,
    transmission: vinSpecs.transmission || null,
    doors: vinSpecs.doors || null,
    mileage: row.mileage,
    color: row.color,
    plantCountry: vinSpecs.plantCountry || null,
  };

  const valuationBreakdown = valuation;

  const equitySummary = {
    marketValue: Number(row.market_value),
    payoffAmount: Number(row.payoff_amount),
    equityAmount: equity,
    equityType: equityType,
    equityPercent: Math.round((equity / Number(row.market_value)) * 100 * 100) / 100,
  };

  // 6. Render template
  const templateData = {
    // Customer
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email || '—',
    phone: row.phone || '—',
    // Vehicle specs
    year: vehicleSpecs.year,
    make: vehicleSpecs.make,
    model: vehicleSpecs.model,
    trim: vehicleSpecs.trim || '—',
    vin: vehicleSpecs.vin,
    mileage: vehicleSpecs.mileage ? vehicleSpecs.mileage.toLocaleString() + ' mi' : '—',
    bodyClass: vehicleSpecs.bodyClass || '—',
    engineCylinders: vehicleSpecs.engineCylinders || '—',
    displacementL: vehicleSpecs.displacementL || '—',
    fuelType: vehicleSpecs.fuelType || '—',
    driveType: vehicleSpecs.driveType || '—',
    transmission: vehicleSpecs.transmission || '—',
    doors: vehicleSpecs.doors || '—',
    color: vehicleSpecs.color || '—',
    plantCountry: vehicleSpecs.plantCountry || '—',
    // Valuation
    compositeWholesale: formatCurrency(valuation.composite.wholesale),
    compositeRetail: formatCurrency(valuation.composite.retail),
    compositeTradeIn: formatCurrency(valuation.composite.tradeIn),
    valuationSources: valuation.sources.map(s => ({
      sourceName: sourceDisplayName(s.source),
      wholesale: formatCurrency(s.wholesale),
      retail: formatCurrency(s.retail),
      tradeIn: formatCurrency(s.tradeIn),
    })),
    // Equity
    marketValue: formatCurrency(equitySummary.marketValue),
    payoffAmount: formatCurrency(equitySummary.payoffAmount),
    equityAmount: formatCurrency(equity),
    equityType: equityType,
    equityPercent: equitySummary.equityPercent,
    // Recommendation
    recommendedApproach: recommendedApproach,
    // Brand
    brandPrimaryColor: brand?.colors?.primary || '#333333',
    brandSecondaryColor: brand?.colors?.secondary || '#555555',
    dealershipName: brand?.name || row.org_name || 'Dealership',
    dealershipLogo: brand?.logo_url || '',
    // Meta
    generatedDate: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
  };

  const template = getTemplate('internal-deal-sheet');
  const html = template(templateData);

  // 7. Insert deal sheet
  const id = uuidv4();
  const vehicleSpecsJson = JSON.stringify(vehicleSpecs).replace(/'/g, "''");
  const valuationJson = JSON.stringify(valuationBreakdown).replace(/'/g, "''");
  const equitySummaryJson = JSON.stringify(equitySummary).replace(/'/g, "''");
  const escapedHtml = html.replace(/'/g, "''");
  const escapedApproach = recommendedApproach.replace(/'/g, "''");

  await run(
    `INSERT INTO deal_sheets (id, equity_analysis_id, asset_id, contact_id, organization_id, vehicle_specs, valuation_breakdown, equity_summary, recommended_approach, rendered_html, status)
     VALUES ('${id}', '${equityAnalysisId}', '${row.asset_id}', '${row.contact_id}', '${row.organization_id}', '${vehicleSpecsJson}', '${valuationJson}', '${equitySummaryJson}', '${escapedApproach}', '${escapedHtml}', 'generated')`
  );

  const dealSheetRows = await query(`SELECT * FROM deal_sheets WHERE id = '${id}'`);

  return { id, html, dealSheet: dealSheetRows[0] };
}

/**
 * Retrieve a deal sheet and mark as viewed if currently generated.
 */
export async function getDealSheet(dealSheetId) {
  const rows = await query(`SELECT * FROM deal_sheets WHERE id = '${dealSheetId}'`);

  if (rows.length === 0) {
    throw new Error(`Deal sheet not found: ${dealSheetId}`);
  }

  const dealSheet = rows[0];

  // Mark as viewed on first access
  if (dealSheet.status === 'generated') {
    await run(
      `UPDATE deal_sheets SET status = 'viewed', viewed_at = current_timestamp, updated_at = current_timestamp WHERE id = '${dealSheetId}'`
    );
    dealSheet.status = 'viewed';
    dealSheet.viewed_at = new Date().toISOString();
  }

  return { dealSheet, html: dealSheet.rendered_html };
}

/**
 * Mark a deal sheet as presented to the customer by a salesperson.
 */
export async function markPresented(dealSheetId, presentedById) {
  const rows = await query(`SELECT * FROM deal_sheets WHERE id = '${dealSheetId}'`);

  if (rows.length === 0) {
    throw new Error(`Deal sheet not found: ${dealSheetId}`);
  }

  const dealSheet = rows[0];

  const presentedByClause = presentedById ? `, presented_by = '${presentedById}'` : '';

  await run(
    `UPDATE deal_sheets SET status = 'presented', presented_at = current_timestamp${presentedByClause}, updated_at = current_timestamp WHERE id = '${dealSheetId}'`
  );

  // Advance pipeline to offer_generated (from wherever the record currently sits)
  await advancePipeline(dealSheet.asset_id, 'ps-eq-01', 'ps-eq-05');
  await advancePipeline(dealSheet.asset_id, 'ps-eq-02', 'ps-eq-05');
  await advancePipeline(dealSheet.asset_id, 'ps-eq-03', 'ps-eq-05');
  await advancePipeline(dealSheet.asset_id, 'ps-eq-04', 'ps-eq-05');

  dealSheet.status = 'presented';
  return { dealSheet, status: 'presented' };
}

/**
 * Generate a client-facing offer page. Gated on deal sheet being presented.
 */
export async function generateClientOffer(dealSheetId) {
  const rows = await query(`SELECT * FROM deal_sheets WHERE id = '${dealSheetId}'`);

  if (rows.length === 0) {
    throw new Error(`Deal sheet not found: ${dealSheetId}`);
  }

  const dealSheet = rows[0];

  if (dealSheet.status !== 'presented') {
    throw new Error('Deal sheet must be presented before generating client offer');
  }

  // Load fresh contact/asset data + snapshots
  const dataRows = await query(
    `SELECT c.first_name, c.last_name, c.email, c.phone,
            a.year, a.make, a.model, a.trim, a.vin,
            o.name AS org_name, o.phone AS org_phone, o.website AS org_website
     FROM contacts c
     JOIN assets a ON a.id = '${dealSheet.asset_id}'
     JOIN organizations o ON o.id = '${dealSheet.organization_id}'
     WHERE c.id = '${dealSheet.contact_id}'`
  );

  if (dataRows.length === 0) {
    throw new Error('Could not load contact/asset data for client offer');
  }

  const row = dataRows[0];
  const brand = loadBrandProfile(dealSheet.organization_id);
  const equitySummary = JSON.parse(dealSheet.equity_summary);

  const token = uuidv4();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);

  const clientMessage = buildClientMessage(equitySummary.equityType, equitySummary.equityAmount);

  const templateData = {
    firstName: row.first_name,
    lastName: row.last_name,
    year: row.year,
    make: row.make,
    model: row.model,
    marketValue: formatCurrency(equitySummary.marketValue),
    equityAmount: formatCurrency(Math.abs(equitySummary.equityAmount)),
    showEquity: equitySummary.equityType === 'positive',
    clientMessage: clientMessage,
    token: token,
    expiresAt: expiresAt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
    brandPrimaryColor: brand?.colors?.primary || '#333333',
    brandSecondaryColor: brand?.colors?.secondary || '#555555',
    dealershipName: brand?.name || row.org_name || 'Dealership',
    dealershipLogo: brand?.logo_url || '',
    dealershipPhone: row.org_phone || '',
    dealershipWebsite: row.org_website || '',
  };

  const template = getTemplate('client-offer');
  const html = template(templateData);

  // Create token record
  const tokenId = uuidv4();
  await run(
    `INSERT INTO client_offer_tokens (id, deal_sheet_id, token, status, expires_at)
     VALUES ('${tokenId}', '${dealSheetId}', '${token}', 'active', '${expiresAt.toISOString()}')`
  );

  // Update deal sheet status
  await run(
    `UPDATE deal_sheets SET status = 'client_offer_sent', updated_at = current_timestamp WHERE id = '${dealSheetId}'`
  );

  // Advance pipeline to offer_sent (from wherever the record currently sits)
  await advancePipeline(dealSheet.asset_id, 'ps-eq-04', 'ps-eq-06');
  await advancePipeline(dealSheet.asset_id, 'ps-eq-05', 'ps-eq-06');

  return { token, url: `/offer/${token}`, html };
}

/**
 * Look up and render a client offer by its public token.
 */
export async function getClientOfferByToken(token) {
  const tokenRows = await query(
    `SELECT cot.*, ds.* FROM client_offer_tokens cot
     JOIN deal_sheets ds ON ds.id = cot.deal_sheet_id
     WHERE cot.token = '${token}'`
  );

  if (tokenRows.length === 0) {
    throw new Error('Offer not found');
  }

  const record = tokenRows[0];

  // Check if revoked
  // DuckDB returns status from both tables; token status is checked via the token column presence
  const tokenStatusRows = await query(
    `SELECT status, expires_at, access_count, first_accessed_at FROM client_offer_tokens WHERE token = '${token}'`
  );
  const tokenRecord = tokenStatusRows[0];

  if (tokenRecord.status === 'revoked') {
    return { html: null, expired: true };
  }

  // Check expiry
  if (tokenRecord.expires_at && new Date(tokenRecord.expires_at) < new Date()) {
    await run(`UPDATE client_offer_tokens SET status = 'expired' WHERE token = '${token}'`);
    return { html: null, expired: true };
  }

  const isFirstAccess = !tokenRecord.first_accessed_at;

  // Track access
  if (isFirstAccess) {
    await run(
      `UPDATE client_offer_tokens SET first_accessed_at = current_timestamp, last_accessed_at = current_timestamp, access_count = 1 WHERE token = '${token}'`
    );
  } else {
    await run(
      `UPDATE client_offer_tokens SET last_accessed_at = current_timestamp, access_count = ${Number(tokenRecord.access_count) + 1} WHERE token = '${token}'`
    );
  }

  // Re-render client offer from deal sheet snapshots
  const dataRows = await query(
    `SELECT ds.*, c.first_name, c.last_name, c.email, c.phone,
            a.year, a.make, a.model, a.trim, a.vin,
            o.name AS org_name, o.phone AS org_phone, o.website AS org_website
     FROM deal_sheets ds
     JOIN contacts c ON c.id = ds.contact_id
     JOIN assets a ON a.id = ds.asset_id
     JOIN organizations o ON o.id = ds.organization_id
     WHERE ds.id = '${record.deal_sheet_id}'`
  );

  const row = dataRows[0];
  const brand = loadBrandProfile(row.organization_id);
  const equitySummary = JSON.parse(row.equity_summary);

  const clientMessage = buildClientMessage(equitySummary.equityType, equitySummary.equityAmount);

  const templateData = {
    firstName: row.first_name,
    lastName: row.last_name,
    year: row.year,
    make: row.make,
    model: row.model,
    marketValue: formatCurrency(equitySummary.marketValue),
    equityAmount: formatCurrency(Math.abs(equitySummary.equityAmount)),
    showEquity: equitySummary.equityType === 'positive',
    clientMessage: clientMessage,
    token: token,
    expiresAt: new Date(tokenRecord.expires_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
    brandPrimaryColor: brand?.colors?.primary || '#333333',
    brandSecondaryColor: brand?.colors?.secondary || '#555555',
    dealershipName: brand?.name || row.org_name || 'Dealership',
    dealershipLogo: brand?.logo_url || '',
    dealershipPhone: row.org_phone || '',
    dealershipWebsite: row.org_website || '',
  };

  const template = getTemplate('client-offer');
  const html = template(templateData);

  // On first access, advance pipeline: offer_sent → offer_opened
  if (isFirstAccess) {
    await advancePipeline(row.asset_id, 'ps-eq-06', 'ps-eq-07');
  }

  return { html, expired: false };
}
