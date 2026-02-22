/**
 * DMS Mapper Service
 *
 * Normalises records from various Dealer Management Systems (CDK,
 * Reynolds, Dealertrack, etc.) into a canonical internal schema.
 * Each mapper function handles field translation, type coercion,
 * and default values.
 */

/**
 * Map a raw DMS contact record to the internal contact schema.
 *
 * @param {object} record  - Raw contact record from the DMS.
 * @param {string} dmsType - DMS provider identifier (e.g. "cdk", "reynolds").
 * @returns {Promise<object>} Normalised contact object.
 */
export async function mapContact(record, dmsType) {
  throw new Error('Not implemented');
}

/**
 * Map a raw DMS vehicle record to the internal vehicle schema.
 *
 * @param {object} record  - Raw vehicle record from the DMS.
 * @param {string} dmsType - DMS provider identifier (e.g. "cdk", "reynolds").
 * @returns {Promise<object>} Normalised vehicle object.
 */
export async function mapVehicle(record, dmsType) {
  throw new Error('Not implemented');
}
