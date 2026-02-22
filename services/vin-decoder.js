/**
 * VIN Decoder Service
 *
 * Decodes Vehicle Identification Numbers into structured vehicle data
 * via the free NHTSA vPIC API (130+ fields). Provides enrichment and
 * database integration for the equity pipeline.
 */

import { DecodeVinValues } from '@shaggytools/nhtsa-api-wrapper';
import { query, run } from './db.js';

const VIN_REGEX = /^[A-HJ-NPR-Z0-9]{17}$/i;

/**
 * Validate a VIN string format.
 * @param {string} vin
 * @throws {Error} if invalid
 */
function validateVin(vin) {
  if (typeof vin !== 'string') {
    throw new Error('VIN must be a string');
  }
  if (vin.length !== 17) {
    throw new Error(`VIN must be exactly 17 characters, got ${vin.length}`);
  }
  if (!VIN_REGEX.test(vin)) {
    throw new Error('VIN contains invalid characters (letters I, O, Q are not allowed)');
  }
}

/**
 * Clean a value from the NHTSA response: trim whitespace, convert empty
 * strings to null.
 * @param {string|null|undefined} val
 * @returns {string|null}
 */
function clean(val) {
  if (val == null) return null;
  const trimmed = String(val).trim();
  return trimmed === '' ? null : trimmed;
}

/**
 * Parse a string into an integer, returning null if not a valid number.
 * @param {string|null|undefined} val
 * @returns {number|null}
 */
function toInt(val) {
  const cleaned = clean(val);
  if (cleaned == null) return null;
  const n = parseInt(cleaned, 10);
  return Number.isNaN(n) ? null : n;
}

/**
 * Parse a string into a float, returning null if not a valid number.
 * @param {string|null|undefined} val
 * @returns {number|null}
 */
function toFloat(val) {
  const cleaned = clean(val);
  if (cleaned == null) return null;
  const n = parseFloat(cleaned);
  return Number.isNaN(n) ? null : n;
}

/**
 * Decode a VIN into structured vehicle information via the NHTSA vPIC API.
 *
 * @param {string} vin - 17-character Vehicle Identification Number.
 * @returns {Promise<{vin: string, year: number|null, make: string|null, model: string|null, trim: string|null, bodyClass: string|null, driveType: string|null, engineCylinders: number|null, displacementL: number|null, fuelType: string|null, transmission: string|null, doors: number|null, plantCountry: string|null, vehicleType: string|null, raw: object}>}
 * @throws {Error} On invalid VIN format or NHTSA error codes.
 */
export async function decodeVin(vin) {
  validateVin(vin);

  const { Results } = await DecodeVinValues(vin);
  const r = Results[0];

  // NHTSA error codes: "0" = success, "1" = check digit error (common with
  // synthetic VINs), "5" = errors in positions, "14" = partial info. The API
  // still returns decoded data for these — only throw when no usable data
  // comes back (i.e. make and model are both empty).
  const errorCode = clean(r.ErrorCode);
  const codes = errorCode ? errorCode.split(',').map(c => c.trim()) : [];
  const hasData = clean(r.Make) || clean(r.Model);

  if (!hasData && codes.length > 0 && !codes.includes('0')) {
    throw new Error(`NHTSA decode error (code ${errorCode}): ${clean(r.ErrorText) || 'Unknown error'}`);
  }

  return {
    vin: vin.toUpperCase(),
    year: toInt(r.ModelYear),
    make: clean(r.Make),
    model: clean(r.Model),
    trim: clean(r.Trim),
    bodyClass: clean(r.BodyClass),
    driveType: clean(r.DriveType),
    engineCylinders: toInt(r.EngineCylinders),
    displacementL: toFloat(r.DisplacementL),
    fuelType: clean(r.FuelTypePrimary),
    transmission: clean(r.TransmissionStyle),
    doors: toInt(r.Doors),
    plantCountry: clean(r.PlantCountry),
    vehicleType: clean(r.VehicleType),
    raw: r,
  };
}

/**
 * Enrich an existing vehicle record with VIN-decoded data.
 * Existing non-null values in `existingData` are preserved.
 *
 * @param {string} vin  - 17-character Vehicle Identification Number.
 * @param {object} existingData - Existing partial vehicle data to merge into.
 * @returns {Promise<object>} The enriched vehicle record.
 */
export async function enrichVinData(vin, existingData = {}) {
  const decoded = await decodeVin(vin);

  const merged = { ...existingData };

  // Only fill in fields that are null/undefined in existing data
  for (const key of Object.keys(decoded)) {
    if (key === 'raw') continue;
    if (merged[key] == null && decoded[key] != null) {
      merged[key] = decoded[key];
    }
  }

  // Always attach full NHTSA response for downstream consumers
  merged.nhtsaData = decoded.raw;

  return merged;
}

/**
 * Decode a VIN and update the corresponding asset record in the database.
 *
 * @param {string} assetId - The asset ID to look up and update.
 * @returns {Promise<object>} The updated asset record.
 * @throws {Error} If asset not found or VIN is missing.
 */
export async function updateAssetFromVin(assetId) {
  const rows = await query(
    `SELECT * FROM assets WHERE id = '${assetId.replace(/'/g, "''")}'`
  );

  if (rows.length === 0) {
    throw new Error(`Asset not found: ${assetId}`);
  }

  const asset = rows[0];

  if (!asset.vin) {
    throw new Error(`Asset ${assetId} has no VIN`);
  }

  const decoded = await decodeVin(asset.vin);

  const vehicleData = JSON.stringify({
    ...JSON.parse(asset.vehicle_data || '{}'),
    nhtsa: decoded.raw,
    decodedAt: new Date().toISOString(),
  });

  const escapedData = vehicleData.replace(/'/g, "''");

  await run(`
    UPDATE assets SET
      year = ${decoded.year ?? 'NULL'},
      make = ${decoded.make ? `'${decoded.make.replace(/'/g, "''")}'` : 'NULL'},
      model = ${decoded.model ? `'${decoded.model.replace(/'/g, "''")}'` : 'NULL'},
      trim = ${decoded.trim ? `'${decoded.trim.replace(/'/g, "''")}'` : 'NULL'},
      vehicle_data = '${escapedData}',
      updated_at = current_timestamp
    WHERE id = '${assetId.replace(/'/g, "''")}'
  `);

  const updated = await query(
    `SELECT * FROM assets WHERE id = '${assetId.replace(/'/g, "''")}'`
  );

  return updated[0];
}
