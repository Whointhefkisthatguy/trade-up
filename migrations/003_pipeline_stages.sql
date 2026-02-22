-- 003_pipeline_stages.sql
-- Pipeline stage definitions and sample records

-- ============================================================
-- Equity Mining Pipeline (10 stages)
-- ============================================================

INSERT INTO pipeline_stages (id, pipeline_name, stage_name, stage_order, description, auto_actions) VALUES
  ('ps-eq-01', 'equity',  'identified',        1,  'Customer identified as potential equity candidate', '[]'),
  ('ps-eq-02', 'equity',  'data_enriched',     2,  'Vehicle and loan data enriched from DMS/external sources', '[]'),
  ('ps-eq-03', 'equity',  'valuation_complete', 3, 'Market valuation obtained from one or more sources', '[]'),
  ('ps-eq-04', 'equity',  'equity_calculated',  4, 'Equity position calculated (positive/negative/breakeven)', '[]'),
  ('ps-eq-05', 'equity',  'offer_generated',    5, 'Trade offer generated from template', '["generate_offer"]'),
  ('ps-eq-06', 'equity',  'offer_sent',         6, 'Offer delivered via email/SMS', '["send_offer"]'),
  ('ps-eq-07', 'equity',  'offer_opened',       7, 'Customer opened/viewed the offer', '[]'),
  ('ps-eq-08', 'equity',  'customer_responded',  8, 'Customer responded to offer', '["notify_dealer"]'),
  ('ps-eq-09', 'equity',  'appointment_set',     9, 'Appointment scheduled at dealership', '["create_task"]'),
  ('ps-eq-10', 'equity',  'converted',          10, 'Trade-in completed', '[]');

-- ============================================================
-- Hiring Pipeline (7 stages)
-- ============================================================

INSERT INTO pipeline_stages (id, pipeline_name, stage_name, stage_order, description) VALUES
  ('ps-hr-01', 'hiring', 'sourced',            1, 'Candidate sourced or applied'),
  ('ps-hr-02', 'hiring', 'screening',          2, 'Initial screening/review'),
  ('ps-hr-03', 'hiring', 'phone_interview',    3, 'Phone interview scheduled or completed'),
  ('ps-hr-04', 'hiring', 'in_person_interview', 4, 'In-person interview scheduled or completed'),
  ('ps-hr-05', 'hiring', 'offer_extended',      5, 'Job offer extended to candidate'),
  ('ps-hr-06', 'hiring', 'offer_accepted',      6, 'Candidate accepted the offer'),
  ('ps-hr-07', 'hiring', 'onboarded',           7, 'Candidate fully onboarded');

-- ============================================================
-- Content Pipeline (6 stages)
-- ============================================================

INSERT INTO pipeline_stages (id, pipeline_name, stage_name, stage_order, description) VALUES
  ('ps-ct-01', 'content', 'idea',              1, 'Content idea submitted'),
  ('ps-ct-02', 'content', 'drafting',          2, 'Content being drafted'),
  ('ps-ct-03', 'content', 'review',            3, 'Content under review/approval'),
  ('ps-ct-04', 'content', 'approved',          4, 'Content approved for publishing'),
  ('ps-ct-05', 'content', 'scheduled',         5, 'Content scheduled for posting'),
  ('ps-ct-06', 'content', 'published',         6, 'Content published/posted');

-- ============================================================
-- Consulting Pipeline (7 stages)
-- ============================================================

INSERT INTO pipeline_stages (id, pipeline_name, stage_name, stage_order, description) VALUES
  ('ps-co-01', 'consulting', 'discovery',         1, 'Initial discovery and requirements gathering'),
  ('ps-co-02', 'consulting', 'audit_in_progress', 2, 'Audit or assessment underway'),
  ('ps-co-03', 'consulting', 'findings_ready',    3, 'Findings compiled and ready for review'),
  ('ps-co-04', 'consulting', 'presented',         4, 'Findings presented to client'),
  ('ps-co-05', 'consulting', 'action_plan',       5, 'Action plan created from findings'),
  ('ps-co-06', 'consulting', 'implementing',      6, 'Recommendations being implemented'),
  ('ps-co-07', 'consulting', 'completed',         7, 'Engagement completed and closed');

-- ============================================================
-- Sample pipeline records (customers in equity pipeline)
-- ============================================================

INSERT INTO pipeline_records (id, pipeline_stage_id, contact_id, asset_id, engagement_id) VALUES
  ('pr-01', 'ps-eq-01', 'ct-cust-01', 'ast-01', 'eng-summit-equity'),
  ('pr-02', 'ps-eq-03', 'ct-cust-02', 'ast-02', 'eng-summit-equity'),
  ('pr-03', 'ps-eq-01', 'ct-cust-04', 'ast-03', 'eng-lakeside-s2s'),
  ('pr-04', 'ps-eq-04', 'ct-cust-05', 'ast-04', 'eng-lakeside-s2s'),
  ('pr-05', 'ps-eq-02', 'ct-cust-07', 'ast-05', 'eng-premier-social'),
  ('pr-06', 'ps-eq-05', 'ct-cust-10', 'ast-07', 'eng-coastal-hiring'),
  ('pr-07', 'ps-eq-06', 'ct-cust-13', 'ast-09', 'eng-mountain-audit');
