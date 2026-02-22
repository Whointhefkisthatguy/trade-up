import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { generateDealSheet, getDealSheet, markPresented, generateClientOffer, getClientOfferByToken } from '../services/deal-sheet.js';
import { run, query, close } from '../services/db.js';

const TEST_ANALYSIS_ID = 'test-ea-ds-001';

describe('deal-sheet', () => {
  let dealSheetId = null;
  let clientToken = null;

  before(async () => {
    // Insert a test equity analysis for ast-01 / ct-cust-01 (Summit Ford)
    await run(
      `INSERT INTO equity_analyses (id, asset_id, contact_id, market_value, payoff_amount, equity_amount, equity_type, valuation_source, analysis_data)
       VALUES ('${TEST_ANALYSIS_ID}', 'ast-01', 'ct-cust-01', 25000, 18000, 7000, 'positive', 'mock', '{}')`
    );
  });

  after(async () => {
    // Clean up in reverse dependency order
    if (clientToken) {
      await run(`DELETE FROM client_offer_tokens WHERE token = '${clientToken}'`);
    }
    if (dealSheetId) {
      await run(`DELETE FROM deal_sheets WHERE id = '${dealSheetId}'`);
    }
    await run(`DELETE FROM equity_analyses WHERE id = '${TEST_ANALYSIS_ID}'`);
    close();
  });

  it('generateDealSheet returns HTML with vehicle specs, valuation, and customer name', async () => {
    const result = await generateDealSheet(TEST_ANALYSIS_ID);

    assert.ok(result.id, 'Should return a deal sheet ID');
    assert.ok(result.html, 'Should return rendered HTML');
    assert.ok(result.dealSheet, 'Should return deal sheet record');

    // HTML contains key data
    assert.ok(result.html.includes('Alex'), 'HTML should contain customer first name');
    assert.ok(result.html.includes('Mustang') || result.html.includes('Ford'), 'HTML should contain vehicle info');
    assert.ok(result.html.includes('INTERNAL DEAL SHEET'), 'HTML should contain deal sheet header');
    assert.ok(result.html.includes('Valuation Breakdown'), 'HTML should contain valuation section');
    assert.ok(result.html.includes('KBB'), 'HTML should contain valuation source names');

    // Status is generated
    assert.equal(result.dealSheet.status, 'generated');

    dealSheetId = result.id;
  });

  it('getDealSheet marks as viewed on first access', async () => {
    const result = await getDealSheet(dealSheetId);

    assert.ok(result.html, 'Should return HTML');
    assert.equal(result.dealSheet.status, 'viewed', 'Status should transition to viewed');
  });

  it('markPresented transitions to presented status', async () => {
    const result = await markPresented(dealSheetId);

    assert.equal(result.status, 'presented');
    assert.equal(result.dealSheet.status, 'presented');
  });

  it('generateClientOffer rejects if not yet presented', async () => {
    // Create a second deal sheet that hasn't been presented
    const result2 = await generateDealSheet(TEST_ANALYSIS_ID);
    const unpresentedId = result2.id;

    await assert.rejects(
      () => generateClientOffer(unpresentedId),
      { message: 'Deal sheet must be presented before generating client offer' }
    );

    // Clean up
    await run(`DELETE FROM deal_sheets WHERE id = '${unpresentedId}'`);
  });

  it('generateClientOffer after presentation returns token, URL, and HTML', async () => {
    const result = await generateClientOffer(dealSheetId);

    assert.ok(result.token, 'Should return a token');
    assert.ok(result.url, 'Should return a URL');
    assert.ok(result.url.includes('/offer/'), 'URL should contain /offer/ path');
    assert.ok(result.html, 'Should return HTML');
    assert.ok(result.html.includes('Schedule a Test Drive'), 'HTML should contain CTA');

    clientToken = result.token;
  });

  it('getClientOfferByToken returns HTML and tracks access', async () => {
    // First access
    const result1 = await getClientOfferByToken(clientToken);
    assert.ok(result1.html, 'Should return HTML');
    assert.equal(result1.expired, false, 'Should not be expired');

    // Verify access count
    const rows = await query(`SELECT access_count, first_accessed_at FROM client_offer_tokens WHERE token = '${clientToken}'`);
    assert.equal(Number(rows[0].access_count), 1, 'Access count should be 1');
    assert.ok(rows[0].first_accessed_at, 'first_accessed_at should be set');

    // Second access
    const result2 = await getClientOfferByToken(clientToken);
    assert.ok(result2.html, 'Should return HTML on second access');

    const rows2 = await query(`SELECT access_count FROM client_offer_tokens WHERE token = '${clientToken}'`);
    assert.equal(Number(rows2[0].access_count), 2, 'Access count should be 2');
  });
});
