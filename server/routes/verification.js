/**
 * Verification document handling
 *
 * Privacy-first approach:
 * - Documents stored temporarily in memory or short-lived temp files
 * - Deleted immediately after review
 * - No long-term storage of sensitive documents
 */

import express from 'express';
import multer from 'multer';
import { randomBytes } from 'crypto';
import { unlink } from 'fs/promises';
import { join } from 'path';
import { getDb, logAudit } from '../db.js';

const router = express.Router();

// Store uploads in memory (for small files) or temp directory
// Files are deleted immediately after review
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // Use system temp directory - cleaned up by OS if we miss it
        cb(null, process.env.UPLOAD_DIR || '/tmp/belle-epoque-verify');
    },
    filename: (req, file, cb) => {
        // Random filename - no PII in filename
        const random = randomBytes(16).toString('hex');
        const ext = file.originalname.split('.').pop();
        cb(null, `verify-${random}.${ext}`);
    }
});

const upload = multer({
    storage,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB max
        files: 1
    },
    fileFilter: (req, file, cb) => {
        // Accept only images
        const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
        if (allowed.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Only image files (JPEG, PNG, WebP, HEIC) are accepted'));
        }
    }
});

/**
 * Upload verification document for a submission
 * POST /api/submissions/:id/verify
 *
 * The document is stored temporarily until reviewed,
 * then deleted immediately regardless of approval/rejection.
 */
router.post('/submissions/:id/verify', upload.single('document'), async (req, res) => {
    const db = getDb();
    const submissionId = req.params.id;

    // Verify submission exists and is pending
    const submission = db.prepare(
        'SELECT * FROM submissions WHERE id = ? AND status = ?'
    ).get(submissionId, 'pending');

    if (!submission) {
        // Delete uploaded file if submission not found
        if (req.file) {
            await safeDelete(req.file.path);
        }
        return res.status(404).json({
            error: 'Submission not found or already processed'
        });
    }

    if (!req.file) {
        return res.status(400).json({
            error: 'No document uploaded'
        });
    }

    // Record that document was uploaded (but NOT the file path in permanent storage)
    db.prepare(`
        UPDATE submissions SET
            doc_uploaded_at = datetime('now')
        WHERE id = ?
    `).run(submissionId);

    // Store file path in memory for admin review (not in DB)
    // In production, you might use Redis or a short-lived cache
    pendingDocs.set(submissionId, {
        path: req.file.path,
        uploadedAt: new Date().toISOString(),
        originalName: req.file.originalname,
        size: req.file.size
    });

    // Auto-delete after 24 hours if not reviewed
    setTimeout(async () => {
        const doc = pendingDocs.get(submissionId);
        if (doc) {
            await safeDelete(doc.path);
            pendingDocs.delete(submissionId);
            console.log(`Auto-deleted unreviewed document for submission ${submissionId}`);
        }
    }, 24 * 60 * 60 * 1000);

    logAudit('doc_uploaded', 'submission', submissionId, {
        size: req.file.size,
        type: req.file.mimetype
    });

    res.json({
        success: true,
        message: 'Document uploaded. It will be reviewed and then deleted.',
        submission_id: submissionId
    });
});

/**
 * Get verification document for review (admin only)
 * GET /api/admin/submissions/:id/document
 *
 * Returns the document for viewing during review process.
 */
router.get('/admin/submissions/:id/document', (req, res) => {
    const doc = pendingDocs.get(req.params.id);

    if (!doc) {
        return res.status(404).json({
            error: 'No document found. It may have been reviewed or expired.'
        });
    }

    // Send the file for viewing
    res.sendFile(doc.path);
});

/**
 * Delete verification document after review (called by approve/reject)
 * This is also called internally after review decisions.
 */
router.delete('/admin/submissions/:id/document', async (req, res) => {
    const { reviewer } = req.body;
    const deleted = await deleteDocument(req.params.id, reviewer);

    if (deleted) {
        res.json({ success: true, message: 'Document deleted' });
    } else {
        res.status(404).json({ error: 'No document found to delete' });
    }
});

// ============================================================================
// Internal helpers
// ============================================================================

// In-memory store for pending documents (not persisted to DB for privacy)
const pendingDocs = new Map();

async function deleteDocument(submissionId, reviewer = 'system') {
    const doc = pendingDocs.get(submissionId);

    if (!doc) {
        return false;
    }

    await safeDelete(doc.path);
    pendingDocs.delete(submissionId);

    // Update submission record
    const db = getDb();
    db.prepare(`
        UPDATE submissions SET doc_deleted_at = datetime('now')
        WHERE id = ?
    `).run(submissionId);

    logAudit('doc_deleted', 'submission', submissionId, {}, reviewer);

    return true;
}

async function safeDelete(filePath) {
    try {
        await unlink(filePath);
    } catch (err) {
        if (err.code !== 'ENOENT') {
            console.error(`Failed to delete file ${filePath}:`, err.message);
        }
    }
}

// Export for use by main approval/rejection endpoints
export { deleteDocument };
export default router;
