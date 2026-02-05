-- Belle Epoque Buildings Database Schema
-- Privacy-first design: minimal data collection, temporary verification docs

-- ============================================================================
-- BUILDINGS: Core geometry + address data
-- ============================================================================
CREATE TABLE IF NOT EXISTS buildings (
    id TEXT PRIMARY KEY,                    -- UUID from existing buildings.json

    -- Address data (from GIS/OSM enrichment or manual entry)
    street_number TEXT,
    street_name TEXT,
    street_address TEXT,                    -- Full formatted: "123 E Main St"
    city TEXT DEFAULT 'Belleville',
    state TEXT DEFAULT 'IL',
    zip TEXT,

    -- Parcel/GIS reference
    parcel_id TEXT,                         -- County parcel number if available

    -- Geocoordinates (WGS84 for interop)
    lat REAL,
    lng REAL,

    -- Geometry (stored as JSON strings)
    footprint TEXT,                         -- JSON: [[x,z], [x,z], ...]
    position TEXT,                          -- JSON: [x, y, z]
    size TEXT,                              -- JSON: [width, height, depth]
    color TEXT,

    -- Metadata
    name TEXT,                              -- Building name if known
    building_type TEXT,                     -- residential, commercial, mixed, etc.
    address_source TEXT,                    -- 'gis', 'osm', 'manual', 'submission'
    address_verified_at TEXT,               -- ISO timestamp

    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Index for address lookups
CREATE INDEX IF NOT EXISTS idx_buildings_address ON buildings(street_address);
CREATE INDEX IF NOT EXISTS idx_buildings_parcel ON buildings(parcel_id);

-- ============================================================================
-- BUSINESSES: Verified business listings linked to buildings
-- ============================================================================
CREATE TABLE IF NOT EXISTS businesses (
    id TEXT PRIMARY KEY,                    -- UUID
    building_id TEXT NOT NULL,              -- FK to buildings

    -- Core business info
    name TEXT NOT NULL,
    description TEXT,
    category TEXT,                          -- e.g., 'Restaurant', 'Retail', 'Service'

    -- Contact (all optional - owner's choice)
    phone TEXT,
    email TEXT,
    website TEXT,
    hours TEXT,                             -- Free-form: "Mon-Fri 9-5" etc.

    -- Status
    status TEXT DEFAULT 'active',           -- active, closed, seasonal
    featured INTEGER DEFAULT 0,             -- Boolean: highlight on map

    -- Audit
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),

    FOREIGN KEY (building_id) REFERENCES buildings(id)
);

CREATE INDEX IF NOT EXISTS idx_businesses_building ON businesses(building_id);
CREATE INDEX IF NOT EXISTS idx_businesses_category ON businesses(category);
CREATE INDEX IF NOT EXISTS idx_businesses_status ON businesses(status);

-- ============================================================================
-- SUBMISSIONS: Business registration requests (pending verification)
-- ============================================================================
CREATE TABLE IF NOT EXISTS submissions (
    id TEXT PRIMARY KEY,                    -- UUID
    building_id TEXT NOT NULL,              -- Which building they're claiming

    -- Submitted business info
    business_name TEXT NOT NULL,
    category TEXT,
    description TEXT,
    phone TEXT,
    email TEXT,
    website TEXT,
    hours TEXT,

    -- Address they claim (for cross-reference)
    submitted_address TEXT NOT NULL,

    -- Verification workflow
    status TEXT DEFAULT 'pending',          -- pending, approved, rejected
    reviewer_notes TEXT,                    -- Internal notes (not shown to submitter)

    -- Verification document tracking (NOT the document itself)
    doc_uploaded_at TEXT,                   -- When they uploaded verification
    doc_verified_at TEXT,                   -- When reviewer checked it
    doc_deleted_at TEXT,                    -- When we deleted it (should be same as verified)

    -- Contact for follow-up (optional)
    submitter_contact TEXT,                 -- Email or phone if they want updates

    -- Timestamps
    submitted_at TEXT DEFAULT (datetime('now')),
    reviewed_at TEXT,

    FOREIGN KEY (building_id) REFERENCES buildings(id)
);

CREATE INDEX IF NOT EXISTS idx_submissions_status ON submissions(status);
CREATE INDEX IF NOT EXISTS idx_submissions_building ON submissions(building_id);

-- ============================================================================
-- QR_CODES: Track generated QR codes for buildings
-- ============================================================================
CREATE TABLE IF NOT EXISTS qr_codes (
    id TEXT PRIMARY KEY,                    -- UUID
    building_id TEXT NOT NULL,

    -- QR metadata
    short_code TEXT UNIQUE NOT NULL,        -- Short URL-friendly code: "bldg-a7x9"
    generated_at TEXT DEFAULT (datetime('now')),

    -- Stats (optional, for understanding engagement)
    scan_count INTEGER DEFAULT 0,
    last_scanned_at TEXT,

    FOREIGN KEY (building_id) REFERENCES buildings(id)
);

CREATE INDEX IF NOT EXISTS idx_qr_short_code ON qr_codes(short_code);

-- ============================================================================
-- CHAMBER_ROSTER: Reference data from Chamber of Commerce (if provided)
-- Used for validation, not displayed publicly without permission
-- ============================================================================
CREATE TABLE IF NOT EXISTS chamber_roster (
    id TEXT PRIMARY KEY,

    -- Business info from chamber
    business_name TEXT NOT NULL,
    address TEXT,
    member_since TEXT,
    category TEXT,

    -- Linking
    matched_building_id TEXT,               -- If we've linked it to a building
    matched_business_id TEXT,               -- If we've linked it to a verified business

    -- Import metadata
    imported_at TEXT DEFAULT (datetime('now')),
    source_file TEXT,                       -- Which import file this came from

    FOREIGN KEY (matched_building_id) REFERENCES buildings(id),
    FOREIGN KEY (matched_business_id) REFERENCES businesses(id)
);

CREATE INDEX IF NOT EXISTS idx_chamber_name ON chamber_roster(business_name);
CREATE INDEX IF NOT EXISTS idx_chamber_address ON chamber_roster(address);

-- ============================================================================
-- AUDIT_LOG: Track important actions for accountability
-- ============================================================================
CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    action TEXT NOT NULL,                   -- 'submission_approved', 'doc_deleted', etc.
    entity_type TEXT,                       -- 'submission', 'business', 'building'
    entity_id TEXT,

    details TEXT,                           -- JSON with action-specific details
    performed_by TEXT,                      -- Reviewer identifier
    performed_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log(entity_type, entity_id);
