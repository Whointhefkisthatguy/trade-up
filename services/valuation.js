/**
 * Valuation Service
 *
 * Provider-pattern dispatcher that delegates vehicle valuation lookups
 * to one or more pricing providers. Currently defaults to the mock
 * provider; real providers can be swapped in by uncommenting below.
 */

import * as mockProvider from './valuation-mock.js';
// import * as kbbProvider from './kbb-provider.js';
// import * as nadaProvider from './nada-provider.js';
// import * as blackbookProvider from './blackbook-provider.js';

const defaultProvider = mockProvider;

/**
 * Get a valuation estimate from the primary pricing source.
 *
 * @param {string} vin     - 17-character Vehicle Identification Number.
 * @param {number} mileage - Current odometer reading in miles.
 * @returns {Promise<{source: string, wholesale: number, retail: number, tradeIn: number}>}
 */
export async function getValuation(vin, mileage) {
  return defaultProvider.getValuation(vin, mileage);
}

/**
 * Aggregate valuations from multiple pricing sources and return a
 * composite estimate with individual breakdowns.
 *
 * When only one provider is configured the call delegates directly
 * to that provider's multi-source method. When multiple providers
 * are available it calls each one and averages the results.
 *
 * @param {string} vin     - 17-character Vehicle Identification Number.
 * @param {number} mileage - Current odometer reading in miles.
 * @returns {Promise<{composite: {wholesale: number, retail: number, tradeIn: number}, sources: Array<object>}>}
 */
export async function getMultiSourceValuation(vin, mileage) {
  // Single provider — delegate directly
  return defaultProvider.getMultiSourceValuation(vin, mileage);
}
