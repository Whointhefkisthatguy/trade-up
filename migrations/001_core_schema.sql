-- 001_core_schema.sql
-- Trade Up CRM core schema for DuckDB

-- Migration tracking table
CREATE TABLE IF NOT EXISTS _migrations (
  name VARCHAR PRIMARY KEY,
  applied_at TIMESTAMP DEFAULT current_timestamp
);

-- Contacts: people (customers, employees, vendors, candidates, team members)
CREATE TABLE IF NOT EXISTS contacts (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::VARCHAR,
  first_name VARCHAR NOT NULL,
  last_name VARCHAR NOT NULL,
  email VARCHAR,
  phone VARCHAR,
  contact_type VARCHAR NOT NULL CHECK (contact_type IN ('customer', 'employee', 'vendor', 'candidate', 'team_member')),
  source VARCHAR CHECK (source IN ('dms', 'web', 'referral', 'import', 'manual', 'service_appointment')),
  tags JSON DEFAULT '[]',
  metadata JSON DEFAULT '{}',
  created_at TIMESTAMP DEFAULT current_timestamp,
  updated_at TIMESTAMP DEFAULT current_timestamp
);

-- Unique index on email (NULLs are not considered duplicates in DuckDB)
CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_email ON contacts (email);

-- Organizations: companies (dealerships, clients, vendors, partners)
CREATE TABLE IF NOT EXISTS organizations (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::VARCHAR,
  name VARCHAR NOT NULL,
  org_type VARCHAR NOT NULL CHECK (org_type IN ('dealership', 'client', 'vendor', 'partner')),
  brand_profile JSON DEFAULT '{}',
  website VARCHAR,
  phone VARCHAR,
  address JSON DEFAULT '{}',
  settings JSON DEFAULT '{}',
  created_at TIMESTAMP DEFAULT current_timestamp,
  updated_at TIMESTAMP DEFAULT current_timestamp
);

-- Contact-org links: many-to-many contact-organization relationships
CREATE TABLE IF NOT EXISTS contact_org_links (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::VARCHAR,
  contact_id VARCHAR NOT NULL REFERENCES contacts(id),
  organization_id VARCHAR NOT NULL REFERENCES organizations(id),
  role VARCHAR NOT NULL CHECK (role IN ('owner', 'manager', 'employee', 'customer', 'vendor_rep', 'candidate', 'consultant')),
  is_primary BOOLEAN DEFAULT false,
  started_at TIMESTAMP DEFAULT current_timestamp,
  ended_at TIMESTAMP
);

-- Engagements: ongoing projects/relationships
CREATE TABLE IF NOT EXISTS engagements (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::VARCHAR,
  organization_id VARCHAR NOT NULL REFERENCES organizations(id),
  name VARCHAR NOT NULL,
  engagement_type VARCHAR NOT NULL CHECK (engagement_type IN ('equity_mining', 'service_to_sales', 'social_media', 'hiring', 'digital_audit', 'consulting', 'custom')),
  status VARCHAR NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'cancelled')),
  config JSON DEFAULT '{}',
  started_at TIMESTAMP DEFAULT current_timestamp,
  ended_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT current_timestamp,
  updated_at TIMESTAMP DEFAULT current_timestamp
);

-- Tasks: work items for people or AI agents
CREATE TABLE IF NOT EXISTS tasks (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::VARCHAR,
  engagement_id VARCHAR REFERENCES engagements(id),
  assigned_to VARCHAR REFERENCES contacts(id),
  title VARCHAR NOT NULL,
  description VARCHAR,
  task_type VARCHAR NOT NULL CHECK (task_type IN ('follow_up', 'review', 'create_content', 'send_offer', 'schedule', 'audit', 'hire', 'custom')),
  status VARCHAR NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'waiting_on_client', 'completed', 'blocked', 'cancelled')),
  priority VARCHAR DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  due_date TIMESTAMP,
  metadata JSON DEFAULT '{}',
  created_at TIMESTAMP DEFAULT current_timestamp,
  updated_at TIMESTAMP DEFAULT current_timestamp
);

-- Pipeline stages: generic pipeline stage definitions
CREATE TABLE IF NOT EXISTS pipeline_stages (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::VARCHAR,
  pipeline_name VARCHAR NOT NULL,
  stage_name VARCHAR NOT NULL,
  stage_order INTEGER NOT NULL,
  description VARCHAR,
  auto_actions JSON DEFAULT '[]',
  UNIQUE (pipeline_name, stage_order)
);

-- Pipeline records: records moving through pipelines
CREATE TABLE IF NOT EXISTS pipeline_records (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::VARCHAR,
  pipeline_stage_id VARCHAR NOT NULL REFERENCES pipeline_stages(id),
  contact_id VARCHAR REFERENCES contacts(id),
  asset_id VARCHAR,
  engagement_id VARCHAR REFERENCES engagements(id),
  entered_stage_at TIMESTAMP DEFAULT current_timestamp,
  metadata JSON DEFAULT '{}',
  created_at TIMESTAMP DEFAULT current_timestamp,
  updated_at TIMESTAMP DEFAULT current_timestamp
);

-- Assets: vehicles and other tracked items
CREATE TABLE IF NOT EXISTS assets (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::VARCHAR,
  contact_id VARCHAR REFERENCES contacts(id),
  organization_id VARCHAR REFERENCES organizations(id),
  asset_type VARCHAR NOT NULL DEFAULT 'vehicle' CHECK (asset_type IN ('vehicle', 'equipment', 'property', 'other')),
  vin VARCHAR,
  year INTEGER,
  make VARCHAR,
  model VARCHAR,
  trim VARCHAR,
  mileage INTEGER,
  color VARCHAR,
  vehicle_data JSON DEFAULT '{}',
  created_at TIMESTAMP DEFAULT current_timestamp,
  updated_at TIMESTAMP DEFAULT current_timestamp
);

-- Equity analyses: valuation and equity calculation results
CREATE TABLE IF NOT EXISTS equity_analyses (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::VARCHAR,
  asset_id VARCHAR NOT NULL REFERENCES assets(id),
  contact_id VARCHAR NOT NULL REFERENCES contacts(id),
  market_value DECIMAL(12,2),
  payoff_amount DECIMAL(12,2),
  equity_amount DECIMAL(12,2),
  equity_type VARCHAR CHECK (equity_type IN ('positive', 'negative', 'breakeven')),
  valuation_source VARCHAR CHECK (valuation_source IN ('kbb', 'nada', 'blackbook', 'vauto', 'manual', 'mock')),
  analysis_data JSON DEFAULT '{}',
  created_at TIMESTAMP DEFAULT current_timestamp
);

-- Trade offers: branded trade-in offers
CREATE TABLE IF NOT EXISTS trade_offers (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::VARCHAR,
  equity_analysis_id VARCHAR NOT NULL REFERENCES equity_analyses(id),
  contact_id VARCHAR NOT NULL REFERENCES contacts(id),
  organization_id VARCHAR NOT NULL REFERENCES organizations(id),
  offer_type VARCHAR NOT NULL CHECK (offer_type IN ('positive_equity', 'near_breakeven', 'lease_end', 'service_triggered')),
  offer_amount DECIMAL(12,2),
  template_name VARCHAR,
  rendered_html VARCHAR,
  status VARCHAR NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'opened', 'clicked', 'responded', 'expired', 'converted')),
  sent_at TIMESTAMP,
  opened_at TIMESTAMP,
  responded_at TIMESTAMP,
  metadata JSON DEFAULT '{}',
  created_at TIMESTAMP DEFAULT current_timestamp,
  updated_at TIMESTAMP DEFAULT current_timestamp
);

-- Communications: all customer touchpoints across channels
CREATE TABLE IF NOT EXISTS communications (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::VARCHAR,
  contact_id VARCHAR NOT NULL REFERENCES contacts(id),
  channel VARCHAR NOT NULL CHECK (channel IN ('email', 'sms', 'phone', 'in_person', 'social', 'chat')),
  direction VARCHAR NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  subject VARCHAR,
  body VARCHAR,
  status VARCHAR NOT NULL DEFAULT 'sent' CHECK (status IN ('draft', 'queued', 'sent', 'delivered', 'opened', 'clicked', 'bounced', 'failed')),
  related_offer_id VARCHAR REFERENCES trade_offers(id),
  external_id VARCHAR,
  metadata JSON DEFAULT '{}',
  created_at TIMESTAMP DEFAULT current_timestamp
);

-- Integrations: external system connections and health
CREATE TABLE IF NOT EXISTS integrations (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::VARCHAR,
  organization_id VARCHAR NOT NULL REFERENCES organizations(id),
  integration_type VARCHAR NOT NULL CHECK (integration_type IN ('dms', 'crm', 'vauto', 'email', 'sms', 'social', 'website', 'custom')),
  provider VARCHAR NOT NULL,
  status VARCHAR NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'error', 'pending')),
  config JSON DEFAULT '{}',
  last_sync_at TIMESTAMP,
  error_log JSON DEFAULT '[]',
  created_at TIMESTAMP DEFAULT current_timestamp,
  updated_at TIMESTAMP DEFAULT current_timestamp
);
