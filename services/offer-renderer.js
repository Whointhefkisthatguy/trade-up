/**
 * Offer Renderer Service
 *
 * Renders personalised trade-up offer content (HTML emails, landing
 * pages, PDF letters) by merging equity analysis data with branded
 * dealer templates.
 */

/**
 * Render an offer from a named template and a data context.
 *
 * @param {string} template - Template identifier or path.
 * @param {object} data     - Merge-field data (contact, vehicle, equity, etc.).
 * @returns {Promise<{html: string, text: string}>} Rendered output in HTML and plain-text.
 */
export async function renderOffer(template, data) {
  throw new Error('Not implemented');
}

/**
 * Generate a preview of an offer for internal review before sending.
 *
 * @param {string} equityAnalysisId - Identifier of the equity analysis record.
 * @returns {Promise<{html: string, subject: string}>} Preview content.
 */
export async function previewOffer(equityAnalysisId) {
  throw new Error('Not implemented');
}
