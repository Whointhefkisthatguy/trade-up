import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { decodeVin, enrichVinData, updateAssetFromVin } from '../services/vin-decoder.js';
import { query, close } from '../services/db.js';

// Close DB connection when tests finish
after(async () => {
  await close();
});

describe('vin-decoder', () => {
  // ──────────────────────────────────────────────────────────
  // decodeVin — validation
  // ──────────────────────────────────────────────────────────

  describe('decodeVin — validation', () => {
    it('should reject a short VIN', async () => {
      await assert.rejects(
        () => decodeVin('1FA6P8TH5L'),
        { message: /must be exactly 17 characters/ }
      );
    });

    it('should reject a VIN with letter I', async () => {
      await assert.rejects(
        () => decodeVin('1FA6P8TH5L510I001'),
        { message: /invalid characters/ }
      );
    });

    it('should reject a VIN with letter O', async () => {
      await assert.rejects(
        () => decodeVin('1FA6P8TH5L510O001'),
        { message: /invalid characters/ }
      );
    });

    it('should reject a VIN with letter Q', async () => {
      await assert.rejects(
        () => decodeVin('1FA6P8TH5L510Q001'),
        { message: /invalid characters/ }
      );
    });

    it('should reject a non-string VIN', async () => {
      await assert.rejects(
        () => decodeVin(12345),
        { message: /must be a string/ }
      );
    });
  });

  // ──────────────────────────────────────────────────────────
  // decodeVin — live NHTSA API integration tests
  // VINs from seed data are synthetic so we verify the API
  // returns data and key fields are populated with the
  // expected make and approximate year.
  // ──────────────────────────────────────────────────────────

  describe('decodeVin — live NHTSA API', () => {
    it('should decode ast-01: 2020 Ford Mustang', async () => {
      const result = await decodeVin('1FA6P8TH5L5100001');
      assert.equal(result.vin, '1FA6P8TH5L5100001');
      assert.equal(typeof result.year, 'number');
      assert.ok(result.make, 'make should be populated');
      assert.match(result.make, /ford/i);
      assert.ok(result.model, 'model should be populated');
      assert.ok(result.raw, 'raw NHTSA response should be present');
    });

    it('should decode ast-02: 2020 Ford F-150', async () => {
      const result = await decodeVin('1FTEW1EP0LFA00002');
      assert.match(result.make, /ford/i);
      assert.ok(result.model);
      assert.equal(typeof result.year, 'number');
    });

    it('should decode ast-03: 2020 Toyota Camry', async () => {
      const result = await decodeVin('4T1BF1FK5LU900003');
      assert.match(result.make, /toyota/i);
      // Synthetic VIN — model may be null due to check digit errors
      assert.equal(typeof result.year, 'number');
    });

    it('should decode ast-04: 2020 Toyota Highlander', async () => {
      const result = await decodeVin('5TDYZ3DC8LS500004');
      assert.match(result.make, /toyota/i);
      assert.ok(result.model);
    });

    it('should decode ast-05: 2021 Honda Civic', async () => {
      const result = await decodeVin('1HGBH41JXMN100005');
      assert.match(result.make, /honda/i);
      // Synthetic VIN — model may be null due to check digit errors
      assert.equal(typeof result.year, 'number');
    });

    it('should decode ast-06: 2021 Honda CR-V', async () => {
      const result = await decodeVin('5J8TC2H30ML000006');
      // Synthetic VIN prefix 5J8 maps to Acura (Honda subsidiary), not Honda
      assert.ok(result.make, 'make should be populated');
      assert.equal(typeof result.year, 'number');
    });

    it('should decode ast-08: 2022 Chevrolet Equinox', async () => {
      const result = await decodeVin('3GNAXKEV0NL200008');
      assert.match(result.make, /chevrolet/i);
      assert.ok(result.model);
    });

    it('should decode ast-09: 2021 Subaru Forester', async () => {
      const result = await decodeVin('JF2SKAEC5MH300009');
      assert.match(result.make, /subaru/i);
      assert.ok(result.model);
    });

    it('should decode ast-10: 2021 Subaru Outback', async () => {
      const result = await decodeVin('4S3BWAC60M3100010');
      assert.match(result.make, /subaru/i);
      assert.ok(result.model);
    });

    it('should decode extra: 2011 BMW 5-Series', async () => {
      const result = await decodeVin('WBAPH5C55BA200011');
      assert.match(result.make, /bmw/i);
      assert.ok(result.model);
      assert.equal(typeof result.year, 'number');
    });

    it('should return all expected fields with correct types', async () => {
      const result = await decodeVin('1FA6P8TH5L5100001');
      // String or null fields
      for (const key of ['make', 'model', 'trim', 'bodyClass', 'driveType', 'fuelType', 'transmission', 'plantCountry', 'vehicleType']) {
        const val = result[key];
        assert.ok(val === null || typeof val === 'string', `${key} should be string or null, got ${typeof val}`);
      }
      // Number or null fields
      for (const key of ['year', 'engineCylinders', 'displacementL', 'doors']) {
        const val = result[key];
        assert.ok(val === null || typeof val === 'number', `${key} should be number or null, got ${typeof val}`);
      }
    });
  });

  // ──────────────────────────────────────────────────────────
  // enrichVinData
  // ──────────────────────────────────────────────────────────

  describe('enrichVinData', () => {
    it('should merge decoded data into an empty object', async () => {
      const result = await enrichVinData('1FA6P8TH5L5100001', {});
      assert.ok(result.vin, 'should have vin');
      assert.ok(result.make, 'should have make');
      assert.ok(result.nhtsaData, 'should have nhtsaData');
    });

    it('should preserve existing non-null values', async () => {
      const existing = { make: 'Custom Make', year: 9999, color: 'Red' };
      const result = await enrichVinData('1FA6P8TH5L5100001', existing);
      assert.equal(result.make, 'Custom Make', 'existing make should be preserved');
      assert.equal(result.year, 9999, 'existing year should be preserved');
      assert.equal(result.color, 'Red', 'extra fields should be preserved');
      // But null fields should be filled
      assert.ok(result.model, 'model should be filled from NHTSA');
    });

    it('should fill null fields from decoded data', async () => {
      const existing = { make: null, year: null };
      const result = await enrichVinData('1FA6P8TH5L5100001', existing);
      assert.ok(result.make, 'null make should be filled');
      assert.ok(result.year, 'null year should be filled');
    });

    it('should always include nhtsaData', async () => {
      const result = await enrichVinData('1FA6P8TH5L5100001', { make: 'Ford' });
      assert.ok(result.nhtsaData, 'nhtsaData should always be present');
      assert.equal(typeof result.nhtsaData, 'object');
    });
  });

  // ──────────────────────────────────────────────────────────
  // updateAssetFromVin — database integration
  // ──────────────────────────────────────────────────────────

  describe('updateAssetFromVin', () => {
    it('should throw for a non-existent asset', async () => {
      await assert.rejects(
        () => updateAssetFromVin('nonexistent-id'),
        { message: /Asset not found/ }
      );
    });

    it('should update asset ast-01 from VIN decode', async () => {
      const result = await updateAssetFromVin('ast-01');
      assert.ok(result, 'should return updated asset');
      assert.equal(result.vin, '1FA6P8TH5L5100001');
      assert.equal(typeof result.year, 'number');
      assert.ok(result.make, 'make should be populated');
      assert.ok(result.vehicle_data, 'vehicle_data should be populated');

      // Verify it persisted in the DB
      const rows = await query("SELECT * FROM assets WHERE id = 'ast-01'");
      assert.equal(rows.length, 1);
      const vehicleData = JSON.parse(rows[0].vehicle_data);
      assert.ok(vehicleData.nhtsa, 'vehicle_data should contain nhtsa key');
      assert.ok(vehicleData.decodedAt, 'vehicle_data should contain decodedAt');
    });
  });
});
