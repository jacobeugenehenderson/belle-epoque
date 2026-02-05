import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { getDb, generateId, logAudit } from './db.js';
import verificationRoutes, { deleteDocument } from './routes/verification.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Verification document routes
app.use('/api', verificationRoutes);

// ============================================================================
// BUILDINGS API
// ============================================================================

// Get all buildings (with optional address filter)
app.get('/api/buildings', (req, res) => {
    const db = getDb();
    const { hasAddress, limit = 1000, offset = 0 } = req.query;

    let query = 'SELECT * FROM buildings';
    const params = [];

    if (hasAddress === 'true') {
        query += ' WHERE street_address IS NOT NULL';
    } else if (hasAddress === 'false') {
        query += ' WHERE street_address IS NULL';
    }

    query += ' LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const buildings = db.prepare(query).all(...params);
    res.json(buildings);
});

// Get single building by ID
app.get('/api/buildings/:id', (req, res) => {
    const db = getDb();
    const building = db.prepare('SELECT * FROM buildings WHERE id = ?').get(req.params.id);

    if (!building) {
        return res.status(404).json({ error: 'Building not found' });
    }

    // Include any verified businesses at this building
    const businesses = db.prepare(
        'SELECT * FROM businesses WHERE building_id = ? AND status = ?'
    ).all(req.params.id, 'active');

    res.json({ ...building, businesses });
});

// Update building address (admin)
app.patch('/api/buildings/:id', (req, res) => {
    const db = getDb();
    const { street_number, street_name, street_address, zip, parcel_id, lat, lng, address_source } = req.body;

    const result = db.prepare(`
        UPDATE buildings SET
            street_number = COALESCE(?, street_number),
            street_name = COALESCE(?, street_name),
            street_address = COALESCE(?, street_address),
            zip = COALESCE(?, zip),
            parcel_id = COALESCE(?, parcel_id),
            lat = COALESCE(?, lat),
            lng = COALESCE(?, lng),
            address_source = COALESCE(?, address_source),
            updated_at = datetime('now')
        WHERE id = ?
    `).run(street_number, street_name, street_address, zip, parcel_id, lat, lng, address_source, req.params.id);

    if (result.changes === 0) {
        return res.status(404).json({ error: 'Building not found' });
    }

    logAudit('building_updated', 'building', req.params.id, req.body);
    res.json({ success: true });
});

// ============================================================================
// SUBMISSIONS API (Public - for business owners)
// ============================================================================

// Submit a new business registration
app.post('/api/submissions', (req, res) => {
    const db = getDb();
    const {
        building_id,
        business_name,
        submitted_address,
        category,
        description,
        phone,
        email,
        website,
        hours,
        submitter_contact
    } = req.body;

    // Validate required fields
    if (!building_id || !business_name || !submitted_address) {
        return res.status(400).json({
            error: 'Missing required fields: building_id, business_name, submitted_address'
        });
    }

    // Verify building exists
    const building = db.prepare('SELECT id FROM buildings WHERE id = ?').get(building_id);
    if (!building) {
        return res.status(400).json({ error: 'Invalid building_id' });
    }

    const id = generateId();

    db.prepare(`
        INSERT INTO submissions (
            id, building_id, business_name, submitted_address, category,
            description, phone, email, website, hours, submitter_contact
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, building_id, business_name, submitted_address, category,
           description, phone, email, website, hours, submitter_contact);

    logAudit('submission_created', 'submission', id, { business_name, building_id });

    res.status(201).json({
        id,
        message: 'Submission received. Please upload verification document.',
        upload_url: `/api/submissions/${id}/verify`
    });
});

// Get submission status (public - submitter can check their status)
app.get('/api/submissions/:id/status', (req, res) => {
    const db = getDb();
    const submission = db.prepare(`
        SELECT id, business_name, status, submitted_at, reviewed_at
        FROM submissions WHERE id = ?
    `).get(req.params.id);

    if (!submission) {
        return res.status(404).json({ error: 'Submission not found' });
    }

    res.json(submission);
});

// ============================================================================
// VERIFICATION API (Admin only - would need auth in production)
// ============================================================================

// List pending submissions
app.get('/api/admin/submissions', (req, res) => {
    const db = getDb();
    const { status = 'pending' } = req.query;

    const submissions = db.prepare(`
        SELECT s.*, b.street_address as building_address
        FROM submissions s
        LEFT JOIN buildings b ON s.building_id = b.id
        WHERE s.status = ?
        ORDER BY s.submitted_at ASC
    `).all(status);

    res.json(submissions);
});

// Approve submission
app.post('/api/admin/submissions/:id/approve', async (req, res) => {
    const db = getDb();
    const { reviewer_notes, reviewer } = req.body;

    const submission = db.prepare('SELECT * FROM submissions WHERE id = ?').get(req.params.id);
    if (!submission) {
        return res.status(404).json({ error: 'Submission not found' });
    }

    // Create the verified business
    const businessId = generateId();

    db.prepare(`
        INSERT INTO businesses (
            id, building_id, name, description, category,
            phone, email, website, hours
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
        businessId,
        submission.building_id,
        submission.business_name,
        submission.description,
        submission.category,
        submission.phone,
        submission.email,
        submission.website,
        submission.hours
    );

    // Update submission status
    db.prepare(`
        UPDATE submissions SET
            status = 'approved',
            reviewer_notes = ?,
            reviewed_at = datetime('now'),
            doc_deleted_at = datetime('now')
        WHERE id = ?
    `).run(reviewer_notes, req.params.id);

    // Delete verification document immediately
    await deleteDocument(req.params.id, reviewer);

    logAudit('submission_approved', 'submission', req.params.id, {
        business_id: businessId,
        reviewer
    }, reviewer);

    res.json({ success: true, business_id: businessId });
});

// Reject submission
app.post('/api/admin/submissions/:id/reject', async (req, res) => {
    const db = getDb();
    const { reviewer_notes, reviewer } = req.body;

    const result = db.prepare(`
        UPDATE submissions SET
            status = 'rejected',
            reviewer_notes = ?,
            reviewed_at = datetime('now')
        WHERE id = ?
    `).run(reviewer_notes, req.params.id);

    if (result.changes === 0) {
        return res.status(404).json({ error: 'Submission not found' });
    }

    // Delete verification document immediately
    await deleteDocument(req.params.id, reviewer);

    logAudit('submission_rejected', 'submission', req.params.id, {
        reviewer_notes,
        reviewer
    }, reviewer);

    res.json({ success: true });
});

// ============================================================================
// QR CODE API
// ============================================================================

// Generate QR code entry for a building
app.post('/api/qr-codes', (req, res) => {
    const db = getDb();
    const { building_id } = req.body;

    // Check if QR already exists for this building
    const existing = db.prepare('SELECT * FROM qr_codes WHERE building_id = ?').get(building_id);
    if (existing) {
        return res.json(existing);
    }

    const id = generateId();
    // Generate a short, URL-friendly code
    const short_code = 'b-' + Math.random().toString(36).substring(2, 8);

    db.prepare(`
        INSERT INTO qr_codes (id, building_id, short_code)
        VALUES (?, ?, ?)
    `).run(id, building_id, short_code);

    res.status(201).json({ id, building_id, short_code });
});

// Lookup building by QR short code (public)
app.get('/api/qr/:shortCode', (req, res) => {
    const db = getDb();

    const qr = db.prepare('SELECT * FROM qr_codes WHERE short_code = ?').get(req.params.shortCode);
    if (!qr) {
        return res.status(404).json({ error: 'Invalid QR code' });
    }

    // Increment scan count
    db.prepare(`
        UPDATE qr_codes SET
            scan_count = scan_count + 1,
            last_scanned_at = datetime('now')
        WHERE id = ?
    `).run(qr.id);

    const building = db.prepare('SELECT * FROM buildings WHERE id = ?').get(qr.building_id);

    res.json({ building, qr });
});

// ============================================================================
// BUSINESSES API (Public - verified listings)
// ============================================================================

app.get('/api/businesses', (req, res) => {
    const db = getDb();
    const { category, status = 'active' } = req.query;

    let query = `
        SELECT b.*, bldg.street_address, bldg.name as building_name
        FROM businesses b
        LEFT JOIN buildings bldg ON b.building_id = bldg.id
        WHERE b.status = ?
    `;
    const params = [status];

    if (category) {
        query += ' AND b.category = ?';
        params.push(category);
    }

    query += ' ORDER BY b.name';

    const businesses = db.prepare(query).all(...params);
    res.json(businesses);
});

// ============================================================================
// STATS API (Public - aggregate only, no PII)
// ============================================================================

app.get('/api/stats', (req, res) => {
    const db = getDb();

    const stats = {
        total_buildings: db.prepare('SELECT COUNT(*) as count FROM buildings').get().count,
        buildings_with_address: db.prepare('SELECT COUNT(*) as count FROM buildings WHERE street_address IS NOT NULL').get().count,
        active_businesses: db.prepare('SELECT COUNT(*) as count FROM businesses WHERE status = ?').get('active').count,
        pending_submissions: db.prepare('SELECT COUNT(*) as count FROM submissions WHERE status = ?').get('pending').count
    };

    res.json(stats);
});

// ============================================================================
// START SERVER
// ============================================================================

app.listen(PORT, () => {
    console.log(`Belle Epoque API running on http://localhost:${PORT}`);
    console.log(`Database: ${process.env.DB_PATH || 'server/belle-epoque.db'}`);
});

export default app;
