/**
 * Generate QR codes for buildings
 *
 * This script creates short codes for all buildings (or a subset)
 * and optionally generates QR code images.
 *
 * Usage:
 *   node scripts/generate-qr-codes.js                    # Generate codes for all buildings
 *   node scripts/generate-qr-codes.js --with-address     # Only buildings with addresses
 *   node scripts/generate-qr-codes.js --output=./qr-images --images  # Generate PNG images
 */

import { mkdirSync, writeFileSync } from 'fs';
import { getDb, generateId } from '../db.js';

const args = process.argv.slice(2).reduce((acc, arg) => {
    const [key, value] = arg.replace('--', '').split('=');
    acc[key] = value || true;
    return acc;
}, {});

// Base URL for QR codes (update for production)
const BASE_URL = process.env.BASE_URL || 'https://belleville3d.com/claim';

async function generateQRCodes() {
    const db = getDb();

    // Get buildings that need QR codes
    let query = `
        SELECT b.id, b.street_address, b.name
        FROM buildings b
        LEFT JOIN qr_codes q ON b.id = q.building_id
        WHERE q.id IS NULL
    `;

    if (args['with-address']) {
        query += ' AND b.street_address IS NOT NULL';
    }

    const buildings = db.prepare(query).all();
    console.log(`Found ${buildings.length} buildings needing QR codes`);

    if (buildings.length === 0) {
        console.log('No buildings to process.');
        return;
    }

    const insert = db.prepare(`
        INSERT INTO qr_codes (id, building_id, short_code)
        VALUES (?, ?, ?)
    `);

    const codes = [];

    const generateAll = db.transaction(() => {
        for (const building of buildings) {
            const id = generateId();
            // Short code: 6 alphanumeric chars
            const short_code = 'b' + Math.random().toString(36).substring(2, 8);

            insert.run(id, building.id, short_code);

            codes.push({
                building_id: building.id,
                short_code,
                address: building.street_address,
                name: building.name,
                url: `${BASE_URL}/${short_code}`
            });
        }
    });

    generateAll();

    console.log(`Generated ${codes.length} QR codes`);

    // Output manifest
    const manifestPath = args.output
        ? `${args.output}/manifest.json`
        : './qr-manifest.json';

    if (args.output) {
        mkdirSync(args.output, { recursive: true });
    }

    writeFileSync(manifestPath, JSON.stringify(codes, null, 2));
    console.log(`Manifest saved to: ${manifestPath}`);

    // Generate images if requested
    if (args.images) {
        console.log('\nTo generate QR images, install qrcode package and run:');
        console.log('  npm install qrcode');
        console.log('  node scripts/render-qr-images.js');
        console.log('\nOr use an online batch QR generator with the manifest.json file.');
    }

    // Print sample
    console.log('\nSample codes:');
    codes.slice(0, 5).forEach(c => {
        console.log(`  ${c.short_code}: ${c.address || c.building_id}`);
    });
}

generateQRCodes().catch(console.error);
