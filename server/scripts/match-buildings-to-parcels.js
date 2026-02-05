/**
 * Match buildings to parcels and enrich with addresses
 *
 * Uses coordinate transformation calibrated from the courthouse:
 * Building coords (0,0) ≈ WGS84 (38.513279, -89.984784)
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { getDb, logAudit } from '../db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Coordinate transformation constants
const ORIGIN_LAT = 38.513279;
const ORIGIN_LNG = -89.984784;
const METERS_PER_DEG_LAT = 111000;
const METERS_PER_DEG_LNG = 86854;  // at latitude 38.5°

function buildingToWGS84(x, z) {
    return {
        lat: ORIGIN_LAT + (z / METERS_PER_DEG_LAT),
        lng: ORIGIN_LNG + (x / METERS_PER_DEG_LNG)
    };
}

function wgs84ToBuilding(lat, lng) {
    return {
        x: (lng - ORIGIN_LNG) * METERS_PER_DEG_LNG,
        z: (lat - ORIGIN_LAT) * METERS_PER_DEG_LAT
    };
}

// Check if a point is inside a polygon (ray casting)
function pointInPolygon(point, polygon) {
    const [px, py] = point;
    let inside = false;

    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const [xi, yi] = polygon[i];
        const [xj, yj] = polygon[j];

        if (((yi > py) !== (yj > py)) &&
            (px < (xj - xi) * (py - yi) / (yj - yi) + xi)) {
            inside = !inside;
        }
    }

    return inside;
}

async function main() {
    console.log('Loading data...');

    // Load parcels
    const parcelsFile = join(__dirname, '../parcels-belleville.json');
    const parcels = JSON.parse(readFileSync(parcelsFile, 'utf-8'));
    console.log(`Loaded ${parcels.length} parcels`);

    // Load buildings from database
    const db = getDb();
    const buildings = db.prepare('SELECT * FROM buildings').all();
    console.log(`Loaded ${buildings.length} buildings from database`);

    // Filter parcels with addresses and geometry
    const validParcels = parcels.filter(p =>
        p.geometry &&
        p.geometry.rings &&
        p.geometry.rings[0] &&
        p.attributes.siteadr1
    );
    console.log(`Valid parcels with addresses: ${validParcels.length}`);

    // Pre-compute parcel centroids for faster matching
    const parcelData = validParcels.map(p => {
        const ring = p.geometry.rings[0];
        const centroid = ring.reduce(
            (acc, [lng, lat]) => ({ lat: acc.lat + lat, lng: acc.lng + lng }),
            { lat: 0, lng: 0 }
        );
        centroid.lat /= ring.length;
        centroid.lng /= ring.length;

        return {
            ...p,
            centroid,
            ring
        };
    });

    console.log('\nMatching buildings to parcels...');

    const update = db.prepare(`
        UPDATE buildings SET
            street_address = ?,
            city = ?,
            zip = ?,
            parcel_id = ?,
            lat = ?,
            lng = ?,
            address_source = 'county_gis_match',
            address_verified_at = datetime('now'),
            updated_at = datetime('now')
        WHERE id = ?
    `);

    let matched = 0;
    let unmatched = 0;
    const unmatchedBuildings = [];
    const matchResults = [];

    const SEARCH_RADIUS_DEG = 0.0005; // ~50 meters

    for (const building of buildings) {
        const pos = JSON.parse(building.position);
        const bldgWGS = buildingToWGS84(pos[0], pos[2]);

        // Find nearby parcels
        const nearby = parcelData.filter(p =>
            Math.abs(p.centroid.lat - bldgWGS.lat) < SEARCH_RADIUS_DEG &&
            Math.abs(p.centroid.lng - bldgWGS.lng) < SEARCH_RADIUS_DEG
        );

        // First try: find parcel whose polygon contains the building centroid
        let matchedParcel = nearby.find(p =>
            pointInPolygon([bldgWGS.lng, bldgWGS.lat], p.ring)
        );

        // Second try: find nearest parcel centroid
        if (!matchedParcel && nearby.length > 0) {
            let minDist = Infinity;
            for (const p of nearby) {
                const dist = Math.sqrt(
                    Math.pow(p.centroid.lat - bldgWGS.lat, 2) +
                    Math.pow(p.centroid.lng - bldgWGS.lng, 2)
                );
                if (dist < minDist) {
                    minDist = dist;
                    matchedParcel = p;
                }
            }
            // Only accept if within 30 meters
            if (minDist * 111000 > 30) {
                matchedParcel = null;
            }
        }

        if (matchedParcel) {
            const attrs = matchedParcel.attributes;
            const address = attrs.siteadr1;
            const city = attrs.sitecity || 'BELLEVILLE';
            const zip = (attrs.sitezip || '').toString().substring(0, 5);
            const parcelId = attrs.parcel_number;

            update.run(
                address,
                city,
                zip,
                parcelId,
                bldgWGS.lat,
                bldgWGS.lng,
                building.id
            );

            matched++;
            matchResults.push({
                building_id: building.id,
                building_name: building.name,
                address,
                city,
                zip,
                parcel_id: parcelId,
                lat: bldgWGS.lat,
                lng: bldgWGS.lng
            });
        } else {
            unmatched++;
            if (building.name) {
                unmatchedBuildings.push({
                    id: building.id,
                    name: building.name,
                    lat: bldgWGS.lat,
                    lng: bldgWGS.lng
                });
            }
        }
    }

    console.log(`\nResults:`);
    console.log(`  Matched: ${matched} buildings`);
    console.log(`  Unmatched: ${unmatched} buildings`);
    console.log(`  Match rate: ${(matched / buildings.length * 100).toFixed(1)}%`);

    // Save match results
    writeFileSync(
        join(__dirname, '../match-results.json'),
        JSON.stringify(matchResults, null, 2)
    );
    console.log(`\nMatch results saved to match-results.json`);

    // Show some matched named buildings
    const namedMatches = matchResults.filter(m => m.building_name);
    if (namedMatches.length > 0) {
        console.log('\nSample matched named buildings:');
        namedMatches.slice(0, 15).forEach(m => {
            console.log(`  ${m.building_name}: ${m.address}, ${m.city}`);
        });
    }

    // Show unmatched named buildings
    if (unmatchedBuildings.length > 0) {
        console.log('\nUnmatched named buildings:');
        unmatchedBuildings.forEach(b => {
            console.log(`  ${b.name} (${b.lat.toFixed(5)}, ${b.lng.toFixed(5)})`);
        });
    }

    logAudit('parcel_matching', 'system', null, {
        matched,
        unmatched,
        match_rate: (matched / buildings.length * 100).toFixed(1) + '%'
    });

    // Update stats
    const stats = db.prepare(`
        SELECT
            COUNT(*) as total,
            COUNT(street_address) as with_address
        FROM buildings
    `).get();

    console.log('\nDatabase stats after matching:');
    console.log(`  Total buildings: ${stats.total}`);
    console.log(`  With addresses: ${stats.with_address}`);
}

main().catch(console.error);
