/**
 * Offer Renderer Service
 *
 * Renders personalised trade-up offer content (HTML emails, landing
 * pages, PDF letters) by merging equity analysis data with branded
 * dealer templates.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import Handlebars from 'handlebars';
import { query } from './db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = join(__dirname, '..', 'templates', 'trade-offers');
const BRAND_PROFILES_DIR = join(__dirname, '..', 'config', 'brand-profiles');

const templateCache = new Map();

// ── Internal helpers ─────────────────────────────────────────────

function getTemplate(name) {
  if (templateCache.has(name)) return templateCache.get(name);
  const source = readFileSync(join(TEMPLATES_DIR, `${name}.hbs`), 'utf-8');
  const compiled = Handlebars.compile(source);
  templateCache.set(name, compiled);
  return compiled;
}

export function loadBrandProfile(orgId) {
  const files = readdirSync(BRAND_PROFILES_DIR);
  for (const file of files) {
    const raw = readFileSync(join(BRAND_PROFILES_DIR, file), 'utf-8');
    const profile = JSON.parse(raw);
    if (profile.org_id === orgId) return profile;
  }
  return null;
}

function templateForEquityType(type) {
  switch (type) {
    case 'positive': return 'positive-equity';
    case 'breakeven': return 'near-breakeven';
    case 'negative': return 'near-breakeven';
    default: return 'positive-equity';
  }
}

export function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

// ── Exports ──────────────────────────────────────────────────────

/**
 * Render an offer from a named template and a data context.
 *
 * @param {string} templateName - Template identifier (e.g. 'positive-equity').
 * @param {object} data - Merge-field data (contact, vehicle, equity, brand, etc.).
 * @returns {Promise<{html: string, text: string}>} Rendered output in HTML and plain-text.
 */
export async function renderOffer(templateName, data) {
  const template = getTemplate(templateName);
  const html = template(data);
  const text = html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  return { html, text };
}

/**
 * Generate a preview of an offer for internal review before sending.
 *
 * @param {string} equityAnalysisId - Identifier of the equity analysis record.
 * @returns {Promise<{html: string, subject: string}>} Preview content.
 */
export async function previewOffer(equityAnalysisId) {
  const rows = await query(
    `SELECT ea.*, a.vin, a.year, a.make, a.model, a.trim, a.mileage, a.organization_id,
            c.first_name, c.last_name, c.email,
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
  const brand = loadBrandProfile(row.organization_id);

  const templateName = templateForEquityType(row.equity_type);

  const data = {
    firstName: row.first_name,
    lastName: row.last_name,
    year: row.year,
    make: row.make,
    model: row.model,
    trim: row.trim || '',
    equityAmount: formatCurrency(Math.abs(Number(row.equity_amount))),
    marketValue: formatCurrency(Number(row.market_value)),
    payoffAmount: formatCurrency(Number(row.payoff_amount)),
    offerAmount: formatCurrency(Number(row.market_value)),
    monthlySavings: formatCurrency(Math.round(Math.abs(Number(row.equity_amount)) / 60)),
    brandPrimaryColor: brand?.colors?.primary || '#333333',
    brandSecondaryColor: brand?.colors?.secondary || '#555555',
    dealershipName: brand?.name || row.org_name || 'Dealership',
    dealershipLogo: brand?.logo_url || '',
    dealershipPhone: row.org_phone || '',
    dealershipWebsite: row.org_website || '',
  };

  const template = getTemplate(templateName);
  const html = template(data);
  const subject = `Great news about your ${row.year} ${row.make} ${row.model}`;

  return { html, subject };
}
