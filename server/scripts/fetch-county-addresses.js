/**
 * Fetch address data from St. Clair County's public ArcGIS REST API
 *
 * Source: https://arcgispublicmap.co.st-clair.il.us/server/rest/services/SCC_parcel_map_data/MapServer/29
 *
 * This is FREE public data - no API key or purchase required.
 *
 * Usage:
 *   node scripts/fetch-county-addresses.js                    # Fetch all Belleville parcels
 *   node scripts/fetch-county-addresses.js --city=Belleville  # Specific city
 *   node scripts/fetch-county-addresses.js --bbox=...         # Bounding box
 */

import { writeFileSync } from 'fs';
import { getDb, logAudit } from '../db.js';

const ARCGIS_URL = 'https://arcgispublicmap.co.st-clair.il.us/server/rest/services/SCC_parcel_map_data/MapServer/29/query';

// Downtown Belleville approximate bounding box (adjust as needed)
const DOWNTOWN_BBOX = {
    xmin: -89.995,
    ymin: 38.515,
    xmax: -89.975,
    ymax: 38.530
};

const args = process.argv.slice(2).reduce((acc, arg) => {
    const [key, value] = arg.replace('--', '').split('=');
    acc[key] = value || true;
    return acc;
}, {});

async function fetchParcels(where = "sitecity LIKE '%BELLEVILLE%'", offset = 0) {
    const params = new URLSearchParams({
        where,
        outFields: 'parcel_number,sitenum,sitepref,sitename,sitetype,sitesuff,siteadr1,sitecity,sitezip,landuse',
        returnGeometry: 'true',
        outSR: '4326',  // WGS84 lat/lng
        f: 'json',
        resultOffset: offset.toString(),
        resultRecordCount: '2000'
    });

    const url = `${ARCGIS_URL}?${params}`;
    console.log(`Fetching from offset ${offset}...`);

    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    if (data.error) {
        throw new Error(`ArcGIS error: ${data.error.message}`);
    }

    return data;
}

async function fetchAllParcels(city = 'BELLEVILLE') {
    const where = city ? `sitecity LIKE '%${city.toUpperCase()}%'` : '1=1';
    const allFeatures = [];
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
        const data = await fetchParcels(where, offset);
        const features = data.features || [];

        allFeatures.push(...features);
        console.log(`  Got ${features.length} parcels (total: ${allFeatures.length})`);

        // Check if there are more records
        hasMore = features.length === 2000;
        offset += 2000;

        // Be nice to the server
        if (hasMore) {
            await new Promise(r => setTimeout(r, 500));
        }
    }

    return allFeatures;
}

async function main() {
    const city = args.city || 'BELLEVILLE';

    console.log(`Fetching parcels for: ${city}`);
    console.log(`Source: St. Clair County Public ArcGIS REST API\n`);

    const parcels = await fetchAllParcels(city);
    console.log(`\nTotal parcels fetched: ${parcels.length}`);

    // Save raw data
    const outputFile = `./parcels-${city.toLowerCase()}.json`;
    writeFileSync(outputFile, JSON.stringify(parcels, null, 2));
    console.log(`Raw data saved to: ${outputFile}`);

    // Import to database if --import flag
    if (args.import) {
        console.log('\nImporting to database...');
        const db = getDb();

        const update = db.prepare(`
            UPDATE buildings SET
                street_address = ?,
                street_number = ?,
                street_name = ?,
                city = ?,
                zip = ?,
                parcel_id = ?,
                lat = ?,
                lng = ?,
                address_source = 'county_gis',
                address_verified_at = datetime('now'),
                updated_at = datetime('now')
            WHERE id = ?
        `);

        // Get buildings to match
        const buildings = db.prepare(`
            SELECT id, position FROM buildings WHERE street_address IS NULL
        `).all();

        console.log(`Buildings needing addresses: ${buildings.length}`);

        // Simple centroid matching (you may need to adjust coordinate systems)
        let matched = 0;

        for (const parcel of parcels) {
            if (!parcel.geometry || !parcel.attributes.siteadr1) continue;

            const rings = parcel.geometry.rings;
            if (!rings || !rings[0]) continue;

            // Calculate parcel centroid
            const points = rings[0];
            const centroid = points.reduce(
                (acc, p) => ({ x: acc.x + p[0], y: acc.y + p[1] }),
                { x: 0, y: 0 }
            );
            centroid.x /= points.length;
            centroid.y /= points.length;

            // For now, just log - coordinate matching needs calibration
            // between the parcel lat/lng and building local coordinates
        }

        console.log(`\nNote: Coordinate matching requires calibration between`);
        console.log(`parcel WGS84 coords and building local coordinates.`);
        console.log(`Run with --calibrate to set up the transformation.`);

        logAudit('county_gis_fetch', 'system', null, {
            city,
            count: parcels.length
        });
    }

    // Show sample
    console.log('\nSample addresses:');
    parcels.slice(0, 10).forEach(p => {
        const a = p.attributes;
        console.log(`  ${a.siteadr1}, ${a.sitecity} ${a.sitezip}`);
    });
}

main().catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
});
