-- ============================================================================
-- BuildAI Demo Database - Construction Project Management
-- Realistic construction data for investor demo
-- Run: psql -U apoorvgarg -d buildai_demo -f seed-demo-db.sql
-- ============================================================================

-- Clean slate
DROP TABLE IF EXISTS pay_applications CASCADE;
DROP TABLE IF EXISTS insurance_certs CASCADE;
DROP TABLE IF EXISTS punch_list_items CASCADE;
DROP TABLE IF EXISTS daily_logs CASCADE;
DROP TABLE IF EXISTS change_orders CASCADE;
DROP TABLE IF EXISTS budget_line_items CASCADE;
DROP TABLE IF EXISTS submittals CASCADE;
DROP TABLE IF EXISTS rfis CASCADE;
DROP TABLE IF EXISTS vendors CASCADE;
DROP TABLE IF EXISTS projects CASCADE;

-- ============================================================================
-- PROJECTS
-- ============================================================================
CREATE TABLE projects (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    address VARCHAR(300),
    city VARCHAR(100),
    state VARCHAR(50),
    status VARCHAR(20) CHECK (status IN ('active','completed','on_hold')),
    contract_sum NUMERIC(14,2),
    start_date DATE,
    projected_completion DATE,
    actual_completion DATE,
    owner_name VARCHAR(200),
    architect VARCHAR(200),
    general_contractor VARCHAR(200),
    project_type VARCHAR(30) CHECK (project_type IN ('commercial','residential','infrastructure','mixed_use','healthcare'))
);

INSERT INTO projects (name, address, city, state, status, contract_sum, start_date, projected_completion, actual_completion, owner_name, architect, general_contractor, project_type) VALUES
('Riverside Tower Mixed-Use Development', '1200 River Parkway', 'Austin', 'TX', 'active', 87500000.00, '2024-09-15', '2026-06-30', NULL, 'Riverside Capital Partners LLC', 'Gensler', 'Turner Construction Co.', 'mixed_use'),
('Metro Line Extension Phase 2', '4500 Transit Corridor Blvd', 'Denver', 'CO', 'active', 245000000.00, '2024-03-01', '2027-01-15', NULL, 'Denver Regional Transportation District', 'AECOM', 'Kiewit Infrastructure Co.', 'infrastructure'),
('Harborview Medical Center Expansion', '800 Harborview Dr', 'Seattle', 'WA', 'active', 156000000.00, '2024-06-01', '2026-09-30', NULL, 'UW Medicine', 'HDR Inc.', 'Skanska USA Building Inc.', 'healthcare'),
('Pinnacle Residences at Midtown', '350 Peachtree St NE', 'Atlanta', 'GA', 'active', 62000000.00, '2025-01-10', '2026-11-15', NULL, 'Hines Interests LP', 'Arquitectonica', 'Brasfield & Gorrie LLC', 'residential'),
('Westfield Logistics Hub', '9200 Industrial Pkwy', 'Phoenix', 'AZ', 'on_hold', 41500000.00, '2025-02-01', '2026-04-30', NULL, 'Prologis Inc.', 'DLR Group', 'Hensel Phelps Construction Co.', 'commercial');

-- ============================================================================
-- VENDORS (subcontractors & suppliers)
-- ============================================================================
CREATE TABLE vendors (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES projects(id),
    company_name VARCHAR(200) NOT NULL,
    trade VARCHAR(100),
    contact_name VARCHAR(150),
    email VARCHAR(200),
    phone VARCHAR(20),
    contract_amount NUMERIC(12,2),
    paid_to_date NUMERIC(12,2),
    retainage_held NUMERIC(12,2)
);

INSERT INTO vendors (project_id, company_name, trade, contact_name, email, phone, contract_amount, paid_to_date, retainage_held) VALUES
-- Riverside Tower (project 1)
(1, 'Consolidated Electrical Distributors', 'Electrical', 'Mike Hernandez', 'mhernandez@ced-inc.com', '512-555-0142', 8750000.00, 3500000.00, 350000.00),
(1, 'Baker Concrete Construction', 'Concrete', 'Sarah Chen', 'schen@bakerconcrete.com', '512-555-0198', 6200000.00, 5580000.00, 558000.00),
(1, 'Comfort Systems USA', 'HVAC', 'James Rivera', 'jrivera@comfortsystemsusa.com', '512-555-0233', 5400000.00, 2160000.00, 216000.00),
(1, 'Schindler Elevator Corp', 'Vertical Transportation', 'Anna Kowalski', 'akowalski@schindler.com', '512-555-0311', 3200000.00, 960000.00, 96000.00),
(1, 'Performance Contracting Inc.', 'Fireproofing & Insulation', 'David Park', 'dpark@pframing.com', '512-555-0287', 1850000.00, 740000.00, 74000.00),
-- Metro Line (project 2)
(2, 'Granite Construction Inc.', 'Earthwork & Grading', 'Robert Martinez', 'rmartinez@graniteconstruction.com', '303-555-0156', 32000000.00, 22400000.00, 2240000.00),
(2, 'Nucor Rebar Fabrication', 'Rebar & Structural Steel', 'Lisa Thompson', 'lthompson@nucor.com', '303-555-0201', 18500000.00, 11100000.00, 1110000.00),
(2, 'Parsons Corporation', 'Systems Integration', 'Ahmed Al-Rashid', 'aalrashid@parsons.com', '303-555-0344', 28000000.00, 8400000.00, 840000.00),
(2, 'Siemens Mobility Inc.', 'Signal & Communications', 'Karen Wu', 'kwu@siemens.com', '303-555-0178', 15000000.00, 4500000.00, 450000.00),
(2, 'CEMEX USA', 'Ready-Mix Concrete', 'Carlos Gutierrez', 'cgutierrez@cemex.com', '303-555-0422', 9800000.00, 7840000.00, 784000.00),
-- Harborview Medical (project 3)
(3, 'Southland Industries', 'Mechanical/Plumbing', 'Tom Bradley', 'tbradley@southlandind.com', '206-555-0189', 14200000.00, 5680000.00, 568000.00),
(3, 'Rosendin Electric', 'Electrical', 'Patricia Nguyen', 'pnguyen@rosendin.com', '206-555-0234', 11800000.00, 4720000.00, 472000.00),
(3, 'Walbridge', 'Interior Finishes', 'Greg Olsen', 'golsen@walbridge.com', '206-555-0301', 8500000.00, 1700000.00, 170000.00),
(3, 'Otis Elevator Co.', 'Vertical Transportation', 'Michelle Lee', 'mlee@otis.com', '206-555-0377', 4100000.00, 1230000.00, 123000.00),
-- Pinnacle Residences (project 4)
(4, 'Choate Construction', 'General Trades', 'William Foster', 'wfoster@choateco.com', '404-555-0145', 7200000.00, 2880000.00, 288000.00),
(4, 'Holder Construction', 'Structural Steel', 'Jennifer Adams', 'jadams@holderconstruction.com', '404-555-0267', 5100000.00, 2040000.00, 204000.00),
(4, 'McKenney''s Inc.', 'Mechanical', 'Richard Kim', 'rkim@mckenneys.com', '404-555-0312', 4800000.00, 1440000.00, 144000.00),
(4, 'Piedmont Electrical', 'Electrical', 'Brenda Johnson', 'bjohnson@piedmontelec.com', '404-555-0188', 3900000.00, 1170000.00, 117000.00),
-- Westfield Logistics (project 5)
(5, 'Sundt Construction', 'Concrete & Tilt-Up', 'Daniel Morales', 'dmorales@sundt.com', '602-555-0211', 6800000.00, 2040000.00, 204000.00),
(5, 'Southwest Gas Systems', 'Plumbing & Gas', 'Stephanie Brown', 'sbrown@swgas-sys.com', '602-555-0344', 2400000.00, 720000.00, 72000.00),
(5, 'Desert Electric Co.', 'Electrical', 'Mark Taylor', 'mtaylor@desertelectric.com', '602-555-0156', 3100000.00, 930000.00, 93000.00),
(5, 'Kingspan Insulated Panels', 'Exterior Panels', 'Rachel Garcia', 'rgarcia@kingspan.com', '602-555-0289', 4500000.00, 1350000.00, 135000.00);

-- ============================================================================
-- RFIs (Requests for Information)
-- ============================================================================
CREATE TABLE rfis (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES projects(id),
    number VARCHAR(20) NOT NULL,
    subject VARCHAR(300),
    status VARCHAR(10) CHECK (status IN ('open','closed','void')),
    priority VARCHAR(10) CHECK (priority IN ('normal','urgent','critical')),
    assigned_to VARCHAR(150),
    created_by VARCHAR(150),
    created_date DATE,
    due_date DATE,
    closed_date DATE,
    days_open INTEGER,
    description TEXT,
    response TEXT
);

INSERT INTO rfis (project_id, number, subject, status, priority, assigned_to, created_by, created_date, due_date, closed_date, days_open, description, response) VALUES
-- Riverside Tower RFIs
(1, 'RFI-001', 'Structural steel connection detail at Level 12 transfer beam', 'closed', 'urgent', 'Gensler - Structural', 'Turner Construction', '2025-01-15', '2025-01-25', '2025-01-23', 8, 'Drawing S-401 shows W24x84 connecting to W36x150 at gridline G-7. Field conditions indicate a conflict with the MEP chase. Please clarify connection detail and confirm if a moment connection is required.', 'Revised detail SK-S-042 issued. Use bolted moment connection with stiffener plates. MEP chase shifted 6" east per RFI-003 coordination.'),
(1, 'RFI-002', 'Curtain wall anchor spacing at curved facade sections', 'closed', 'normal', 'Gensler - Envelope', 'Schindler Elevator Corp', '2025-01-22', '2025-02-05', '2025-02-03', 12, 'Curtain wall anchor spacing shown at 48" OC on drawing A-801. Curved sections between gridlines B-3 and B-7 may require reduced spacing. Please confirm anchor spacing for curved areas.', 'Reduce anchor spacing to 36" OC for curved sections. Updated drawing A-801R1 to follow.'),
(1, 'RFI-003', 'MEP routing conflict at Level 8 mechanical room', 'open', 'critical', 'Gensler - MEP', 'Comfort Systems USA', '2025-04-10', '2025-04-20', NULL, NULL, 'Main supply duct (60"x24") conflicts with 12" chilled water main at elevation 114''-6". Both shown on drawing M-301 and P-201. Coordination drawing attached. Need resolution ASAP as concrete pour scheduled for May 1.', NULL),
(1, 'RFI-004', 'Waterproofing membrane specification for below-grade parking', 'closed', 'normal', 'Gensler - Structural', 'Baker Concrete Construction', '2025-02-10', '2025-02-24', '2025-02-20', 10, 'Spec section 07 11 00 references Carlisle CCW MiraDRI 860/861. Distributor reports 8-week lead time. Is Cetco Voltex DS an acceptable alternate?', 'Cetco Voltex DS is approved as equal. Submit product data for record.'),
(1, 'RFI-005', 'Fire alarm device placement in parking garage levels P1-P3', 'open', 'urgent', 'Gensler - Fire/Life Safety', 'Consolidated Electrical', '2025-05-01', '2025-05-12', NULL, NULL, 'Drawing FA-102 shows smoke detectors at 30'' OC in parking garage. NFPA 72 allows heat detectors in parking garages. Please confirm detector type and spacing. Impacts conduit rough-in currently underway.', NULL),
(1, 'RFI-006', 'Elevator pit depth confirmation for freight elevator', 'closed', 'normal', 'Gensler - Structural', 'Schindler Elevator Corp', '2025-03-05', '2025-03-19', '2025-03-14', 9, 'Drawing A-110 shows freight elevator pit depth at 8''-0". Schindler model 5500 requires minimum 8''-6" pit depth. Please confirm if pit can be deepened or if alternate model should be specified.', 'Pit depth revised to 8''-6". See structural revision S-101R2 for updated foundation detail.'),
-- Metro Line RFIs  
(2, 'RFI-007', 'Tunnel boring machine launch pit stabilization method', 'closed', 'critical', 'AECOM - Geotechnical', 'Kiewit Infrastructure', '2024-11-15', '2024-11-25', '2024-11-22', 7, 'Soil borings at Station 42+00 indicate high water table (elev. 5282''). GBR assumed sheet pile support but clay layer at 15'' depth may not provide adequate toe embedment. Request geotechnical recommendation for launch pit stabilization.', 'Install secant pile wall with jet grouting below clay layer. Revised shoring design to follow in 5 business days. Dewatering plan required per revised Geotech Report Addendum 3.'),
(2, 'RFI-008', 'Track alignment deviation at Station 3 platform', 'open', 'urgent', 'AECOM - Rail', 'Granite Construction', '2025-05-20', '2025-05-30', NULL, NULL, 'Survey indicates 0.75" horizontal deviation from design alignment at STA 156+50 to STA 158+00. This exceeds the 0.5" tolerance in spec section 34 11 00. Request guidance on acceptable tolerance or corrective action required.', NULL),
(2, 'RFI-009', 'Overhead catenary system pole foundation at bridge approach', 'open', 'critical', 'AECOM - Structural', 'Siemens Mobility', '2025-04-28', '2025-05-08', NULL, NULL, 'OCS pole foundations at Bridge 7 approach (STA 203+00 to 204+50) conflict with existing 36" storm drain. Pole relocation affects catenary wire geometry. Please provide revised pole locations and confirm wire tension calculations remain valid.', NULL),
(2, 'RFI-010', 'Concrete mix design for elevated guideway segments', 'closed', 'normal', 'AECOM - Materials', 'CEMEX USA', '2025-02-14', '2025-02-28', '2025-02-26', 12, 'Spec requires 6000 PSI concrete with Type V cement for guideway segments. Local batch plant proposes fly ash substitution at 25% replacement. Please confirm acceptability and any adjustments to curing requirements.', 'Fly ash substitution approved at 20% maximum replacement. Extend wet curing to 10 days minimum. Submit revised mix design for approval.'),
(2, 'RFI-011', 'Utility relocation conflict - AT&T fiber optic trunk line', 'open', 'urgent', 'AECOM - Utilities', 'Kiewit Infrastructure', '2025-05-15', '2025-05-25', NULL, NULL, 'Potholing at STA 178+25 revealed AT&T fiber optic trunk (48-strand) at elevation 5271.5'', 2.3'' south of expected location. Conflicts with retaining wall foundation. AT&T relocation timeline estimated at 16 weeks. Request design revision or alternate foundation detail.', NULL),
-- Harborview Medical RFIs
(3, 'RFI-012', 'Medical gas system - oxygen bulk tank foundation', 'closed', 'urgent', 'HDR - Mechanical', 'Southland Industries', '2025-03-01', '2025-03-11', '2025-03-10', 9, 'Drawing P-601 shows LOX tank pad at 12''x12''x18" thick. Tank manufacturer (Chart Industries) requires minimum 15''x15''x24" foundation with vibration isolation. Please confirm revised foundation dimensions.', 'Revised foundation per manufacturer requirements. See structural detail S-810R1. Include 4" housekeeping pad and bollard protection per updated site plan C-102R3.'),
(3, 'RFI-013', 'Radiation shielding thickness for linear accelerator vault', 'closed', 'critical', 'HDR - Radiation Safety', 'Skanska USA', '2025-01-20', '2025-01-30', '2025-01-28', 8, 'Spec Section 13 49 00 specifies 7''-0" concrete walls for LinAc vault. Equipment vendor (Varian) has upgraded to TrueBeam 2.0 with higher energy output. Please confirm shielding calculations remain adequate or provide revised wall thicknesses.', 'Revised shielding calculations attached (Report RS-2025-003). Primary barriers increased to 8''-0". Secondary barriers adequate at 5''-6". See revised structural drawings S-901 through S-904.'),
(3, 'RFI-014', 'Clean room HVAC air change rate for Cath Lab suite', 'open', 'urgent', 'HDR - Mechanical', 'Comfort Systems USA', '2025-05-05', '2025-05-15', NULL, NULL, 'Drawing M-410 specifies 15 ACH for Cath Lab 2 (Room 4-212). ASHRAE 170-2021 and FGI 2022 now require minimum 20 ACH for cardiac catheterization labs. Current AHU-4 sizing is based on 15 ACH. Please confirm required air change rate and impact on AHU sizing.', NULL),
(3, 'RFI-015', 'Seismic bracing for MRI suite - vibration isolation conflict', 'open', 'normal', 'HDR - Structural', 'Rosendin Electric', '2025-05-18', '2025-06-01', NULL, NULL, 'Seismic bracing for cable tray (drawing E-305) above MRI Room 2-108 conflicts with MRI vendor''s vibration isolation envelope. Siemens Healthineers requires 5-foot clear zone around magnet. Please provide revised bracing locations that maintain seismic compliance outside vibration zone.', NULL),
(3, 'RFI-016', 'Emergency generator fuel storage - environmental containment', 'closed', 'normal', 'HDR - Civil', 'Skanska USA', '2025-04-01', '2025-04-15', '2025-04-12', 11, 'Drawing C-301 shows 10,000 gallon diesel UST. Washington State DOE requires secondary containment and leak detection per WAC 173-360A. Spec section 23 13 00 does not address state-specific requirements. Please provide containment details.', 'Double-wall UST with interstitial monitoring specified. See revised spec section 23 13 00 Addendum 2 and detail C-301R1 for containment and monitoring piping.'),
-- Pinnacle Residences RFIs
(4, 'RFI-017', 'Balcony waterproofing detail at sliding door threshold', 'open', 'normal', 'Arquitectonica', 'Brasfield & Gorrie', '2025-05-10', '2025-05-24', NULL, NULL, 'Detail 8/A-501 shows 1/2" threshold height at balcony sliding doors. Florida Building Code requires minimum 4" threshold height or approved alternate drainage detail. Georgia has adopted similar requirements. Please provide code-compliant threshold detail.', NULL),
(4, 'RFI-018', 'Residential unit layout revision - ADA compliance Units 4A-4D', 'open', 'urgent', 'Arquitectonica', 'Brasfield & Gorrie', '2025-05-22', '2025-06-02', NULL, NULL, 'Units 4A through 4D designated as Type A accessible units per Fair Housing Act. Drawing A-404 shows 32" clear door openings at bathrooms. FHA requires minimum 34" nominal (32" clear) but Georgia accessibility code requires 36" nominal. Current framing layout does not accommodate 36" doors without relocating plumbing wall. Please advise.', NULL),
(4, 'RFI-019', 'Pool deck structural loading - rooftop amenity level', 'closed', 'urgent', 'Arquitectonica - Structural', 'Holder Construction', '2025-04-15', '2025-04-25', '2025-04-22', 7, 'Structural drawings show 100 PSF live load at Level 7 amenity deck. Pool design (drawing A-701) with 4''-6" water depth imposes 281 PSF dead load. Please confirm structural adequacy or provide revised framing.', 'Transfer beam at gridline D reinforced. See S-701R2 for revised post-tensioning layout. Additional shoring required at Level 6 during construction - see shoring plan SK-S-088.'),
(4, 'RFI-020', 'Kitchen exhaust duct routing through residential floors', 'closed', 'normal', 'Arquitectonica - MEP', 'McKenney''s Inc.', '2025-03-20', '2025-04-03', '2025-03-31', 11, 'Restaurant kitchen exhaust duct (42"x24") from Level 1 commercial space routes through residential floors per drawing M-201. Duct shaft on drawing A-210 is only 36"x20". Please confirm shaft dimensions and address acoustical separation requirements.', 'Shaft enlarged to 48"x30". Acoustical liner required per detail M-201R1. Residential unit 2C layout revised to accommodate - see A-210R3.'),
-- Westfield Logistics RFIs
(4, 'RFI-021', 'Dock leveler pit dimensions and structural reinforcement', 'open', 'normal', 'DLR Group', 'Sundt Construction', '2025-05-25', '2025-06-08', NULL, NULL, 'Drawing S-201 shows standard dock leveler pit at 8''x7'' with #5 rebar at 12" OC. Rite-Hite FRH hydraulic leveler requires 8''-6"x7''-6" pit with minimum 8" walls and #5 at 8" OC. 14 pits total. Please confirm revised dimensions.', NULL),
(1, 'RFI-022', 'Exterior stone veneer anchorage at precast spandrel panels', 'open', 'critical', 'Gensler', 'Performance Contracting', '2025-05-08', '2025-05-18', NULL, NULL, 'Drawing A-810 shows adhesive-anchored stone veneer clips at 24" OC on precast spandrel panels. ASTM C1242 and local wind load analysis (120 mph design wind) suggest mechanical anchors at 16" OC may be required. Please provide structural analysis confirming anchorage method and spacing.', NULL),
(2, 'RFI-023', 'Platform edge door system integration with signal system', 'open', 'normal', 'AECOM', 'Parsons Corporation', '2025-05-28', '2025-06-11', NULL, NULL, 'Platform edge door (PED) system at Stations 1-4 requires integration with CBTC signal system. Interface control document ICD-042 does not address PED interlock timing requirements. Please confirm signal system handshake protocol and dwell time parameters.', NULL),
(3, 'RFI-024', 'Nurse call system head-end equipment room allocation', 'open', 'normal', 'HDR', 'Rosendin Electric', '2025-05-30', '2025-06-13', NULL, NULL, 'Spec Section 27 52 23 specifies Rauland Responder 5 nurse call system. Room 1-045 designated as head-end room on drawing E-100 is 80 SF. Rauland requires minimum 120 SF with dedicated HVAC and UPS power. Please identify adequate room or approve room expansion.', NULL),
(1, 'RFI-025', 'High-rise window washing davit anchorage locations', 'open', 'normal', 'Gensler', 'Turner Construction', '2025-06-01', '2025-06-15', NULL, NULL, 'Roof plan R-101 shows window washing davit sockets at 30'' OC along parapet. Building maintenance unit (BMU) supplier requires 25'' maximum spacing with reinforced parapet at each location. 42 davit locations total. Please confirm structural reinforcement at each socket and revised spacing.', NULL),
(2, 'RFI-026', 'Noise wall design - residential adjacency at STA 185+00', 'closed', 'normal', 'AECOM - Acoustical', 'Kiewit Infrastructure', '2025-03-10', '2025-03-24', '2025-03-21', 11, 'Noise study (Report NS-2024-087) recommends 12'' noise wall at residential adjacency STA 185+00 to 189+00. Drawing NW-301 shows 8'' CMU wall. Please confirm wall height and construction type to meet 67 dBA threshold at nearest residence.', 'Wall height increased to 14'' with absorptive face panels. See revised NW-301R1 and structural detail NW-D01. Foundation revised to drilled piers at 10'' OC due to expansive soils.'),
(3, 'RFI-027', 'Operating room surgical light ceiling reinforcement', 'open', 'urgent', 'HDR - Structural', 'Skanska USA', '2025-06-02', '2025-06-12', NULL, NULL, 'Drawing S-401 shows standard metal deck ceiling at OR suites. Surgical light manufacturer (Stryker) requires structural steel support capable of 1,500 lb point load at each of 8 operating rooms. Existing ceiling framing is W12x19. Please provide supplemental framing details.', NULL),
(1, 'RFI-028', 'Lobby feature wall stone cladding - seismic anchorage', 'open', 'normal', 'Gensler - Interior', 'Turner Construction', '2025-06-05', '2025-06-19', NULL, NULL, 'Drawing ID-101 shows 2" thick Calacatta marble panels (up to 4''x8'') on lobby feature wall. Seismic Design Category D requires mechanical anchorage per IBC 2021 Section 2114. Please provide anchorage detail and confirm stone panel reinforcement (rodding/netting) requirements.', NULL),
(4, 'RFI-029', 'Garage ventilation CO/NO2 sensor locations and controls', 'closed', 'normal', 'Arquitectonica - MEP', 'Piedmont Electrical', '2025-04-08', '2025-04-22', '2025-04-18', 10, 'Drawing M-P01 shows CO sensors only in parking garage. IMC 2021 Section 404 requires CO and NO2 detection for enclosed parking. Drawing does not show sensor locations or fan control sequence. Please provide sensor layout and controls narrative.', 'Sensor layout added to M-P01R1. CO sensors at 5'' AFF max, NO2 at breathing zone. Dual setpoint control: 25 PPM CO activates 50% fan speed, 35 PPM activates 100%. See controls sequence M-P01-SEQ-01.'),
(5, 'RFI-030', 'Slab-on-grade vapor barrier at cold storage areas', 'open', 'normal', 'DLR Group', 'Sundt Construction', '2025-05-20', '2025-06-03', NULL, NULL, 'Cold storage areas (Rooms 107-110) show standard 15-mil vapor barrier per detail S-001. Cold storage at 35°F requires insulated slab assembly with sub-slab heating to prevent frost heave. Spec Section 07 26 00 does not address sub-slab insulation or heating. Please provide revised slab assembly detail.', NULL),
(1, 'RFI-031', 'Tower crane foundation removal and infill detail', 'open', 'urgent', 'Gensler - Structural', 'Turner Construction', '2025-06-08', '2025-06-18', NULL, NULL, 'Tower crane (Liebherr 710 HC-L) foundation at gridline F-9 extends 14'' below grade. Drawing S-F01 shows mat foundation but does not address crane foundation removal sequence or infill detail. Crane disassembly scheduled for August 2025. Please provide removal and infill specification.', NULL),
(2, 'RFI-032', 'Traction power substation grounding grid design', 'open', 'critical', 'AECOM - Electrical', 'Siemens Mobility', '2025-06-10', '2025-06-20', NULL, NULL, 'Traction power substation TPSS-3 grounding grid shown on drawing E-601 indicates 4/0 bare copper at 10''x10'' grid. IEEE Std 80-2013 analysis for 12kA fault current indicates step and touch potentials exceed safe limits. Request revised grounding grid design with reduced grid spacing or ground enhancement material.', NULL);

-- ============================================================================
-- SUBMITTALS
-- ============================================================================
CREATE TABLE submittals (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES projects(id),
    number VARCHAR(30) NOT NULL,
    title VARCHAR(300),
    spec_section VARCHAR(20),
    status VARCHAR(15) CHECK (status IN ('pending','approved','rejected','resubmit')),
    submitted_by VARCHAR(150),
    reviewer VARCHAR(150),
    submitted_date DATE,
    due_date DATE,
    approved_date DATE
);

INSERT INTO submittals (project_id, number, title, spec_section, status, submitted_by, reviewer, submitted_date, due_date, approved_date) VALUES
-- Riverside Tower
(1, 'SUB-001', 'Structural Steel Shop Drawings - Levels 1-5', '05 12 00', 'approved', 'Turner Construction', 'Gensler - Structural', '2024-12-15', '2025-01-15', '2025-01-10'),
(1, 'SUB-002', 'Curtain Wall System - Kawneer Trifab 601', '08 44 00', 'approved', 'Turner Construction', 'Gensler - Envelope', '2025-01-08', '2025-02-07', '2025-02-04'),
(1, 'SUB-003', 'Elevator Equipment - Schindler 5500', '14 21 00', 'approved', 'Schindler Elevator Corp', 'Gensler', '2025-01-20', '2025-02-19', '2025-02-15'),
(1, 'SUB-004', 'Concrete Mix Design - 8000 PSI High-Strength', '03 30 00', 'approved', 'Baker Concrete', 'Gensler - Structural', '2024-11-20', '2024-12-20', '2024-12-18'),
(1, 'SUB-005', 'HVAC Variable Refrigerant Flow System - Daikin VRV IV', '23 81 26', 'resubmit', 'Comfort Systems USA', 'Gensler - Mechanical', '2025-04-15', '2025-05-15', NULL),
(1, 'SUB-006', 'Fire Alarm Control Panel - EST4 Life Safety Platform', '28 31 00', 'pending', 'Consolidated Electrical', 'Gensler - Fire Protection', '2025-05-20', '2025-06-19', NULL),
-- Metro Line
(2, 'SUB-007', 'Precast Segmental Tunnel Lining - Segment Shop Drawings', '03 40 00', 'approved', 'Kiewit Infrastructure', 'AECOM', '2024-08-10', '2024-09-09', '2024-09-05'),
(2, 'SUB-008', 'Track Fastening System - Pandrol e-Clip', '34 11 23', 'approved', 'Granite Construction', 'AECOM - Rail', '2025-01-15', '2025-02-14', '2025-02-10'),
(2, 'SUB-009', 'CBTC Signal System - Siemens Trainguard MT', '34 42 13', 'pending', 'Siemens Mobility', 'AECOM - Systems', '2025-05-01', '2025-05-31', NULL),
(2, 'SUB-010', 'Overhead Catenary System - Furrer+Frey SiFCAT', '34 43 00', 'pending', 'Siemens Mobility', 'AECOM - Electrical', '2025-05-15', '2025-06-14', NULL),
(2, 'SUB-011', 'Station Platform Screen Doors - Faiveley Transport', '34 71 00', 'resubmit', 'Parsons Corporation', 'AECOM', '2025-03-20', '2025-04-19', NULL),
(2, 'SUB-012', 'Reinforcing Steel - ASTM A615 Grade 60 Mill Certs', '03 20 00', 'approved', 'Nucor Rebar', 'AECOM - Structural', '2024-07-15', '2024-08-14', '2024-08-10'),
-- Harborview Medical
(3, 'SUB-013', 'Medical Gas Piping System - BeaconMedaes', '22 63 00', 'approved', 'Southland Industries', 'HDR - Mechanical', '2025-02-01', '2025-03-03', '2025-02-28'),
(3, 'SUB-014', 'MRI Suite RF Shielding - ETS-Lindgren', '13 49 21', 'approved', 'Rosendin Electric', 'HDR - Radiology', '2025-01-10', '2025-02-09', '2025-02-05'),
(3, 'SUB-015', 'Operating Room Surgical Lights - Stryker Visum II', '11 62 00', 'pending', 'Skanska USA', 'HDR - Medical Equipment', '2025-05-25', '2025-06-24', NULL),
(3, 'SUB-016', 'Nurse Call System - Rauland Responder 5', '27 52 23', 'pending', 'Rosendin Electric', 'HDR', '2025-05-28', '2025-06-27', NULL),
(3, 'SUB-017', 'Radiation Therapy Vault Concrete - Barium Aggregate Mix', '03 30 53', 'approved', 'Skanska USA', 'HDR - Radiation Safety', '2025-02-15', '2025-03-17', '2025-03-12'),
(3, 'SUB-018', 'HEPA Filtration System - Camfil Megalam', '23 40 00', 'approved', 'Southland Industries', 'HDR - Mechanical', '2025-03-10', '2025-04-09', '2025-04-05'),
-- Pinnacle Residences
(4, 'SUB-019', 'Post-Tensioning System - VSL Bonded PT', '03 38 00', 'approved', 'Holder Construction', 'Arquitectonica', '2025-02-20', '2025-03-22', '2025-03-18'),
(4, 'SUB-020', 'Aluminum Window System - Pella Architect Series', '08 51 13', 'resubmit', 'Brasfield & Gorrie', 'Arquitectonica', '2025-04-01', '2025-05-01', NULL),
(4, 'SUB-021', 'Pool Waterproofing - Laticrete Hydro Ban', '07 16 00', 'pending', 'Brasfield & Gorrie', 'Arquitectonica', '2025-05-15', '2025-06-14', NULL),
(4, 'SUB-022', 'Residential Appliance Package - Sub-Zero/Wolf', '11 31 00', 'pending', 'Choate Construction', 'Arquitectonica', '2025-06-01', '2025-07-01', NULL),
-- Westfield Logistics
(5, 'SUB-023', 'Tilt-Up Concrete Panel Shop Drawings', '03 45 00', 'approved', 'Sundt Construction', 'DLR Group', '2025-03-01', '2025-03-31', '2025-03-28'),
(5, 'SUB-024', 'Dock Levelers - Rite-Hite FRH Hydraulic', '11 16 00', 'pending', 'Sundt Construction', 'DLR Group', '2025-05-20', '2025-06-19', NULL),
(5, 'SUB-025', 'ESFR Sprinkler System - Viking K25.2', '21 13 13', 'pending', 'Southwest Gas Systems', 'DLR Group', '2025-05-30', '2025-06-29', NULL),
(5, 'SUB-026', 'Insulated Metal Panels - Kingspan KS1000 RW', '07 42 43', 'approved', 'Kingspan Panels', 'DLR Group', '2025-03-15', '2025-04-14', '2025-04-10'),
(5, 'SUB-027', 'LED High-Bay Lighting - Acuity Lithonia IBG', '26 51 00', 'rejected', 'Desert Electric Co.', 'DLR Group', '2025-04-20', '2025-05-20', NULL);

-- ============================================================================
-- BUDGET LINE ITEMS
-- ============================================================================
CREATE TABLE budget_line_items (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES projects(id),
    cost_code VARCHAR(20),
    description VARCHAR(200),
    original_budget NUMERIC(12,2),
    approved_changes NUMERIC(12,2),
    revised_budget NUMERIC(12,2),
    committed_costs NUMERIC(12,2),
    actual_costs NUMERIC(12,2),
    projected_final NUMERIC(12,2),
    variance NUMERIC(12,2),
    variance_percent NUMERIC(6,2)
);

INSERT INTO budget_line_items (project_id, cost_code, description, original_budget, approved_changes, revised_budget, committed_costs, actual_costs, projected_final, variance, variance_percent) VALUES
-- Riverside Tower (project 1) - $87.5M
(1, '01-0000', 'General Conditions', 5250000.00, 125000.00, 5375000.00, 5375000.00, 3225000.00, 5500000.00, -125000.00, -2.33),
(1, '02-0000', 'Site Work & Demolition', 2100000.00, 0.00, 2100000.00, 2050000.00, 1890000.00, 2050000.00, 50000.00, 2.38),
(1, '03-0000', 'Concrete', 8200000.00, 450000.00, 8650000.00, 8650000.00, 7350000.00, 9100000.00, -450000.00, -5.20),
(1, '04-0000', 'Masonry', 1200000.00, 0.00, 1200000.00, 1150000.00, 680000.00, 1150000.00, 50000.00, 4.17),
(1, '05-0000', 'Structural Steel & Metals', 9800000.00, 320000.00, 10120000.00, 10120000.00, 8096000.00, 10250000.00, -130000.00, -1.28),
(1, '06-0000', 'Wood, Plastics & Composites', 850000.00, 0.00, 850000.00, 820000.00, 410000.00, 820000.00, 30000.00, 3.53),
(1, '07-0000', 'Thermal & Moisture Protection', 3400000.00, 85000.00, 3485000.00, 3485000.00, 2092000.00, 3485000.00, 0.00, 0.00),
(1, '08-0000', 'Openings (Doors, Windows, Curtainwall)', 7200000.00, 0.00, 7200000.00, 7100000.00, 3550000.00, 7100000.00, 100000.00, 1.39),
(1, '09-0000', 'Finishes', 4800000.00, 0.00, 4800000.00, 4600000.00, 1380000.00, 4700000.00, 100000.00, 2.08),
(1, '10-0000', 'Specialties', 620000.00, 0.00, 620000.00, 590000.00, 118000.00, 590000.00, 30000.00, 4.84),
(1, '14-0000', 'Conveying Equipment (Elevators)', 3200000.00, 0.00, 3200000.00, 3200000.00, 960000.00, 3200000.00, 0.00, 0.00),
(1, '21-0000', 'Fire Suppression', 1800000.00, 0.00, 1800000.00, 1750000.00, 525000.00, 1750000.00, 50000.00, 2.78),
(1, '22-0000', 'Plumbing', 3100000.00, 0.00, 3100000.00, 3050000.00, 1220000.00, 3100000.00, 0.00, 0.00),
(1, '23-0000', 'HVAC', 5400000.00, 280000.00, 5680000.00, 5680000.00, 2272000.00, 5900000.00, -220000.00, -3.87),
(1, '26-0000', 'Electrical', 8750000.00, 625000.00, 9375000.00, 9375000.00, 3750000.00, 9800000.00, -425000.00, -4.53),
(1, '27-0000', 'Communications', 1400000.00, 0.00, 1400000.00, 1350000.00, 405000.00, 1350000.00, 50000.00, 3.57),
(1, '28-0000', 'Electronic Safety & Security', 950000.00, 0.00, 950000.00, 920000.00, 276000.00, 920000.00, 30000.00, 3.16),
(1, '31-0000', 'Earthwork', 1900000.00, 0.00, 1900000.00, 1850000.00, 1757500.00, 1850000.00, 50000.00, 2.63),
-- Metro Line (project 2) - $245M
(2, '01-0000', 'General Conditions & Project Management', 18000000.00, 1200000.00, 19200000.00, 19200000.00, 13440000.00, 20000000.00, -800000.00, -4.17),
(2, '02-0000', 'Existing Conditions & Demolition', 8500000.00, 0.00, 8500000.00, 8200000.00, 7790000.00, 8200000.00, 300000.00, 3.53),
(2, '03-0000', 'Concrete (Stations, Guideway, Tunnel)', 42000000.00, 2800000.00, 44800000.00, 44800000.00, 33600000.00, 46500000.00, -1700000.00, -3.79),
(2, '05-0000', 'Structural Steel & Metals', 18500000.00, 0.00, 18500000.00, 18500000.00, 11100000.00, 18800000.00, -300000.00, -1.62),
(2, '31-0000', 'Earthwork & Tunneling', 38000000.00, 3500000.00, 41500000.00, 41500000.00, 33200000.00, 43000000.00, -1500000.00, -3.61),
(2, '32-0000', 'Exterior Improvements (Track & Ballast)', 22000000.00, 0.00, 22000000.00, 21500000.00, 12900000.00, 21500000.00, 500000.00, 2.27),
(2, '33-0000', 'Utilities', 9500000.00, 800000.00, 10300000.00, 10300000.00, 6180000.00, 10800000.00, -500000.00, -4.85),
(2, '34-0000', 'Rail Systems (Signal, OCS, Traction Power)', 45000000.00, 0.00, 45000000.00, 43000000.00, 12900000.00, 44000000.00, 1000000.00, 2.22),
(2, '26-0000', 'Electrical (Station Power, Lighting)', 15000000.00, 600000.00, 15600000.00, 15600000.00, 7800000.00, 16200000.00, -600000.00, -3.85),
(2, '09-0000', 'Station Finishes', 8000000.00, 0.00, 8000000.00, 7500000.00, 2250000.00, 7500000.00, 500000.00, 6.25),
-- Harborview Medical (project 3) - $156M
(3, '01-0000', 'General Conditions', 10200000.00, 450000.00, 10650000.00, 10650000.00, 6390000.00, 10900000.00, -250000.00, -2.35),
(3, '03-0000', 'Concrete', 12500000.00, 800000.00, 13300000.00, 13300000.00, 9310000.00, 13800000.00, -500000.00, -3.76),
(3, '05-0000', 'Structural Steel', 8200000.00, 0.00, 8200000.00, 8000000.00, 5600000.00, 8000000.00, 200000.00, 2.44),
(3, '07-0000', 'Thermal & Moisture Protection', 5100000.00, 0.00, 5100000.00, 4950000.00, 2475000.00, 4950000.00, 150000.00, 2.94),
(3, '08-0000', 'Openings', 4200000.00, 0.00, 4200000.00, 4100000.00, 2050000.00, 4100000.00, 100000.00, 2.38),
(3, '09-0000', 'Finishes (Healthcare-Grade)', 6800000.00, 0.00, 6800000.00, 6500000.00, 1950000.00, 6500000.00, 300000.00, 4.41),
(3, '11-0000', 'Medical Equipment', 18000000.00, 1200000.00, 19200000.00, 19200000.00, 5760000.00, 19500000.00, -300000.00, -1.56),
(3, '13-0000', 'Special Construction (Shielding, Clean Rooms)', 8500000.00, 600000.00, 9100000.00, 9100000.00, 4550000.00, 9400000.00, -300000.00, -3.30),
(3, '22-0000', 'Plumbing & Medical Gas', 7800000.00, 0.00, 7800000.00, 7600000.00, 3040000.00, 7600000.00, 200000.00, 2.56),
(3, '23-0000', 'HVAC (Healthcare)', 14200000.00, 950000.00, 15150000.00, 15150000.00, 6060000.00, 15800000.00, -650000.00, -4.29),
(3, '26-0000', 'Electrical', 11800000.00, 500000.00, 12300000.00, 12300000.00, 4920000.00, 12800000.00, -500000.00, -4.07),
(3, '27-0000', 'Communications & Nurse Call', 3200000.00, 0.00, 3200000.00, 3100000.00, 930000.00, 3100000.00, 100000.00, 3.13),
(3, '28-0000', 'Fire Alarm & Life Safety', 2800000.00, 0.00, 2800000.00, 2750000.00, 825000.00, 2750000.00, 50000.00, 1.79),
-- Pinnacle Residences (project 4) - $62M
(4, '01-0000', 'General Conditions', 3720000.00, 100000.00, 3820000.00, 3820000.00, 1528000.00, 3900000.00, -80000.00, -2.09),
(4, '03-0000', 'Concrete & Post-Tensioning', 7200000.00, 350000.00, 7550000.00, 7550000.00, 3020000.00, 7800000.00, -250000.00, -3.31),
(4, '05-0000', 'Structural Steel', 5100000.00, 0.00, 5100000.00, 5100000.00, 2040000.00, 5200000.00, -100000.00, -1.96),
(4, '07-0000', 'Waterproofing & Roofing', 2400000.00, 0.00, 2400000.00, 2300000.00, 690000.00, 2300000.00, 100000.00, 4.17),
(4, '08-0000', 'Windows & Doors', 4200000.00, 0.00, 4200000.00, 4050000.00, 810000.00, 4050000.00, 150000.00, 3.57),
(4, '09-0000', 'Interior Finishes', 5500000.00, 0.00, 5500000.00, 5200000.00, 1040000.00, 5200000.00, 300000.00, 5.45),
(4, '11-0000', 'Residential Equipment & Appliances', 2200000.00, 0.00, 2200000.00, 2100000.00, 0.00, 2100000.00, 100000.00, 4.55),
(4, '22-0000', 'Plumbing', 3800000.00, 0.00, 3800000.00, 3700000.00, 1110000.00, 3750000.00, 50000.00, 1.32),
(4, '23-0000', 'HVAC', 4800000.00, 200000.00, 5000000.00, 5000000.00, 1500000.00, 5100000.00, -100000.00, -2.00),
(4, '26-0000', 'Electrical', 3900000.00, 180000.00, 4080000.00, 4080000.00, 1224000.00, 4200000.00, -120000.00, -2.94),
(4, '31-0000', 'Earthwork & Foundations', 2800000.00, 0.00, 2800000.00, 2750000.00, 2612500.00, 2750000.00, 50000.00, 1.79),
(4, '32-0000', 'Exterior Improvements & Landscaping', 1800000.00, 0.00, 1800000.00, 1700000.00, 0.00, 1700000.00, 100000.00, 5.56),
-- Westfield Logistics (project 5) - $41.5M
(5, '01-0000', 'General Conditions', 2490000.00, 80000.00, 2570000.00, 2570000.00, 771000.00, 2600000.00, -30000.00, -1.17),
(5, '02-0000', 'Site Work & Grading', 3200000.00, 0.00, 3200000.00, 3100000.00, 2170000.00, 3100000.00, 100000.00, 3.13),
(5, '03-0000', 'Concrete & Tilt-Up Panels', 6800000.00, 250000.00, 7050000.00, 7050000.00, 2820000.00, 7200000.00, -150000.00, -2.13),
(5, '05-0000', 'Structural Steel', 4500000.00, 0.00, 4500000.00, 4350000.00, 1305000.00, 4350000.00, 150000.00, 3.33),
(5, '07-0000', 'Insulated Metal Panels & Roofing', 4500000.00, 0.00, 4500000.00, 4500000.00, 1350000.00, 4500000.00, 0.00, 0.00),
(5, '21-0000', 'Fire Suppression (ESFR)', 2800000.00, 0.00, 2800000.00, 2700000.00, 810000.00, 2700000.00, 100000.00, 3.57),
(5, '22-0000', 'Plumbing', 2400000.00, 0.00, 2400000.00, 2350000.00, 705000.00, 2350000.00, 50000.00, 2.08),
(5, '23-0000', 'HVAC', 1800000.00, 0.00, 1800000.00, 1750000.00, 525000.00, 1750000.00, 50000.00, 2.78),
(5, '26-0000', 'Electrical & Lighting', 3100000.00, 120000.00, 3220000.00, 3220000.00, 966000.00, 3350000.00, -130000.00, -4.04),
(5, '31-0000', 'Earthwork', 2400000.00, 0.00, 2400000.00, 2300000.00, 2185000.00, 2300000.00, 100000.00, 4.17),
(5, '32-0000', 'Paving & Site Concrete', 3500000.00, 0.00, 3500000.00, 3400000.00, 1020000.00, 3400000.00, 100000.00, 2.86);

-- ============================================================================
-- CHANGE ORDERS
-- ============================================================================
CREATE TABLE change_orders (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES projects(id),
    number VARCHAR(20) NOT NULL,
    title VARCHAR(300),
    description TEXT,
    amount NUMERIC(12,2),
    status VARCHAR(15) CHECK (status IN ('pending','approved','rejected')),
    submitted_date DATE,
    approved_date DATE,
    reason VARCHAR(30) CHECK (reason IN ('owner_change','design_error','unforeseen_condition','value_engineering','code_compliance','schedule_acceleration'))
);

INSERT INTO change_orders (project_id, number, title, description, amount, status, submitted_date, approved_date, reason) VALUES
-- Riverside Tower
(1, 'CO-001', 'Level 12 Transfer Beam Redesign', 'Structural redesign of transfer beam at Level 12 due to MEP coordination conflict. Includes additional steel tonnage and revised connection details per RFI-001.', 320000.00, 'approved', '2025-02-01', '2025-02-15', 'design_error'),
(1, 'CO-002', 'Concrete Mix Upgrade - Parking Levels', 'Owner-directed upgrade from 5000 PSI to 6000 PSI concrete at parking levels P1-P3 for enhanced durability. Includes corrosion inhibitor admixture.', 450000.00, 'approved', '2025-02-20', '2025-03-05', 'owner_change'),
(1, 'CO-003', 'VRF System Capacity Increase - Penthouse', 'Increase VRF capacity from 40-ton to 55-ton system at penthouse level per revised load calculations. Includes additional condensing units on roof.', 280000.00, 'approved', '2025-04-01', '2025-04-15', 'design_error'),
(1, 'CO-004', 'Electrical Service Upgrade - 4000A to 5000A', 'Upgrade main electrical service from 4000A to 5000A switchgear to accommodate added VRF load and EV charging infrastructure per owner request.', 625000.00, 'approved', '2025-04-10', '2025-04-28', 'owner_change'),
(1, 'CO-005', 'Unforeseen Rock Excavation - Foundation', 'Encountered granite bedrock at elevation 672'', 8'' above design bottom of excavation. Required rock removal across 4,200 SF of foundation area.', 185000.00, 'approved', '2025-01-15', '2025-01-30', 'unforeseen_condition'),
(1, 'CO-006', 'Exterior Stone Veneer - Value Engineering', 'Substitute limestone panels with pre-finished architectural precast at Levels 2-5. Net savings after re-engineering connections.', -240000.00, 'approved', '2025-03-15', '2025-03-30', 'value_engineering'),
-- Metro Line
(2, 'CO-007', 'Tunnel Launch Pit Stabilization', 'Secant pile wall with jet grouting at Station 42+00 due to unexpected high water table and inadequate clay layer for sheet pile toe embedment. Per RFI-007.', 3500000.00, 'approved', '2024-12-01', '2024-12-20', 'unforeseen_condition'),
(2, 'CO-008', 'Utility Relocation - 36" Storm Drain', 'Relocation of existing 36" RCP storm drain at STA 203+00 to accommodate OCS pole foundations. Includes temporary bypass pumping.', 800000.00, 'pending', '2025-05-10', NULL, 'unforeseen_condition'),
(2, 'CO-009', 'Station 3 Platform Extension', 'Owner-directed platform extension from 300'' to 400'' to accommodate future 6-car trains. Includes additional canopy and PED system extension.', 4200000.00, 'approved', '2025-01-20', '2025-02-15', 'owner_change'),
(2, 'CO-010', 'Noise Wall Height Increase', 'Increase noise wall from 8'' CMU to 14'' with absorptive panels at residential adjacency STA 185+00 to 189+00 per acoustical analysis.', 1200000.00, 'approved', '2025-03-25', '2025-04-10', 'code_compliance'),
-- Harborview Medical
(3, 'CO-011', 'Radiation Vault Wall Thickness Increase', 'Increase primary barrier thickness from 7'' to 8'' at LinAc vault per revised shielding calculations for upgraded TrueBeam 2.0 equipment.', 600000.00, 'approved', '2025-02-10', '2025-02-28', 'design_error'),
(3, 'CO-012', 'Medical Gas System Expansion', 'Add nitrogen and medical air distribution to second floor endoscopy suite per revised medical planning. Includes zone valves, alarms, and manifold.', 450000.00, 'approved', '2025-03-20', '2025-04-05', 'owner_change'),
(3, 'CO-013', 'HVAC Air Change Rate Upgrade - Cath Labs', 'Upgrade AHU-4 from 15 ACH to 20 ACH capacity for cardiac catheterization labs per updated ASHRAE 170-2021 requirements. Includes larger ductwork.', 950000.00, 'pending', '2025-05-15', NULL, 'code_compliance'),
(3, 'CO-014', 'Emergency Generator Fuel Storage Upgrade', 'Upgrade from single-wall to double-wall UST with interstitial monitoring per Washington State DOE requirements. Includes monitoring piping and controls.', 280000.00, 'approved', '2025-04-15', '2025-04-30', 'code_compliance'),
-- Pinnacle Residences
(4, 'CO-015', 'Pool Deck Structural Reinforcement', 'Reinforce Level 7 transfer beam and add post-tensioning for rooftop pool dead load (281 PSF). Includes temporary shoring at Level 6.', 350000.00, 'approved', '2025-04-25', '2025-05-10', 'design_error'),
(4, 'CO-016', 'Kitchen Exhaust Shaft Enlargement', 'Enlarge exhaust shaft from 36"x20" to 48"x30" through residential floors. Includes acoustical liner and revision to Unit 2C layout.', 180000.00, 'approved', '2025-04-01', '2025-04-15', 'design_error'),
(4, 'CO-017', 'EV Charging Infrastructure - All Parking Levels', 'Owner-directed addition of 120 Level 2 EV charging stations across all parking levels with electrical infrastructure for future DCFC.', 420000.00, 'pending', '2025-05-20', NULL, 'owner_change'),
-- Westfield Logistics
(5, 'CO-018', 'Cold Storage Sub-Slab Heating System', 'Add sub-slab insulation and glycol heating system at cold storage areas (Rooms 107-110) to prevent frost heave. Not included in original design.', 250000.00, 'pending', '2025-05-25', NULL, 'design_error'),
(5, 'CO-019', 'Schedule Acceleration - Steel Erection', 'Overtime premium and additional crane for accelerated steel erection to recover 3 weeks of schedule delay from site work phase.', 380000.00, 'pending', '2025-06-01', NULL, 'schedule_acceleration');

-- ============================================================================
-- DAILY LOGS
-- ============================================================================
CREATE TABLE daily_logs (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES projects(id),
    log_date DATE,
    weather VARCHAR(50),
    temperature_high INTEGER,
    temperature_low INTEGER,
    workforce_count INTEGER,
    superintendent VARCHAR(150),
    notes TEXT,
    delays TEXT,
    safety_incidents INTEGER DEFAULT 0
);

INSERT INTO daily_logs (project_id, log_date, weather, temperature_high, temperature_low, workforce_count, superintendent, notes, delays, safety_incidents) VALUES
-- Riverside Tower
(1, '2025-06-02', 'Sunny', 94, 72, 187, 'Frank DeLuca', 'Structural steel erection Level 9-10 proceeding. Curtain wall installation Levels 3-5 south facade. MEP rough-in Levels 5-7 ongoing. Concrete pour Level 8 deck scheduled for Thursday. Tower crane operating at 85% capacity.', NULL, 0),
(1, '2025-06-03', 'Partly Cloudy', 91, 70, 194, 'Frank DeLuca', 'Steel erection Level 10 completed ahead of schedule. Curtain wall crew achieving 15 panels/day target. Elevator shaft work progressing on schedule. Received approved submittal for fire alarm system.', NULL, 0),
(1, '2025-06-04', 'Thunderstorms', 85, 68, 142, 'Frank DeLuca', 'Lightning delay from 10:30 AM to 1:45 PM - all crane operations suspended. Tower crane operators resumed at 2:00 PM. Lost 3.5 hours of steel erection. Curtain wall crew worked interior prep during delay. Minor ponding on Level 8 deck.', 'Lightning delay - 3.5 hours lost on crane operations. Concrete pour postponed to Monday.', 0),
(1, '2025-06-05', 'Sunny', 96, 73, 201, 'Frank DeLuca', 'Full crew mobilized. Making up for yesterday''s delay. Steel erection Level 10-11 connection work. Fireproofing crew started Level 6. Electrical rough-in Level 5 east wing. Safety inspection by Turner corporate - no findings.', NULL, 0),
(1, '2025-06-06', 'Sunny', 98, 75, 208, 'Frank DeLuca', 'Heat advisory in effect. Mandatory water breaks every 30 minutes per Turner safety protocol. Steel erection slowed to 85% production. One worker treated for heat exhaustion at 2:15 PM - released after observation. HVAC ductwork Level 6 started.', 'Heat advisory - reduced production approximately 15%', 1),
(1, '2025-06-09', 'Sunny', 92, 71, 212, 'Frank DeLuca', 'Concrete pour Level 8 deck - 480 CY placed successfully. 12 trucks, pumping from south side. No cold joints. Test cylinders taken per spec. Steel Level 11 erection ongoing. Curtain wall Levels 4-5 south facade complete.', NULL, 0),
-- Metro Line
(2, '2025-06-02', 'Clear', 82, 55, 342, 'Maria Gonzalez', 'Tunnel boring at STA 165+00 - TBM averaging 42 feet/day. Station 2 mezzanine concrete placement. Track installation at Station 1 platform complete. OCS pole foundation drilling at STA 195+00 to 200+00. Utility relocation crew at STA 178+00 continuing potholing.', NULL, 0),
(2, '2025-06-03', 'Clear', 79, 52, 338, 'Maria Gonzalez', 'TBM advanced to STA 165+42. Encountered mixed face conditions - clay over sandstone. Slowed advance to 35 ft/day for face pressure management. Station 2 formwork for concourse level. Signal system conduit installation Station 1.', 'TBM mixed face conditions - reduced advance rate', 0),
(2, '2025-06-04', 'Partly Cloudy', 76, 50, 351, 'Maria Gonzalez', 'TBM resumed normal operations at 40 ft/day. Track ballast placement between Station 1 and Station 2. Noise wall construction at STA 185+00 - 6 panels installed. Traction power substation TPSS-2 equipment delivery received. Safety stand-down for near-miss at excavation face - worker entered exclusion zone.', NULL, 1),
(2, '2025-06-05', 'Clear', 84, 56, 355, 'Maria Gonzalez', 'TBM at STA 166+22. Station 3 platform excavation ongoing - 2,400 CY removed. OCS pole foundations complete STA 195+00 to 198+00. AT&T fiber optic relocation design meeting - 16 week timeline confirmed. TPSS-2 transformer pad poured.', 'AT&T relocation timeline 16 weeks - potential schedule impact to OCS in Zone 4', 0),
(2, '2025-06-06', 'Thunderstorms', 72, 48, 280, 'Maria Gonzalez', 'Rain delay from 6:00 AM to 10:00 AM. Tunneling operations unaffected (underground). Surface work delayed - no concrete pours. Track work resumed at 10:30 AM. Station 2 waterproofing membrane installation postponed. 62 workers sent home early.', 'Rain delay - 4 hours lost on surface operations', 0),
-- Harborview Medical
(3, '2025-06-02', 'Overcast', 64, 52, 267, 'James Whitfield', 'Structural steel Level 4 erection continuing. Radiation vault concrete placement - Phase 2 walls (8" thick per CO-011). MEP risers in main vertical chase floors 1-3. Clean room framing started at Cath Lab suite. Infection control barriers maintained per ICRA requirements.', NULL, 0),
(3, '2025-06-03', 'Rain', 58, 48, 245, 'James Whitfield', 'Exterior work reduced due to rain. Interior rough-in continued. MRI suite RF shielding installation - Room 2-108 copper panels 60% complete. Medical gas piping Level 2 endoscopy suite. Fire stopping at rated penetrations Level 1. Environmental monitoring showing acceptable particulate levels in occupied hospital areas.', 'Light rain - exterior steel erection paused for 2 hours in morning', 0),
(3, '2025-06-04', 'Overcast', 62, 50, 271, 'James Whitfield', 'Full operations resumed. Steel Level 4 complete - topping out ceremony next week. OR suite rough-in framing started Level 3. Emergency generator foundation work started per revised detail (CO-014). Medical gas certification testing Level 1 zones - all passed initial test.', NULL, 0),
(3, '2025-06-05', 'Partly Sunny', 66, 53, 278, 'James Whitfield', 'Curtain wall installation east facade started. Interior stud framing Level 2 north wing. Electrical panel installation Level 1. UPS system for critical care areas delivered. MRI suite shielding 85% complete. Coordination meeting with UW Medicine facilities team - discussed phasing of equipment deliveries.', NULL, 0),
-- Pinnacle Residences
(4, '2025-06-02', 'Sunny', 88, 68, 156, 'Carlos Mendez', 'Post-tensioning Level 3 completed - stressing operations verified by engineer. Structural steel Level 4 columns erected. Plumbing rough-in Level 2 residential units. Tower crane booked at 100% today. Formwork Level 4 deck started.', NULL, 0),
(4, '2025-06-03', 'Sunny', 91, 70, 163, 'Carlos Mendez', 'Formwork Level 4 deck 40% complete. Rebar placement Level 4 columns. Electrical panel boards delivered for Levels 1-3. Window rough openings framed Level 2. Mock-up unit (Unit 2A) - finishes selection meeting with Hines team.', NULL, 0),
(4, '2025-06-04', 'Thunderstorms', 82, 65, 118, 'Carlos Mendez', 'Severe weather - all exterior work stopped at 11:00 AM. Tower crane weathervaned. Interior work continued on Levels 1-2. Plumbing and electrical rough-in. Afternoon - inspected formwork Level 4 for damage. Minor formwork displacement at gridline C - reset by crew.', 'Severe weather - 5 hours lost on exterior operations', 0),
(4, '2025-06-05', 'Partly Cloudy', 86, 67, 159, 'Carlos Mendez', 'Formwork Level 4 deck resumed - now 65% complete. Building inspector on site for Level 2 framing inspection - approved with minor corrections to fire blocking. HVAC contractor mobilized for Level 2 ductwork. Safety audit by Brasfield corporate - one finding: missing guardrail at stair opening Level 3, corrected immediately.', NULL, 0),
-- Westfield Logistics
(5, '2025-06-02', 'Sunny', 108, 82, 89, 'Steve Nakamura', 'Project on hold per owner directive - limited site maintenance crew only. Tilt-up panel casting beds maintained. Structural steel delivery rescheduled to July pending hold resolution. Site security maintained 24/7. Erosion control measures inspected and functional.', 'Project on hold - owner financing restructuring', 0),
(5, '2025-06-03', 'Sunny', 110, 84, 12, 'Steve Nakamura', 'Skeleton crew for site maintenance. Dust control watering. Equipment maintenance on crane and loader. Reviewed hold status with Prologis PM - expect decision by June 15. Subcontractors notified of continued hold status.', 'Project on hold', 0);

-- ============================================================================
-- PUNCH LIST ITEMS
-- ============================================================================
CREATE TABLE punch_list_items (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES projects(id),
    location VARCHAR(200),
    description TEXT,
    assigned_to VARCHAR(150),
    status VARCHAR(15) CHECK (status IN ('open','in_progress','completed','verified')),
    priority VARCHAR(10) CHECK (priority IN ('low','medium','high','critical')),
    created_date DATE,
    due_date DATE,
    completed_date DATE
);

INSERT INTO punch_list_items (project_id, location, description, assigned_to, status, priority, created_date, due_date, completed_date) VALUES
-- Riverside Tower - Levels 1-5 (nearing finishes)
(1, 'Level 1 - Main Lobby', 'Marble floor tile lippage exceeds 1/32" at grid B-3. Re-level 6 tiles.', 'Turner Construction', 'open', 'high', '2025-05-28', '2025-06-15', NULL),
(1, 'Level 1 - Main Lobby', 'Recessed downlight fixture #12 misaligned 1.5" from ceiling grid pattern.', 'Consolidated Electrical', 'in_progress', 'medium', '2025-05-28', '2025-06-10', NULL),
(1, 'Level 2 - Retail Space A', 'Fire caulk missing at 3 penetrations through 2-hour rated wall at column C-5.', 'Performance Contracting', 'open', 'critical', '2025-05-30', '2025-06-05', NULL),
(1, 'Level 2 - Retail Space A', 'HVAC diffuser supply air pattern hitting occupant zone. Redirect vanes.', 'Comfort Systems USA', 'completed', 'medium', '2025-05-25', '2025-06-08', '2025-06-02'),
(1, 'Level 2 - Retail Space B', 'Storefront door closer speed too fast. Adjust to 5-second closing per ADA.', 'Turner Construction', 'completed', 'high', '2025-05-20', '2025-06-01', '2025-05-28'),
(1, 'Level 3 - Unit 301', 'Kitchen countertop seam visible and not level. Fabricator to re-cut.', 'Turner Construction', 'open', 'medium', '2025-06-01', '2025-06-20', NULL),
(1, 'Level 3 - Unit 302', 'Bathroom exhaust fan noise exceeds 1.5 sones specification. Replace motor.', 'Comfort Systems USA', 'open', 'low', '2025-06-02', '2025-06-25', NULL),
(1, 'Level 3 - Unit 303', 'Baseboard paint touch-up needed - scuff marks from construction traffic.', 'Turner Construction', 'in_progress', 'low', '2025-06-01', '2025-06-15', NULL),
(1, 'Level 3 - Corridor', 'Emergency exit sign at stairwell B not illuminated. Check circuit connection.', 'Consolidated Electrical', 'open', 'critical', '2025-06-03', '2025-06-06', NULL),
(1, 'Level 4 - Unit 401', 'Sliding glass door track binding - does not meet 5 lb force requirement.', 'Turner Construction', 'open', 'high', '2025-06-02', '2025-06-12', NULL),
(1, 'Level 4 - Unit 402', 'Hardwood floor scratch 18" long in living room. Sand and refinish.', 'Turner Construction', 'in_progress', 'medium', '2025-05-30', '2025-06-10', NULL),
(1, 'Level 5 - Mechanical Room', 'AHU-2 vibration isolators not properly seated. Re-install per manufacturer specs.', 'Comfort Systems USA', 'open', 'high', '2025-06-03', '2025-06-10', NULL),
(1, 'Parking Level P1', 'Epoxy floor coating delaminating at 3 locations near ramp. Re-coat.', 'Baker Concrete', 'open', 'medium', '2025-06-01', '2025-06-20', NULL),
(1, 'Parking Level P2', 'Overhead LED fixture #P2-18 flickering. Replace driver.', 'Consolidated Electrical', 'completed', 'low', '2025-05-25', '2025-06-08', '2025-06-01'),
(1, 'Exterior - South Facade', 'Curtain wall sealant joint at Level 3/4 transition not tooled properly.', 'Turner Construction', 'open', 'high', '2025-06-03', '2025-06-15', NULL),
-- Metro Line - Station 1 (nearing completion)
(2, 'Station 1 - Platform Level', 'Platform edge tactile warning strip not continuous at Column 7. 2'' gap.', 'Granite Construction', 'open', 'critical', '2025-05-28', '2025-06-05', NULL),
(2, 'Station 1 - Platform Level', 'Platform screen door #4 alignment off by 15mm. Recalibrate servo.', 'Parsons Corporation', 'in_progress', 'high', '2025-05-30', '2025-06-08', NULL),
(2, 'Station 1 - Mezzanine', 'Fare gate #3 card reader intermittent failure. Replace NFC module.', 'Parsons Corporation', 'open', 'high', '2025-06-01', '2025-06-10', NULL),
(2, 'Station 1 - Mezzanine', 'Ceiling tile #M-22 through #M-25 have visible sag. Replace grid clips.', 'Kiewit Infrastructure', 'completed', 'low', '2025-05-20', '2025-06-05', '2025-05-30'),
(2, 'Station 1 - Concourse', 'Wayfinding signage at north entrance shows incorrect exit direction.', 'Kiewit Infrastructure', 'open', 'high', '2025-06-02', '2025-06-08', NULL),
(2, 'Station 1 - Elevator 1', 'Elevator cab interior panel scratch. Replace stainless panel.', 'Kiewit Infrastructure', 'open', 'medium', '2025-06-03', '2025-06-15', NULL),
(2, 'Station 2 - Platform Level', 'Drainage channel at track side not draining. Debris blockage suspected.', 'Granite Construction', 'in_progress', 'high', '2025-06-01', '2025-06-08', NULL),
(2, 'Station 2 - Entrance', 'Canopy downspout not connected to storm drain. Temporary discharge to grade.', 'Kiewit Infrastructure', 'open', 'medium', '2025-06-02', '2025-06-12', NULL),
(2, 'Guideway - STA 155+00', 'OCS contact wire height 50mm above design at span 42. Adjust tension.', 'Siemens Mobility', 'open', 'critical', '2025-06-03', '2025-06-06', NULL),
(2, 'Guideway - STA 160+00', 'Track fastener clip #320 through #328 not fully engaged. Re-torque.', 'Granite Construction', 'in_progress', 'high', '2025-06-01', '2025-06-05', NULL),
-- Harborview Medical - Level 1 areas
(3, 'Level 1 - Main Entry', 'Automatic sliding door opens too slowly. Adjust to 3-second open time.', 'Skanska USA', 'completed', 'medium', '2025-05-20', '2025-06-01', '2025-05-28'),
(3, 'Level 1 - ED Entrance', 'Ambulance canopy scupper not connected to downspout. Water dripping on walkway.', 'Skanska USA', 'open', 'high', '2025-06-01', '2025-06-08', NULL),
(3, 'Level 1 - Radiology Suite', 'Lead-lined door at X-ray Room 1-112 not closing fully. Hinge adjustment needed.', 'Walbridge', 'open', 'critical', '2025-06-02', '2025-06-05', NULL),
(3, 'Level 1 - Pharmacy', 'Negative pressure not maintaining in hazardous drug compounding room. Verify damper positions.', 'Southland Industries', 'in_progress', 'critical', '2025-06-03', '2025-06-05', NULL),
(3, 'Level 1 - Lobby', 'Information kiosk power outlet not energized. Trace circuit to panel LP-1A.', 'Rosendin Electric', 'open', 'medium', '2025-06-02', '2025-06-10', NULL),
(3, 'Level 2 - ICU Room 2-204', 'Nurse call pull station at bedside not activating dome light in corridor.', 'Rosendin Electric', 'open', 'high', '2025-06-03', '2025-06-08', NULL),
(3, 'Level 2 - OR Suite 3', 'Surgical light arm range of motion limited - interference with ceiling mount plate.', 'Skanska USA', 'open', 'high', '2025-06-04', '2025-06-12', NULL),
(3, 'Level 2 - MRI Suite', 'RF shielding door gasket compressed unevenly. 2 dB attenuation loss at 200 MHz.', 'Rosendin Electric', 'in_progress', 'critical', '2025-06-01', '2025-06-06', NULL),
(3, 'Level 3 - Lab', 'Fume hood face velocity reading 82 FPM (spec requires 100 FPM). Adjust exhaust.', 'Southland Industries', 'open', 'high', '2025-06-03', '2025-06-10', NULL),
(3, 'Level 3 - NICU', 'Sound level in NICU Room 3-318 measured at 48 dBA. Design criteria is 45 dBA max.', 'Southland Industries', 'open', 'medium', '2025-06-04', '2025-06-18', NULL),
-- Pinnacle Residences
(4, 'Level 1 - Retail Lobby', 'Terrazzo floor at entry has visible crack along control joint. Repair and re-polish.', 'Choate Construction', 'open', 'medium', '2025-06-01', '2025-06-15', NULL),
(4, 'Level 2 - Unit 2A (Mock-Up)', 'Cabinet door alignment off on upper kitchen cabinets. Adjust hinges.', 'Choate Construction', 'completed', 'low', '2025-05-15', '2025-05-30', '2025-05-25'),
(4, 'Level 2 - Unit 2A (Mock-Up)', 'Quartz countertop overhang exceeds 1/4" on left side. Scribe to wall.', 'Choate Construction', 'completed', 'medium', '2025-05-15', '2025-05-30', '2025-05-22'),
(4, 'Level 2 - Corridor', 'Fire extinguisher cabinet door latch broken. Replace latch mechanism.', 'Brasfield & Gorrie', 'in_progress', 'medium', '2025-06-02', '2025-06-10', NULL),
(4, 'Level 3 - Amenity Lounge', 'Pendant light fixture hung 2" lower than design height. Adjust chain.', 'Piedmont Electrical', 'open', 'low', '2025-06-03', '2025-06-18', NULL),
(4, 'Parking Level P1', 'Concrete spall at drive aisle expansion joint. Patch and seal.', 'Holder Construction', 'open', 'medium', '2025-06-01', '2025-06-15', NULL);

-- ============================================================================
-- INSURANCE CERTIFICATES
-- ============================================================================
CREATE TABLE insurance_certs (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES projects(id),
    vendor_name VARCHAR(200),
    policy_type VARCHAR(20) CHECK (policy_type IN ('GL','WC','auto','umbrella','professional','builders_risk','pollution')),
    policy_number VARCHAR(50),
    effective_date DATE,
    expiration_date DATE,
    coverage_amount NUMERIC(14,2),
    certificate_holder VARCHAR(200)
);

INSERT INTO insurance_certs (project_id, vendor_name, policy_type, policy_number, effective_date, expiration_date, coverage_amount, certificate_holder) VALUES
-- Riverside Tower
(1, 'Turner Construction Co.', 'GL', 'TCG-2024-88412', '2024-07-01', '2025-07-01', 5000000.00, 'Riverside Capital Partners LLC'),
(1, 'Turner Construction Co.', 'umbrella', 'TCU-2024-88413', '2024-07-01', '2025-07-01', 25000000.00, 'Riverside Capital Partners LLC'),
(1, 'Baker Concrete Construction', 'GL', 'BCC-GL-20241105', '2024-11-01', '2025-06-15', 2000000.00, 'Turner Construction Co.'),
(1, 'Consolidated Electrical Distributors', 'GL', 'CED-GL-2025-0042', '2025-01-01', '2026-01-01', 2000000.00, 'Turner Construction Co.'),
(1, 'Consolidated Electrical Distributors', 'WC', 'CED-WC-2025-0043', '2025-01-01', '2025-06-20', 1000000.00, 'Turner Construction Co.'),
(1, 'Comfort Systems USA', 'GL', 'CSU-GL-112847', '2024-09-01', '2025-09-01', 2000000.00, 'Turner Construction Co.'),
(1, 'Schindler Elevator Corp', 'GL', 'SEC-GL-2024-7891', '2024-08-15', '2025-08-15', 5000000.00, 'Turner Construction Co.'),
-- Metro Line
(2, 'Kiewit Infrastructure Co.', 'GL', 'KIC-GL-2024-20145', '2024-01-01', '2025-07-01', 10000000.00, 'Denver RTD'),
(2, 'Kiewit Infrastructure Co.', 'umbrella', 'KIC-UMB-2024-20146', '2024-01-01', '2025-07-01', 50000000.00, 'Denver RTD'),
(2, 'Granite Construction Inc.', 'GL', 'GCI-GL-445521', '2024-06-01', '2025-06-12', 5000000.00, 'Kiewit Infrastructure Co.'),
(2, 'Granite Construction Inc.', 'auto', 'GCI-AU-445522', '2024-06-01', '2025-06-12', 2000000.00, 'Kiewit Infrastructure Co.'),
(2, 'Siemens Mobility Inc.', 'GL', 'SMI-GL-2025-10042', '2025-01-01', '2026-01-01', 5000000.00, 'Kiewit Infrastructure Co.'),
(2, 'Siemens Mobility Inc.', 'professional', 'SMI-PL-2025-10043', '2025-01-01', '2026-01-01', 10000000.00, 'Denver RTD'),
(2, 'CEMEX USA', 'GL', 'CMX-GL-2024-89012', '2024-10-01', '2025-06-18', 2000000.00, 'Kiewit Infrastructure Co.'),
-- Harborview Medical
(3, 'Skanska USA Building Inc.', 'GL', 'SKA-GL-2024-33210', '2024-04-01', '2025-10-01', 10000000.00, 'UW Medicine'),
(3, 'Skanska USA Building Inc.', 'builders_risk', 'SKA-BR-2024-33211', '2024-04-01', '2026-10-01', 156000000.00, 'UW Medicine'),
(3, 'Southland Industries', 'GL', 'SLI-GL-2025-04421', '2025-02-01', '2026-02-01', 2000000.00, 'Skanska USA'),
(3, 'Southland Industries', 'WC', 'SLI-WC-2025-04422', '2025-02-01', '2026-02-01', 1000000.00, 'Skanska USA'),
(3, 'Rosendin Electric', 'GL', 'RSN-GL-2024-78845', '2024-12-01', '2025-12-01', 2000000.00, 'Skanska USA'),
(3, 'Walbridge', 'GL', 'WAL-GL-2025-11089', '2025-01-15', '2025-07-15', 2000000.00, 'Skanska USA'),
-- Pinnacle Residences
(4, 'Brasfield & Gorrie LLC', 'GL', 'BNG-GL-2025-55012', '2025-01-01', '2026-01-01', 5000000.00, 'Hines Interests LP'),
(4, 'Brasfield & Gorrie LLC', 'umbrella', 'BNG-UMB-2025-55013', '2025-01-01', '2026-01-01', 15000000.00, 'Hines Interests LP'),
(4, 'Holder Construction', 'GL', 'HLC-GL-2024-90234', '2024-11-01', '2025-06-14', 2000000.00, 'Brasfield & Gorrie LLC'),
(4, 'McKenney''s Inc.', 'GL', 'MKI-GL-2025-22311', '2025-03-01', '2026-03-01', 2000000.00, 'Brasfield & Gorrie LLC'),
(4, 'Piedmont Electrical', 'GL', 'PIE-GL-2025-30102', '2025-02-15', '2025-08-15', 1000000.00, 'Brasfield & Gorrie LLC'),
(4, 'Piedmont Electrical', 'WC', 'PIE-WC-2025-30103', '2025-02-15', '2025-06-16', 500000.00, 'Brasfield & Gorrie LLC'),
-- Westfield Logistics
(5, 'Hensel Phelps Construction Co.', 'GL', 'HPC-GL-2025-44501', '2025-01-15', '2026-01-15', 5000000.00, 'Prologis Inc.'),
(5, 'Sundt Construction', 'GL', 'SDT-GL-2025-08811', '2025-02-01', '2025-08-01', 2000000.00, 'Hensel Phelps Construction Co.'),
(5, 'Sundt Construction', 'pollution', 'SDT-POL-2025-08812', '2025-02-01', '2026-02-01', 3000000.00, 'Prologis Inc.'),
(5, 'Desert Electric Co.', 'GL', 'DEC-GL-2025-12067', '2025-03-01', '2025-09-01', 1000000.00, 'Hensel Phelps Construction Co.');

-- ============================================================================
-- PAY APPLICATIONS
-- ============================================================================
CREATE TABLE pay_applications (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES projects(id),
    number INTEGER,
    vendor_id INTEGER REFERENCES vendors(id),
    period_start DATE,
    period_end DATE,
    scheduled_value NUMERIC(12,2),
    work_completed_previous NUMERIC(12,2),
    work_completed_current NUMERIC(12,2),
    materials_stored NUMERIC(12,2),
    total_completed NUMERIC(12,2),
    retainage NUMERIC(12,2),
    amount_due NUMERIC(12,2),
    status VARCHAR(15) CHECK (status IN ('draft','submitted','approved','paid'))
);

INSERT INTO pay_applications (project_id, number, vendor_id, period_start, period_end, scheduled_value, work_completed_previous, work_completed_current, materials_stored, total_completed, retainage, amount_due, status) VALUES
-- Riverside Tower
(1, 7, 1, '2025-05-01', '2025-05-31', 8750000.00, 2800000.00, 700000.00, 125000.00, 3625000.00, 362500.00, 337500.00, 'submitted'),
(1, 9, 2, '2025-05-01', '2025-05-31', 6200000.00, 5200000.00, 380000.00, 0.00, 5580000.00, 558000.00, 0.00, 'approved'),
(1, 5, 3, '2025-05-01', '2025-05-31', 5400000.00, 1620000.00, 540000.00, 85000.00, 2245000.00, 224500.00, 315500.00, 'paid'),
(1, 3, 4, '2025-05-01', '2025-05-31', 3200000.00, 640000.00, 320000.00, 180000.00, 1140000.00, 114000.00, 206000.00, 'submitted'),
-- Metro Line
(2, 14, 6, '2025-05-01', '2025-05-31', 32000000.00, 20800000.00, 1600000.00, 0.00, 22400000.00, 2240000.00, 0.00, 'approved'),
(2, 10, 7, '2025-05-01', '2025-05-31', 18500000.00, 9800000.00, 1300000.00, 450000.00, 11550000.00, 1155000.00, 145000.00, 'paid'),
(2, 5, 8, '2025-05-01', '2025-05-31', 28000000.00, 7000000.00, 1400000.00, 800000.00, 9200000.00, 920000.00, 480000.00, 'submitted'),
(2, 4, 9, '2025-05-01', '2025-05-31', 15000000.00, 3200000.00, 1300000.00, 650000.00, 5150000.00, 515000.00, 785000.00, 'draft'),
-- Harborview Medical
(3, 6, 11, '2025-05-01', '2025-05-31', 14200000.00, 4680000.00, 1000000.00, 320000.00, 6000000.00, 600000.00, 400000.00, 'submitted'),
(3, 5, 12, '2025-05-01', '2025-05-31', 11800000.00, 3800000.00, 920000.00, 250000.00, 4970000.00, 497000.00, 423000.00, 'approved'),
(3, 3, 13, '2025-05-01', '2025-05-31', 8500000.00, 1200000.00, 500000.00, 180000.00, 1880000.00, 188000.00, 312000.00, 'submitted'),
-- Pinnacle Residences
(4, 4, 15, '2025-05-01', '2025-05-31', 7200000.00, 2160000.00, 720000.00, 0.00, 2880000.00, 288000.00, 432000.00, 'paid'),
(4, 3, 16, '2025-05-01', '2025-05-31', 5100000.00, 1530000.00, 510000.00, 340000.00, 2380000.00, 238000.00, 272000.00, 'submitted');

-- ============================================================================
-- Update RFI days_open for open RFIs (calculate from created_date to today)
-- ============================================================================
UPDATE rfis SET days_open = CURRENT_DATE - created_date WHERE status = 'open';

-- ============================================================================
-- Create useful indexes
-- ============================================================================
CREATE INDEX idx_rfis_project ON rfis(project_id);
CREATE INDEX idx_rfis_status ON rfis(status);
CREATE INDEX idx_rfis_priority ON rfis(priority);
CREATE INDEX idx_submittals_project ON submittals(project_id);
CREATE INDEX idx_submittals_status ON submittals(status);
CREATE INDEX idx_budget_project ON budget_line_items(project_id);
CREATE INDEX idx_change_orders_project ON change_orders(project_id);
CREATE INDEX idx_daily_logs_project_date ON daily_logs(project_id, log_date);
CREATE INDEX idx_punch_list_project ON punch_list_items(project_id);
CREATE INDEX idx_punch_list_status ON punch_list_items(status);
CREATE INDEX idx_insurance_expiration ON insurance_certs(expiration_date);
CREATE INDEX idx_vendors_project ON vendors(project_id);
CREATE INDEX idx_pay_apps_project ON pay_applications(project_id);

-- ============================================================================
-- Create useful views for AI queries
-- ============================================================================
CREATE OR REPLACE VIEW v_project_budget_summary AS
SELECT 
    p.id AS project_id,
    p.name AS project_name,
    p.contract_sum,
    SUM(b.original_budget) AS total_original_budget,
    SUM(b.approved_changes) AS total_approved_changes,
    SUM(b.revised_budget) AS total_revised_budget,
    SUM(b.committed_costs) AS total_committed,
    SUM(b.actual_costs) AS total_actual_costs,
    SUM(b.projected_final) AS total_projected_final,
    SUM(b.projected_final) - SUM(b.revised_budget) AS total_variance,
    ROUND(((SUM(b.projected_final) - SUM(b.revised_budget)) / NULLIF(SUM(b.revised_budget), 0) * 100)::numeric, 2) AS variance_percent
FROM projects p
JOIN budget_line_items b ON p.id = b.project_id
GROUP BY p.id, p.name, p.contract_sum;

CREATE OR REPLACE VIEW v_overdue_rfis AS
SELECT 
    r.id,
    r.number,
    p.name AS project_name,
    r.subject,
    r.priority,
    r.assigned_to,
    r.created_date,
    r.due_date,
    CURRENT_DATE - r.due_date AS days_overdue,
    r.description
FROM rfis r
JOIN projects p ON r.project_id = p.id
WHERE r.status = 'open' AND r.due_date < CURRENT_DATE
ORDER BY CURRENT_DATE - r.due_date DESC;

CREATE OR REPLACE VIEW v_expiring_insurance AS
SELECT 
    ic.id,
    p.name AS project_name,
    ic.vendor_name,
    ic.policy_type,
    ic.policy_number,
    ic.expiration_date,
    ic.expiration_date - CURRENT_DATE AS days_until_expiration,
    ic.coverage_amount
FROM insurance_certs ic
JOIN projects p ON ic.project_id = p.id
WHERE ic.expiration_date <= CURRENT_DATE + INTERVAL '30 days'
ORDER BY ic.expiration_date;

CREATE OR REPLACE VIEW v_project_dashboard AS
SELECT
    p.id,
    p.name,
    p.status,
    p.contract_sum,
    p.project_type,
    p.city || ', ' || p.state AS location,
    (SELECT COUNT(*) FROM rfis r WHERE r.project_id = p.id AND r.status = 'open') AS open_rfis,
    (SELECT COUNT(*) FROM rfis r WHERE r.project_id = p.id AND r.status = 'open' AND r.due_date < CURRENT_DATE) AS overdue_rfis,
    (SELECT COUNT(*) FROM submittals s WHERE s.project_id = p.id AND s.status = 'pending') AS pending_submittals,
    (SELECT COUNT(*) FROM change_orders co WHERE co.project_id = p.id AND co.status = 'pending') AS pending_change_orders,
    (SELECT COALESCE(SUM(co.amount), 0) FROM change_orders co WHERE co.project_id = p.id AND co.status = 'pending') AS pending_co_value,
    (SELECT COUNT(*) FROM punch_list_items pl WHERE pl.project_id = p.id AND pl.status IN ('open', 'in_progress')) AS open_punch_items,
    (SELECT COUNT(*) FROM insurance_certs ic WHERE ic.project_id = p.id AND ic.expiration_date <= CURRENT_DATE + INTERVAL '30 days') AS expiring_certs
FROM projects p
ORDER BY p.contract_sum DESC;

-- Done!
SELECT 'BuildAI Demo Database seeded successfully!' AS status;
