/**
 * Valuation Service
 *
 * Provides vehicle valuation lookups against live data sources
 * (e.g. Black Book, Kelley Blue Book, NADA). Supports single-source
 * and multi-source composite valuations.
 */

/**
 * Get a valuation estimate from the primary pricing source.
 *
 * @param {string} vin     - 17-character Vehicle Identification Number.
 * @param {number} mileage - Current odometer reading in miles.
 * @returns {Promise<{source: string, wholesale: number, retail: number, tradeIn: number}>}
 */
export async function getValuation(vin, mileage) {
  throw new Error('Not implemented');
}

/**
 * Aggregate valuations from multiple pricing sources and return a
 * composite estimate with individual breakdowns.
 *
 * @param {string} vin     - 17-character Vehicle Identification Number.
 * @param {number} mileage - Current odometer reading in miles.
 * @returns {Promise<{composite: {wholesale: number, retail: number, tradeIn: number}, sources: Array<object>}>}
 */
export async function getMultiSourceValuation(vin, mileage) {
  throw new Error('Not implemented');
}
