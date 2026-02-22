---
name: vin-decoder
description: Decodes 17-character VINs via the NHTSA vPIC API to extract year, make, model, trim, engine, and other vehicle attributes.
version: "0.1.0"
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
2. Construct the NHTSA vPIC decode request URL: `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/{vin}?format=json`, appending the optional model year parameter if supplied.
3. Send the HTTP GET request to the NHTSA API with appropriate timeout and retry logic.
4. Parse the JSON response and extract key vehicle attributes: year, make, model, trim, body class, drive type, engine displacement, engine cylinders, fuel type, transmission, and plant information.
5. Normalize extracted values (trim whitespace, standardize casing, convert empty strings to null).
6. Return the structured vehicle attribute object.

## Outputs

- **vehicle** (object) — A structured object containing the decoded vehicle attributes:
  - `vin` — The original VIN submitted.
  - `year` — Model year.
  - `make` — Manufacturer name (e.g., "Toyota").
  - `model` — Model name (e.g., "Camry").
  - `trim` — Trim level (e.g., "XSE").
  - `body_class` — Body style (e.g., "Sedan").
  - `drive_type` — Drivetrain (e.g., "FWD", "AWD").
  - `engine_displacement` — Engine size in liters.
  - `engine_cylinders` — Number of cylinders.
  - `fuel_type` — Primary fuel type.
  - `transmission` — Transmission style.
  - `plant_country` — Country of manufacture.
- **raw_response** (object) — The full NHTSA API response for downstream consumers that need additional fields.
- **errors** (array) — Any error codes or messages returned by the NHTSA API for the decoded VIN.
