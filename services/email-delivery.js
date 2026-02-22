/**
 * Email Delivery Service
 *
 * Sends transactional and marketing emails through the configured
 * email provider (e.g. SendGrid, SES). Handles trade-up offer
 * delivery with tracking pixels and click-through links.
 */

/**
 * Send a raw email.
 *
 * @param {string} to      - Recipient email address.
 * @param {string} subject - Email subject line.
 * @param {string} html    - Email body as HTML.
 * @returns {Promise<{messageId: string, status: string}>} Delivery receipt.
 */
export async function sendEmail(to, subject, html) {
  throw new Error('Not implemented');
}

/**
 * Send a fully-rendered trade-up offer email for the given offer.
 *
 * @param {string} offerId - Internal offer identifier.
 * @returns {Promise<{messageId: string, status: string}>} Delivery receipt.
 */
export async function sendTradeOffer(offerId) {
  throw new Error('Not implemented');
}
