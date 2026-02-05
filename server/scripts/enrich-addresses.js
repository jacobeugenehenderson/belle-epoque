/**
 * Enrich buildings with address data from various sources
 *
 * Supported sources:
 *   --source=gis     Import from St. Clair County GIS shapefile/CSV
 *   --source=osm     Query OpenStreetMap Nominatim (rate-limited)
 *   --source=csv     Import from custom CSV file
 *
 * Examples:
 *   node server/scripts/enrich-addresses.js --source=gis --file=parcels.csv
 *   node server/scripts/enrich-addresses.js --source=osm --limit=100
 *   node server/scripts/enrich-addresses.js --source=csv --file=addresses.csv
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { getDb, logAudit } from '../db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Parse command line args
const args = process.argv.slice(2).reduce((acc, arg) => {
    const [key, value] = arg.replace('--', '').split('=');
    acc[key] = value || true;
    return acc;
}, {});

// ============================================================================
// GIS DATA IMPORT (St. Clair County format)
// ============================================================================

async function importFromGIS(filePath) {
    console.log(`Importing GIS data from: ${filePath}`);

    // Expected CSV columns from county GIS export:
    // PARCEL_ID, SITUS_ADDR, SITUS_CITY, SITUS_ZIP, CENTROID_X, CENTROID_Y

    const content = readFileSync(filePath, 'utf-8');
    const lines = content.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());

    console.log(`Found ${lines.length - 1} parcels`);
    console.log(`Columns: ${headers.join(', ')}`);

    const db = getDb();

    // Get all buildings without addresses
    const buildings = db.prepare(`
        SELECT id, position, footprint FROM buildings
        WHERE street_address IS NULL
    `).all();

    console.log(`Buildings needing addresses: ${buildings.length}`);

    // Parse parcels into spatial index (simple approach: centroid matching)
    const parcels = [];
    for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        const parcel = {};
        headers.forEach((h, idx) => parcel[h] = values[idx]);

        // Normalize field names (adjust based on actual GIS export format)
        parcels.push({
            parcel_id: parcel.parcel_id || parcel.pin || parcel.parcelid,
            address: parcel.situs_addr || parcel.address || parcel.situs_address,
            city: parcel.situs_city || parcel.city || 'Belleville',
            zip: parcel.situs_zip || parcel.zip,
            x: parseFloat(parcel.centroid_x || parcel.x || parcel.longitude || 0),
            y: parseFloat(parcel.centroid_y || parcel.y || parcel.latitude || 0)
        });
    }

    console.log(`Parsed ${parcels.length} parcels with coordinates`);

    // Match buildings to parcels by proximity
    // Note: This assumes building positions are in the same coordinate system
    // You may need to transform coordinates

    const update = db.prepare(`
        UPDATE buildings SET
            street_address = ?,
            zip = ?,
            parcel_id = ?,
            lat = ?,
            lng = ?,
            address_source = 'gis',
            address_verified_at = datetime('now'),
            updated_at = datetime('now')
        WHERE id = ?
    `);

    let matched = 0;
    const MATCH_THRESHOLD = 10; // Adjust based on coordinate system units

    const matchAll = db.transaction(() => {
        for (const building of buildings) {
            const pos = JSON.parse(building.position);
            const bx = pos[0];
            const bz = pos[2];

            // Find nearest parcel
            let nearest = null;
            let minDist = Infinity;

            for (const parcel of parcels) {
                if (!parcel.x || !parcel.y || !parcel.address) continue;

                const dist = Math.sqrt(
                    Math.pow(bx - parcel.x, 2) +
                    Math.pow(bz - parcel.y, 2)
                );

                if (dist < minDist && dist < MATCH_THRESHOLD) {
                    minDist = dist;
                    nearest = parcel;
                }
            }

            if (nearest) {
                update.run(
                    nearest.address,
                    nearest.zip,
                    nearest.parcel_id,
                    nearest.y,  // lat
                    nearest.x,  // lng
                    building.id
                );
                matched++;
            }
        }
    });

    matchAll();

    console.log(`\nMatched ${matched} buildings to parcel addresses`);
    logAudit('gis_import', 'system', null, { file: filePath, matched });
}

// ============================================================================
// OPENSTREETMAP NOMINATIM (Free, rate-limited)
// ============================================================================

async function enrichFromOSM(limit = 50) {
    console.log('Enriching from OpenStreetMap Nominatim...');
    console.log(`Rate limit: 1 request/second, processing ${limit} buildings`);

    const db = getDb();

    // Get buildings without addresses that have coordinates
    // Note: We need lat/lng to reverse geocode. If buildings only have
    // local coordinates, we need to transform them first.
    const buildings = db.prepare(`
        SELECT id, position, lat, lng FROM buildings
        WHERE street_address IS NULL
        AND (lat IS NOT NULL OR position IS NOT NULL)
        LIMIT ?
    `).all(limit);

    console.log(`Found ${buildings.length} buildings to process`);

    // Belleville, IL approximate center for coordinate transformation
    // These would need adjustment based on your actual coordinate system
    const BELLEVILLE_CENTER = { lat: 38.52, lng: -89.98 };
    const METERS_PER_DEGREE_LAT = 111320;
    const METERS_PER_DEGREE_LNG = 111320 * Math.cos(BELLEVILLE_CENTER.lat * Math.PI / 180);

    const update = db.prepare(`
        UPDATE buildings SET
            street_address = ?,
            city = ?,
            state = ?,
            zip = ?,
            lat = ?,
            lng = ?,
            address_source = 'osm',
            address_verified_at = datetime('now'),
            updated_at = datetime('now')
        WHERE id = ?
    `);

    let enriched = 0;

    for (const building of buildings) {
        let lat, lng;

        if (building.lat && building.lng) {
            lat = building.lat;
            lng = building.lng;
        } else {
            // Transform local coordinates to lat/lng
            // This is approximate - adjust based on your coordinate system
            const pos = JSON.parse(building.position);
            lat = BELLEVILLE_CENTER.lat + (pos[2] / METERS_PER_DEGREE_LAT);
            lng = BELLEVILLE_CENTER.lng + (pos[0] / METERS_PER_DEGREE_LNG);
        }

        try {
            // Nominatim rate limit: 1 request/second
            await sleep(1100);

            const url = `https://nominatim.openstreetmap.org/reverse?` +
                `lat=${lat}&lon=${lng}&format=json&addressdetails=1`;

            const response = await fetch(url, {
                headers: { 'User-Agent': 'BelleEpoque/1.0 (community mapping project)' }
            });

            if (!response.ok) {
                console.log(`  Error for building ${building.id}: ${response.status}`);
                continue;
            }

            const data = await response.json();

            if (data.address) {
                const addr = data.address;
                const streetAddress = [
                    addr.house_number,
                    addr.road || addr.street
                ].filter(Boolean).join(' ');

                if (streetAddress) {
                    update.run(
                        streetAddress,
                        addr.city || addr.town || addr.village || 'Belleville',
                        addr.state || 'IL',
                        addr.postcode,
                        lat,
                        lng,
                        building.id
                    );
                    enriched++;
                    console.log(`  ${building.id}: ${streetAddress}`);
                }
            }
        } catch (err) {
            console.log(`  Error for building ${building.id}: ${err.message}`);
        }
    }

    console.log(`\nEnriched ${enriched} buildings from OSM`);
    logAudit('osm_enrichment', 'system', null, { processed: buildings.length, enriched });
}

// ============================================================================
// CUSTOM CSV IMPORT
// ============================================================================

async function importFromCSV(filePath) {
    console.log(`Importing addresses from CSV: ${filePath}`);

    // Expected columns: building_id, street_address, city, state, zip
    // OR: lat, lng, street_address, city, state, zip (for coordinate matching)

    const content = readFileSync(filePath, 'utf-8');
    const lines = content.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());

    console.log(`Found ${lines.length - 1} rows`);
    console.log(`Columns: ${headers.join(', ')}`);

    const db = getDb();

    const update = db.prepare(`
        UPDATE buildings SET
            street_address = ?,
            city = COALESCE(?, city),
            state = COALESCE(?, state),
            zip = ?,
            address_source = 'csv',
            address_verified_at = datetime('now'),
            updated_at = datetime('now')
        WHERE id = ?
    `);

    let updated = 0;

    const importAll = db.transaction(() => {
        for (let i = 1; i < lines.length; i++) {
            const values = parseCSVLine(lines[i]);
            const row = {};
            headers.forEach((h, idx) => row[h] = values[idx]);

            if (row.building_id && row.street_address) {
                update.run(
                    row.street_address,
                    row.city,
                    row.state,
                    row.zip,
                    row.building_id
                );
                updated++;
            }
        }
    });

    importAll();

    console.log(`\nUpdated ${updated} buildings from CSV`);
    logAudit('csv_import', 'system', null, { file: filePath, updated });
}

// ============================================================================
// UTILITIES
// ============================================================================

function parseCSVLine(line) {
    // Handle quoted fields with commas
    const result = [];
    let current = '';
    let inQuotes = false;

    for (const char of line) {
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current.trim());

    return result;
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
    const source = args.source || 'help';

    switch (source) {
        case 'gis':
            if (!args.file) {
                console.error('Error: --file required for GIS import');
                console.error('Example: --source=gis --file=parcels.csv');
                process.exit(1);
            }
            await importFromGIS(args.file);
            break;

        case 'osm':
            await enrichFromOSM(parseInt(args.limit) || 50);
            break;

        case 'csv':
            if (!args.file) {
                console.error('Error: --file required for CSV import');
                process.exit(1);
            }
            await importFromCSV(args.file);
            break;

        default:
            console.log('Address Enrichment Script');
            console.log('=========================\n');
            console.log('Usage:');
            console.log('  node enrich-addresses.js --source=gis --file=parcels.csv');
            console.log('  node enrich-addresses.js --source=osm --limit=100');
            console.log('  node enrich-addresses.js --source=csv --file=addresses.csv\n');
            console.log('Sources:');
            console.log('  gis  - Import from St. Clair County GIS export (CSV)');
            console.log('  osm  - Query OpenStreetMap Nominatim (slow, rate-limited)');
            console.log('  csv  - Import from custom CSV with building_id column');
    }
}

main().catch(console.error);
