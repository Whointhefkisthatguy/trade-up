/**
 * SMS Delivery Service
 *
 * Sends text messages through the configured SMS provider (e.g.
 * Twilio). Supports plain-text trade-up offer notifications and
 * short-link generation for mobile-friendly offer pages.
 */

/**
 * Send a raw SMS message.
 *
 * @param {string} to   - Recipient phone number in E.164 format.
 * @param {string} body - Message body text.
 * @returns {Promise<{messageId: string, status: string}>} Delivery receipt.
 */
export async function sendSms(to, body) {
  throw new Error('Not implemented');
}

/**
 * Send a trade-up offer notification via SMS for the given offer.
 *
 * @param {string} offerId - Internal offer identifier.
 * @returns {Promise<{messageId: string, status: string}>} Delivery receipt.
 */
export async function sendTradeOfferSms(offerId) {
  throw new Error('Not implemented');
}
