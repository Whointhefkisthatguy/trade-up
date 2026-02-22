import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { renderOffer, previewOffer } from '../services/offer-renderer.js';
import { run, query } from '../services/db.js';

const TEST_ANALYSIS_ID = 'test-ea-offer-001';

describe('offer-renderer', () => {
  before(async () => {
    await run(
      `INSERT INTO equity_analyses (id, asset_id, contact_id, market_value, payoff_amount, equity_amount, equity_type, valuation_source, analysis_data)
       VALUES ('${TEST_ANALYSIS_ID}', 'ast-01', 'ct-cust-01', 25000, 18000, 7000, 'positive', 'mock', '{}')`
    );
  });

  after(async () => {
    await run(`DELETE FROM equity_analyses WHERE id = '${TEST_ANALYSIS_ID}'`);
  });

  describe('renderOffer', () => {
    const baseData = {
      firstName: 'Alex',
      lastName: 'Johnson',
      year: 2020,
      make: 'Ford',
      model: 'Mustang',
      trim: 'GT Premium',
      brandPrimaryColor: '#003478',
      brandSecondaryColor: '#FFFFFF',
      dealershipName: 'Summit Ford',
      dealershipLogo: 'https://summitford.com/assets/logo.png',
      dealershipPhone: '(555) 100-1000',
      dealershipWebsite: 'https://summitford.com',
    };

    it('should render a positive-equity template with data', async () => {
      const data = {
        ...baseData,
        equityAmount: '$7,000',
        offerAmount: '$25,000',
        monthlySavings: '$117',
      };
      const { html, text } = await renderOffer('positive-equity', data);
      assert.ok(html.includes('Alex'), 'HTML should contain first name');
      assert.ok(html.includes('$7,000'), 'HTML should contain equity amount');
      assert.ok(html.includes('Mustang'), 'HTML should contain model');
      assert.ok(html.includes('Great News'), 'HTML should contain template heading');
      assert.ok(text.length > 0, 'Text version should not be empty');
    });

    it('should render a near-breakeven template', async () => {
      const data = {
        ...baseData,
        marketValue: '$20,000',
        payoffAmount: '$20,500',
      };
      const { html } = await renderOffer('near-breakeven', data);
      assert.ok(html.includes('$20,000'), 'HTML should contain market value');
      assert.ok(html.includes('$20,500'), 'HTML should contain payoff amount');
      assert.ok(html.includes('Time for an Upgrade'), 'HTML should contain breakeven heading');
    });

    it('should render a lease-end template', async () => {
      const data = {
        ...baseData,
        leaseEndDate: 'March 15, 2026',
        purchaseOption: '$18,500',
      };
      const { html } = await renderOffer('lease-end', data);
      assert.ok(html.includes('March 15, 2026'), 'HTML should contain lease end date');
      assert.ok(html.includes('Lease Is Ending'), 'HTML should contain lease heading');
    });

    it('should render a service-triggered template', async () => {
      const data = {
        ...baseData,
        serviceDate: 'February 28, 2026',
      };
      const { html } = await renderOffer('service-triggered', data);
      assert.ok(html.includes('February 28, 2026'), 'HTML should contain service date');
      assert.ok(html.includes('Service Visit'), 'HTML should contain service heading');
    });

    it('should inject dealership brand profile into template', async () => {
      const data = {
        ...baseData,
        equityAmount: '$7,000',
        offerAmount: '$25,000',
        monthlySavings: '$117',
      };
      const { html } = await renderOffer('positive-equity', data);
      assert.ok(html.includes('#003478'), 'HTML should contain Summit Ford primary color');
      assert.ok(html.includes('Summit Ford'), 'HTML should contain dealership name');
      assert.ok(html.includes('summitford.com'), 'HTML should contain dealership website');
    });
  });

  describe('previewOffer', () => {
    it('should generate a preview from an equity analysis ID', async () => {
      const { html, subject } = await previewOffer(TEST_ANALYSIS_ID);
      assert.ok(html.includes('Alex'), 'HTML should contain contact first name');
      assert.ok(html.includes('Mustang'), 'HTML should contain vehicle model');
      assert.ok(html.includes('#003478'), 'HTML should contain brand primary color');
      assert.ok(subject.includes('2020'), 'Subject should contain year');
      assert.ok(subject.toLowerCase().includes('ford'), 'Subject should contain make');
      assert.ok(subject.toLowerCase().includes('mustang'), 'Subject should contain model');
    });
  });
});
