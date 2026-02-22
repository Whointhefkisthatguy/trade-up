# Trade Up — Automotive DMS Middleware + CRM

## Overview
Trade Up is an automotive DMS middleware and CRM platform built on Ironclaw/OpenClaw with DuckDB. It provides equity mining, trade offer generation, service-to-sales pipelines, hiring management, social content, and digital auditing for automotive dealerships.

## Architecture
- **Database**: DuckDB (file-based OLAP) — schema in `migrations/`
- **Services**: ES module singletons in `services/` — each exports async functions
- **Skills**: Ironclaw skill definitions in `skills/<name>/SKILL.md`
- **Templates**: Handlebars templates in `templates/`
- **Config**: JSON config files in `config/`

## Key Patterns
- All services use `services/db.js` for database access (singleton connection)
- SQL migrations are tracked in `_migrations` table for idempotency
- DuckDB uses VARCHAR + CHECK constraints instead of ENUMs
- UUIDs generated via `gen_random_uuid()`
- All IDs are UUID strings stored as VARCHAR

## Pipelines
1. **Equity Mining** — identify customers with positive equity, generate trade offers
2. **Service-to-Sales** — monitor service appointments, cross-sell opportunities
3. **Social Content** — manage social media content creation and scheduling
4. **Hiring** — recruitment pipeline for dealership positions
5. **Consulting/Digital Audit** — digital presence auditing for dealerships

## Running
- `npm run migrate` — apply database migrations
- `npm test` — run test suite
- Requires `.env` file (see `.env.example`)
