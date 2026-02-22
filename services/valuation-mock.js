/**
 * Valuation Mock Service
 *
 * Drop-in replacement for the real Valuation Service that returns
 * deterministic, fake data. Used during development, testing, and
 * demo environments where live pricing APIs are unavailable.
 *
 * Values are derived purely from the VIN string + mileage — no
 * external API calls and no dependency on vin-decoder.
 */

// ── VIN position-10 model year lookup (standard VIN spec) ────────

const YEAR_CODES = {
  'A': 2010, 'B': 2011, 'C': 2012, 'D': 2013, 'E': 2014,
  'F': 2015, 'G': 2016, 'H': 2017, 'J': 2018, 'K': 2019,
  'L': 2020, 'M': 2021, 'N': 2022, 'P': 2023, 'R': 2024,
  'S': 2025, 'T': 2026, 'V': 2027, 'W': 2028, 'X': 2029,
  'Y': 2030,
  '1': 2031, '2': 2032, '3': 2033, '4': 2034, '5': 2035,
  '6': 2036, '7': 2037, '8': 2038, '9': 2039,
};

// ── Internal helpers ─────────────────────────────────────────────

/**
 * Deterministic hash of a VIN string (DJB2 variant).
 * Always returns a non-negative integer.
 */
function vinHash(vin) {
  let hash = 0;
  for (let i = 0; i < vin.length; i++) {
    hash = ((hash << 5) - hash + vin.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

/**
 * Extract model year from VIN position 10 (0-indexed: 9).
 */
function getModelYear(vin) {
  const code = vin.charAt(9).toUpperCase();
  return YEAR_CODES[code] || 2020;
}

/**
 * Compute a depreciated base wholesale value from the VIN + mileage.
 *
 * 1. Deterministic base MSRP from VIN hash ($22k–$55k)
 * 2. Depreciation: 15 % year 1, 10 % years 2-5, 7 % years 6+
 * 3. Mileage deduction: ~$800 per 15 k miles
 */
function computeBaseValue(vin, mileage) {
  const hash = vinHash(vin);
  const baseMsrp = 22000 + (hash % 33001); // $22 k – $55 k

  const currentYear = new Date().getFullYear();
  const modelYear = getModelYear(vin);
  const age = Math.max(0, currentYear - modelYear);

  let value = baseMsrp;
  for (let y = 1; y <= age; y++) {
    if (y === 1) value *= 0.85;
    else if (y <= 5) value *= 0.90;
    else value *= 0.93;
  }

  const mileageDeduction = Math.floor(mileage / 15000) * 800;
  value -= mileageDeduction;

  return Math.max(Math.round(value * 100) / 100, 1000);
}

// ── Exports ──────────────────────────────────────────────────────

/**
 * Return a mock valuation for the given vehicle.
 *
 * @param {string} vin     - 17-character Vehicle Identification Number.
 * @param {number} mileage - Current odometer reading in miles.
 * @returns {Promise<{source: string, wholesale: number, retail: number, tradeIn: number}>}
 */
export async function getValuation(vin, mileage) {
  const wholesale = computeBaseValue(vin, mileage);
  const retail    = Math.round(wholesale * 1.18 * 100) / 100;
  const tradeIn   = Math.round(wholesale * 1.06 * 100) / 100;
  return { source: 'kbb_mock', wholesale, retail, tradeIn };
}

/**
 * Return mock multi-source valuations for the given vehicle.
 *
 * Each source applies a small variance factor to the base value:
 *   kbb_mock × 1.00, nada_mock × 1.03, blackbook_mock × 0.97
 *
 * The composite is the average across all sources.
 *
 * @param {string} vin     - 17-character Vehicle Identification Number.
 * @param {number} mileage - Current odometer reading in miles.
 * @returns {Promise<{composite: {wholesale: number, retail: number, tradeIn: number}, sources: Array<object>}>}
 */
export async function getMultiSourceValuation(vin, mileage) {
  const base = computeBaseValue(vin, mileage);

  const factors = [
    { source: 'kbb_mock',       factor: 1.00 },
    { source: 'nada_mock',      factor: 1.03 },
    { source: 'blackbook_mock', factor: 0.97 },
  ];

  const sources = factors.map(({ source, factor }) => {
    const wholesale = Math.round(base * factor * 100) / 100;
    return {
      source,
      wholesale,
      retail:  Math.round(wholesale * 1.18 * 100) / 100,
      tradeIn: Math.round(wholesale * 1.06 * 100) / 100,
    };
  });

  const avg = (arr) => Math.round(arr.reduce((s, v) => s + v, 0) / arr.length * 100) / 100;

  return {
    composite: {
      wholesale: avg(sources.map(s => s.wholesale)),
      retail:    avg(sources.map(s => s.retail)),
      tradeIn:  avg(sources.map(s => s.tradeIn)),
    },
    sources,
  };
}
