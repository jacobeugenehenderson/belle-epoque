import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Database file lives in server directory (gitignored in production)
const DB_PATH = process.env.DB_PATH || join(__dirname, 'belle-epoque.db');

let db = null;

export function getDb() {
    if (!db) {
        db = new Database(DB_PATH);
        db.pragma('journal_mode = WAL');  // Better concurrency
        db.pragma('foreign_keys = ON');
        initSchema();
    }
    return db;
}

function initSchema() {
    const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf-8');
    db.exec(schema);
}

// Helper to generate UUIDs (simple v4-like)
export function generateId() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// Audit logging helper
export function logAudit(action, entityType, entityId, details, performedBy = 'system') {
    const db = getDb();
    db.prepare(`
        INSERT INTO audit_log (action, entity_type, entity_id, details, performed_by)
        VALUES (?, ?, ?, ?, ?)
    `).run(action, entityType, entityId, JSON.stringify(details), performedBy);
}

export default getDb;
