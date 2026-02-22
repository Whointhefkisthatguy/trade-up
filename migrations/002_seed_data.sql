-- 002_seed_data.sql
-- Seed data for Trade Up CRM

-- ============================================================
-- Organizations (6 total: 5 dealerships + 1 vendor)
-- ============================================================

INSERT INTO organizations (id, name, org_type, brand_profile, website, phone, address) VALUES
  ('org-dealer-summit',    'Summit Ford',          'dealership', '{"primary_color":"#003478","secondary_color":"#FFFFFF","brand_voice":"professional"}', 'https://summitford.com',      '(555) 100-1000', '{"city":"Denver","state":"CO"}'),
  ('org-dealer-lakeside',  'Lakeside Toyota',      'dealership', '{"primary_color":"#EB0A1E","secondary_color":"#282830","brand_voice":"friendly"}',    'https://lakesidetoyota.com',  '(555) 200-2000', '{"city":"Austin","state":"TX"}'),
  ('org-dealer-premier',   'Premier Honda',        'dealership', '{"primary_color":"#CC0000","secondary_color":"#000000","brand_voice":"energetic"}',   'https://premierhonda.com',    '(555) 300-3000', '{"city":"Phoenix","state":"AZ"}'),
  ('org-dealer-coastal',   'Coastal Chevrolet',    'dealership', '{"primary_color":"#D1A032","secondary_color":"#1A1A1A","brand_voice":"bold"}',        'https://coastalchevy.com',    '(555) 400-4000', '{"city":"Miami","state":"FL"}'),
  ('org-dealer-mountain',  'Mountain Subaru',      'dealership', '{"primary_color":"#003DA5","secondary_color":"#63B1E5","brand_voice":"adventurous"}', 'https://mountainsubaru.com',  '(555) 500-5000', '{"city":"Portland","state":"OR"}'),
  ('org-vendor-autodata',  'AutoData Solutions',   'vendor',     '{}',                                                                                  'https://autodata.example.com','(555) 600-6000', '{"city":"Chicago","state":"IL"}');

-- ============================================================
-- Contacts (25 total: 5 employees, 15 customers, 3 team members, 2 vendors)
-- ============================================================

-- Employees (one per dealership)
INSERT INTO contacts (id, first_name, last_name, email, phone, contact_type, source) VALUES
  ('ct-emp-marcus',   'Marcus',   'Chen',       'marcus.chen@summitford.com',      '(555) 101-0001', 'employee', 'manual'),
  ('ct-emp-sarah',    'Sarah',    'Williams',   'sarah.w@lakesidetoyota.com',      '(555) 201-0001', 'employee', 'manual'),
  ('ct-emp-david',    'David',    'Rodriguez',  'david.r@premierhonda.com',        '(555) 301-0001', 'employee', 'manual'),
  ('ct-emp-lisa',     'Lisa',     'Thompson',   'lisa.t@coastalchevy.com',         '(555) 401-0001', 'employee', 'manual'),
  ('ct-emp-james',    'James',    'Nakamura',   'james.n@mountainsubaru.com',      '(555) 501-0001', 'employee', 'manual');

-- Customers (15 across dealerships)
INSERT INTO contacts (id, first_name, last_name, email, phone, contact_type, source) VALUES
  ('ct-cust-01', 'Alex',     'Johnson',    'alex.johnson@email.com',        '(555) 110-0001', 'customer', 'dms'),
  ('ct-cust-02', 'Maria',    'Garcia',     'maria.garcia@email.com',        '(555) 110-0002', 'customer', 'dms'),
  ('ct-cust-03', 'Brian',    'Smith',      'brian.smith@email.com',         '(555) 110-0003', 'customer', 'web'),
  ('ct-cust-04', 'Jennifer', 'Lee',        'jennifer.lee@email.com',        '(555) 210-0001', 'customer', 'dms'),
  ('ct-cust-05', 'Robert',   'Taylor',     'robert.taylor@email.com',       '(555) 210-0002', 'customer', 'referral'),
  ('ct-cust-06', 'Ashley',   'Brown',      'ashley.brown@email.com',        '(555) 210-0003', 'customer', 'dms'),
  ('ct-cust-07', 'Michael',  'Davis',      'michael.davis@email.com',       '(555) 310-0001', 'customer', 'web'),
  ('ct-cust-08', 'Emily',    'Wilson',     'emily.wilson@email.com',        '(555) 310-0002', 'customer', 'dms'),
  ('ct-cust-09', 'Daniel',   'Martinez',   'daniel.martinez@email.com',     '(555) 310-0003', 'customer', 'service_appointment'),
  ('ct-cust-10', 'Jessica',  'Anderson',   'jessica.anderson@email.com',    '(555) 410-0001', 'customer', 'dms'),
  ('ct-cust-11', 'Kevin',    'Thomas',     'kevin.thomas@email.com',        '(555) 410-0002', 'customer', 'web'),
  ('ct-cust-12', 'Amanda',   'Jackson',    'amanda.jackson@email.com',      '(555) 410-0003', 'customer', 'dms'),
  ('ct-cust-13', 'Tyler',    'White',      'tyler.white@email.com',         '(555) 510-0001', 'customer', 'referral'),
  ('ct-cust-14', 'Megan',    'Harris',     'megan.harris@email.com',        '(555) 510-0002', 'customer', 'dms'),
  ('ct-cust-15', 'Chris',    'Clark',      'chris.clark@email.com',         '(555) 510-0003', 'customer', 'service_appointment');

-- Team members (internal consultants)
INSERT INTO contacts (id, first_name, last_name, email, phone, contact_type, source) VALUES
  ('ct-team-01', 'Rachel',   'Foster',     'rachel@tradeup.io',             '(555) 700-0001', 'team_member', 'manual'),
  ('ct-team-02', 'Nathan',   'Brooks',     'nathan@tradeup.io',             '(555) 700-0002', 'team_member', 'manual'),
  ('ct-team-03', 'Olivia',   'Reed',       'olivia@tradeup.io',             '(555) 700-0003', 'team_member', 'manual');

-- Vendors
INSERT INTO contacts (id, first_name, last_name, email, phone, contact_type, source) VALUES
  ('ct-vend-01', 'Patrick',  'Sullivan',   'patrick@autodata.example.com',  '(555) 600-0001', 'vendor', 'manual'),
  ('ct-vend-02', 'Diana',    'Patel',      'diana@autodata.example.com',    '(555) 600-0002', 'vendor', 'manual');

-- ============================================================
-- Contact-org links
-- ============================================================

-- Employees to their dealerships
INSERT INTO contact_org_links (contact_id, organization_id, role, is_primary) VALUES
  ('ct-emp-marcus',  'org-dealer-summit',   'manager',  true),
  ('ct-emp-sarah',   'org-dealer-lakeside', 'manager',  true),
  ('ct-emp-david',   'org-dealer-premier',  'manager',  true),
  ('ct-emp-lisa',    'org-dealer-coastal',  'manager',  true),
  ('ct-emp-james',   'org-dealer-mountain', 'manager',  true);

-- Customers to dealerships (3 per dealership)
INSERT INTO contact_org_links (contact_id, organization_id, role, is_primary) VALUES
  ('ct-cust-01', 'org-dealer-summit',   'customer', true),
  ('ct-cust-02', 'org-dealer-summit',   'customer', true),
  ('ct-cust-03', 'org-dealer-summit',   'customer', true),
  ('ct-cust-04', 'org-dealer-lakeside', 'customer', true),
  ('ct-cust-05', 'org-dealer-lakeside', 'customer', true),
  ('ct-cust-06', 'org-dealer-lakeside', 'customer', true),
  ('ct-cust-07', 'org-dealer-premier',  'customer', true),
  ('ct-cust-08', 'org-dealer-premier',  'customer', true),
  ('ct-cust-09', 'org-dealer-premier',  'customer', true),
  ('ct-cust-10', 'org-dealer-coastal',  'customer', true),
  ('ct-cust-11', 'org-dealer-coastal',  'customer', true),
  ('ct-cust-12', 'org-dealer-coastal',  'customer', true),
  ('ct-cust-13', 'org-dealer-mountain', 'customer', true),
  ('ct-cust-14', 'org-dealer-mountain', 'customer', true),
  ('ct-cust-15', 'org-dealer-mountain', 'customer', true);

-- Team members as consultants to all orgs
INSERT INTO contact_org_links (contact_id, organization_id, role) VALUES
  ('ct-team-01', 'org-dealer-summit',   'consultant'),
  ('ct-team-01', 'org-dealer-lakeside', 'consultant'),
  ('ct-team-02', 'org-dealer-premier',  'consultant'),
  ('ct-team-02', 'org-dealer-coastal',  'consultant'),
  ('ct-team-03', 'org-dealer-mountain', 'consultant');

-- Vendors to vendor org
INSERT INTO contact_org_links (contact_id, organization_id, role, is_primary) VALUES
  ('ct-vend-01', 'org-vendor-autodata', 'vendor_rep', true),
  ('ct-vend-02', 'org-vendor-autodata', 'vendor_rep', false);

-- ============================================================
-- Engagements (5 total, one per dealership)
-- ============================================================

INSERT INTO engagements (id, organization_id, name, engagement_type, status) VALUES
  ('eng-summit-equity',   'org-dealer-summit',   'Summit Ford Equity Mining',      'equity_mining',    'active'),
  ('eng-lakeside-s2s',    'org-dealer-lakeside', 'Lakeside Service-to-Sales',      'service_to_sales', 'active'),
  ('eng-premier-social',  'org-dealer-premier',  'Premier Honda Social Media',     'social_media',     'active'),
  ('eng-coastal-hiring',  'org-dealer-coastal',  'Coastal Chevrolet Hiring',       'hiring',           'active'),
  ('eng-mountain-audit',  'org-dealer-mountain', 'Mountain Subaru Digital Audit',  'digital_audit',    'active');

-- ============================================================
-- Assets (10 vehicles linked to customers)
-- ============================================================

INSERT INTO assets (id, contact_id, organization_id, asset_type, vin, year, make, model, trim, mileage, color) VALUES
  ('ast-01', 'ct-cust-01', 'org-dealer-summit',   'vehicle', '1FA6P8TH5L5100001', 2020, 'Ford',      'Mustang',    'GT Premium',      32000, 'Red'),
  ('ast-02', 'ct-cust-02', 'org-dealer-summit',   'vehicle', '1FTEW1EP0LFA00002', 2020, 'Ford',      'F-150',      'XLT',             45000, 'Blue'),
  ('ast-03', 'ct-cust-04', 'org-dealer-lakeside', 'vehicle', '4T1BF1FK5LU900003', 2020, 'Toyota',    'Camry',      'SE',              38000, 'Silver'),
  ('ast-04', 'ct-cust-05', 'org-dealer-lakeside', 'vehicle', '5TDYZ3DC8LS500004', 2020, 'Toyota',    'Highlander', 'XLE',             42000, 'White'),
  ('ast-05', 'ct-cust-07', 'org-dealer-premier',  'vehicle', '1HGBH41JXMN100005', 2021, 'Honda',     'Civic',      'Sport',           28000, 'Black'),
  ('ast-06', 'ct-cust-08', 'org-dealer-premier',  'vehicle', '5J8TC2H30ML000006', 2021, 'Honda',     'CR-V',       'EX-L',            35000, 'Gray'),
  ('ast-07', 'ct-cust-10', 'org-dealer-coastal',  'vehicle', '1G1YY22G465100007', 2022, 'Chevrolet', 'Corvette',   'Stingray',        18000, 'Yellow'),
  ('ast-08', 'ct-cust-11', 'org-dealer-coastal',  'vehicle', '3GNAXKEV0NL200008', 2022, 'Chevrolet', 'Equinox',    'LT',              25000, 'White'),
  ('ast-09', 'ct-cust-13', 'org-dealer-mountain', 'vehicle', 'JF2SKAEC5MH300009', 2021, 'Subaru',    'Forester',   'Premium',         31000, 'Green'),
  ('ast-10', 'ct-cust-14', 'org-dealer-mountain', 'vehicle', '4S3BWAC60M3100010', 2021, 'Subaru',    'Outback',    'Limited',         36000, 'Blue');
