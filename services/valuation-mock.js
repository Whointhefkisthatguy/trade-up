/**
 * Valuation Mock Service
 *
 * Drop-in replacement for the real Valuation Service that returns
 * deterministic, fake data. Used during development, testing, and
 * demo environments where live pricing APIs are unavailable.
 */

/**
 * Return a mock valuation for the given vehicle.
 *
 * @param {string} vin     - 17-character Vehicle Identification Number.
 * @param {number} mileage - Current odometer reading in miles.
 * @returns {Promise<{source: string, wholesale: number, retail: number, tradeIn: number}>}
 */
export async function getValuation(vin, mileage) {
  throw new Error('Not implemented');
}

/**
 * Return mock multi-source valuations for the given vehicle.
 *
 * @param {string} vin     - 17-character Vehicle Identification Number.
 * @param {number} mileage - Current odometer reading in miles.
 * @returns {Promise<{composite: {wholesale: number, retail: number, tradeIn: number}, sources: Array<object>}>}
 */
export async function getMultiSourceValuation(vin, mileage) {
  throw new Error('Not implemented');
}
