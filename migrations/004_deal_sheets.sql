-- 004_deal_sheets.sql
-- Deal sheet and client offer token tables for two-phase deal system

-- Deal sheets: internal sales documents with status gating
CREATE TABLE IF NOT EXISTS deal_sheets (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::VARCHAR,
  equity_analysis_id VARCHAR NOT NULL REFERENCES equity_analyses(id),
  asset_id VARCHAR NOT NULL REFERENCES assets(id),
  contact_id VARCHAR NOT NULL REFERENCES contacts(id),
  organization_id VARCHAR NOT NULL REFERENCES organizations(id),
  vehicle_specs JSON DEFAULT '{}',
  valuation_breakdown JSON DEFAULT '{}',
  equity_summary JSON DEFAULT '{}',
  recommended_approach VARCHAR,
  rendered_html VARCHAR,
  status VARCHAR NOT NULL DEFAULT 'generated' CHECK (status IN ('generated', 'viewed', 'presented', 'client_offer_sent')),
  viewed_at TIMESTAMP,
  presented_at TIMESTAMP,
  presented_by VARCHAR REFERENCES contacts(id),
  created_at TIMESTAMP DEFAULT current_timestamp,
  updated_at TIMESTAMP DEFAULT current_timestamp
);

-- Client offer tokens: secure access links for customer-facing pages
CREATE TABLE IF NOT EXISTS client_offer_tokens (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::VARCHAR,
  deal_sheet_id VARCHAR NOT NULL REFERENCES deal_sheets(id),
  token VARCHAR NOT NULL UNIQUE,
  status VARCHAR NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'revoked')),
  first_accessed_at TIMESTAMP,
  last_accessed_at TIMESTAMP,
  access_count INTEGER DEFAULT 0,
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT current_timestamp
);
