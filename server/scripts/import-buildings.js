/**
 * Import buildings from existing buildings.json into the database
 * Run: node server/scripts/import-buildings.js
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { getDb } from '../db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BUILDINGS_JSON = join(__dirname, '../../src/data/buildings.json');

async function importBuildings() {
    console.log('Reading buildings.json...');
    const data = JSON.parse(readFileSync(BUILDINGS_JSON, 'utf-8'));
    const buildings = data.buildings || data;
    console.log(`Found ${buildings.length} buildings`);

    const db = getDb();

    // Prepare insert statement
    const insert = db.prepare(`
        INSERT OR REPLACE INTO buildings (
            id, name, footprint, position, size, color, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `);

    // Use transaction for speed
    const importAll = db.transaction((buildings) => {
        let imported = 0;
        for (const b of buildings) {
            insert.run(
                b.id,
                b.name || null,
                JSON.stringify(b.footprint),
                JSON.stringify(b.position),
                JSON.stringify(b.size),
                b.color
            );
            imported++;
            if (imported % 500 === 0) {
                console.log(`  Imported ${imported}/${buildings.length}...`);
            }
        }
        return imported;
    });

    const count = importAll(buildings);
    console.log(`\nSuccessfully imported ${count} buildings into database.`);

    // Show stats
    const stats = db.prepare(`
        SELECT
            COUNT(*) as total,
            COUNT(street_address) as with_address,
            COUNT(name) as with_name
        FROM buildings
    `).get();

    console.log('\nDatabase stats:');
    console.log(`  Total buildings: ${stats.total}`);
    console.log(`  With addresses:  ${stats.with_address}`);
    console.log(`  With names:      ${stats.with_name}`);
}

importBuildings().catch(console.error);
