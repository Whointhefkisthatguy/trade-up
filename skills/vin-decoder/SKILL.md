---
name: vin-decoder
description: Decodes 17-character VINs via the NHTSA vPIC API to extract year, make, model, trim, engine, and other vehicle attributes. Supports enrichment of existing records and direct database updates.
version: "0.2.0"
metadata:
  tags:
    - vin
    - vehicle
    - nhtsa
    - decode
  phase: data-ingestion
---

## Overview

The VIN Decoder skill takes a 17-character Vehicle Identification Number and queries the free NHTSA vPIC (Vehicle Product Information Catalog) API to return structured vehicle attribute data. This is a foundational skill used by other parts of the Trade Up platform whenever vehicle details need to be resolved from a VIN, such as during trade-in appraisals, inventory ingestion, or equity calculations.

## Inputs

- **vin** (string, required) — A 17-character Vehicle Identification Number. The skill validates the length and character set before making the API call.
- **model_year** (integer, optional) — If provided, the model year is sent to the NHTSA API to improve decode accuracy for older or ambiguous VINs.

## Steps

1. Validate that the provided VIN is exactly 17 characters and contains only valid alphanumeric characters (excluding I, O, and Q per the VIN standard).
2. Call the NHTSA vPIC API via `DecodeVinValues()` from `@shaggytools/nhtsa-api-wrapper`.
3. Check the NHTSA `ErrorCode` — code "0" indicates success; any other code triggers an error with the NHTSA error text.
4. Extract key vehicle attributes: year, make, model, trim, body class, drive type, engine displacement, engine cylinders, fuel type, transmission, doors, plant country, and vehicle type.
5. Normalize extracted values: trim whitespace, convert empty strings to null, cast year/cylinders/doors to integers, cast displacement to float.
6. Return the structured vehicle attribute object along with the full raw NHTSA response.
7. **`updateAssetFromVin(assetId)`** — Look up an asset by ID, decode its VIN, and update the asset's `year`, `make`, `model`, `trim`, and `vehicle_data` JSON fields in the database.

## Outputs

- **vehicle** (object) — A structured object containing the decoded vehicle attributes:
  - `vin` — The original VIN submitted (uppercased).
  - `year` — Model year (number).
  - `make` — Manufacturer name (e.g., "Ford").
  - `model` — Model name (e.g., "Mustang").
  - `trim` — Trim level (e.g., "GT Premium").
  - `bodyClass` — Body style (e.g., "Coupe").
  - `driveType` — Drivetrain (e.g., "Rear-Wheel Drive").
  - `engineCylinders` — Number of cylinders (number).
  - `displacementL` — Engine size in liters (number).
  - `fuelType` — Primary fuel type.
  - `transmission` — Transmission style.
  - `doors` — Number of doors (number).
  - `plantCountry` — Country of manufacture.
  - `vehicleType` — Vehicle type classification.
- **raw** (object) — The full NHTSA API response (130+ fields) for downstream consumers that need additional attributes.
- **nhtsaData** (object) — When using `enrichVinData()`, the full NHTSA response is stored under this key in the merged record.

## Database Integration

The `updateAssetFromVin(assetId)` function connects the VIN decoder to the `assets` table:

1. Queries the asset record by ID from the `assets` table.
2. Extracts the asset's `vin` field and passes it through `decodeVin()`.
3. Updates the asset's `year`, `make`, `model`, and `trim` columns with decoded values.
4. Stores the full NHTSA response inside the `vehicle_data` JSON column under the `nhtsa` key, along with a `decodedAt` timestamp.
5. Returns the updated asset record.

This enables batch VIN enrichment across the entire asset inventory — for example, iterating over all assets with a VIN but missing make/model data and filling them in from NHTSA.
