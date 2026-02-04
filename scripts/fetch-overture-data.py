#!/usr/bin/env python3
"""
Fetch high-quality map data from Overture Maps for Belleville, IL downtown.

Overture Maps is an open data project backed by Amazon, Meta, Microsoft, and TomTom
that provides professionally cleaned and validated map data.

Requirements:
    pip install duckdb geopandas shapely pandas pyproj

Usage:
    python scripts/fetch-overture-data.py
"""

import json
import duckdb
import math
from pathlib import Path

# Belleville, IL downtown center (adjusted to actual downtown center)
# Shifted slightly south and west based on major road analysis
CENTER_LAT = 38.5170
CENTER_LON = -89.9842

# Bounding box radius in km (adjust for desired area)
RADIUS_KM = 1.2

# Output directory
OUTPUT_DIR = Path(__file__).parent.parent / "src" / "data"

# Overture Maps release (check https://docs.overturemaps.org/release-calendar/ for latest)
# Only last 2 months are kept in the bucket
OVERTURE_RELEASE = "2026-01-21.0"
OVERTURE_S3_BASE = f"s3://overturemaps-us-west-2/release/{OVERTURE_RELEASE}/theme="


def km_to_degrees(km, latitude):
    """Convert kilometers to degrees at a given latitude."""
    # 1 degree latitude ≈ 111 km
    lat_deg = km / 111.0
    # 1 degree longitude varies by latitude
    lon_deg = km / (111.0 * math.cos(math.radians(latitude)))
    return lat_deg, lon_deg


def create_bbox(center_lat, center_lon, radius_km):
    """Create a bounding box around a center point."""
    lat_delta, lon_delta = km_to_degrees(radius_km, center_lat)
    return {
        'min_lon': center_lon - lon_delta,
        'max_lon': center_lon + lon_delta,
        'min_lat': center_lat - lat_delta,
        'max_lat': center_lat + lat_delta,
    }


def latlon_to_local(lon, lat, center_lon, center_lat):
    """Convert lat/lon to local coordinate system (meters from center)."""
    # Simple equirectangular projection
    x = (lon - center_lon) * 111000 * math.cos(math.radians(center_lat))
    z = (lat - center_lat) * 111000
    return round(x, 1), round(z, 1)


def setup_duckdb():
    """Configure DuckDB with required extensions."""
    con = duckdb.connect()
    con.execute("INSTALL spatial")
    con.execute("INSTALL httpfs")
    con.execute("LOAD spatial")
    con.execute("LOAD httpfs")
    con.execute("SET s3_region='us-west-2'")
    return con


def fetch_roads(con, bbox):
    """Fetch road segments from Overture Maps."""
    print("Fetching roads from Overture Maps...")

    query = f"""
    SELECT
        id,
        names.primary AS name,
        class,
        subclass,
        ST_AsGeoJSON(geometry) as geojson
    FROM read_parquet('{OVERTURE_S3_BASE}transportation/type=segment/*', filename=true, hive_partitioning=1)
    WHERE subtype = 'road'
      AND bbox.xmin >= {bbox['min_lon']}
      AND bbox.xmax <= {bbox['max_lon']}
      AND bbox.ymin >= {bbox['min_lat']}
      AND bbox.ymax <= {bbox['max_lat']}
    """

    result = con.execute(query).fetchall()
    print(f"  Found {len(result)} road segments")

    streets = []
    for row in result:
        id_, name, road_class, subclass, geojson = row

        # Parse geometry
        geom = json.loads(geojson)
        if geom['type'] != 'LineString':
            continue

        coords = geom['coordinates']

        # Convert to local coordinates
        points = [latlon_to_local(lon, lat, CENTER_LON, CENTER_LAT)
                  for lon, lat in coords]

        # Map Overture class to our types
        type_map = {
            'motorway': 'primary',
            'trunk': 'primary',
            'primary': 'primary',
            'secondary': 'secondary',
            'tertiary': 'tertiary',
            'residential': 'residential',
            'service': 'service',
            'unclassified': 'residential',
            'living_street': 'residential',
        }
        street_type = type_map.get(road_class, 'residential')

        streets.append({
            'id': f"street-{id_}",
            'name': name or '',
            'type': street_type,
            'points': points,
        })

    return {'streets': streets}


def fetch_buildings(con, bbox):
    """Fetch building footprints from Overture Maps."""
    print("Fetching buildings from Overture Maps...")

    query = f"""
    SELECT
        id,
        names.primary AS name,
        height,
        num_floors,
        class,
        ST_AsGeoJSON(geometry) as geojson
    FROM read_parquet('{OVERTURE_S3_BASE}buildings/type=building/*', filename=true, hive_partitioning=1)
    WHERE bbox.xmin >= {bbox['min_lon']}
      AND bbox.xmax <= {bbox['max_lon']}
      AND bbox.ymin >= {bbox['min_lat']}
      AND bbox.ymax <= {bbox['max_lat']}
    """

    result = con.execute(query).fetchall()
    print(f"  Found {len(result)} buildings")

    buildings = []
    for row in result:
        id_, name, height, num_floors, bldg_class, geojson = row

        # Parse geometry
        geom = json.loads(geojson)

        # Handle Polygon or MultiPolygon
        if geom['type'] == 'Polygon':
            rings = [geom['coordinates'][0]]  # Outer ring only
        elif geom['type'] == 'MultiPolygon':
            rings = [poly[0] for poly in geom['coordinates']]
        else:
            continue

        for ring_idx, ring in enumerate(rings):
            # Convert to local coordinates
            footprint = [latlon_to_local(lon, lat, CENTER_LON, CENTER_LAT)
                        for lon, lat in ring[:-1]]  # Skip closing point

            if len(footprint) < 3:
                continue

            # Calculate center
            cx = sum(p[0] for p in footprint) / len(footprint)
            cz = sum(p[1] for p in footprint) / len(footprint)

            # Estimate height
            if height:
                bldg_height = float(height)
            elif num_floors:
                bldg_height = float(num_floors) * 3.5  # ~3.5m per floor
            else:
                bldg_height = 8 + (hash(id_) % 25)  # Random 8-33m

            # Calculate bounding box for size
            xs = [p[0] for p in footprint]
            zs = [p[1] for p in footprint]
            width = max(xs) - min(xs)
            depth = max(zs) - min(zs)

            # Generate varied pastel colors based on building ID hash
            # This creates visual variety like the original data
            color_palette = [
                '#8b7355', '#7a8b8b', '#6b6b7a', '#8b8378', '#7d8b8b',
                '#74b9ff', '#a29bfe', '#fd79a8', '#ffeaa7', '#81ecec',
                '#dfe6e9', '#b2bec3', '#636e72', '#fab1a0', '#e17055',
                '#00b894', '#00cec9', '#0984e3', '#6c5ce7', '#fdcb6e',
                '#e84393', '#55a3ff', '#ff7675', '#a0c4ff', '#bdb2ff',
            ]
            # Use hash of ID to pick consistent color
            color_idx = hash(id_) % len(color_palette)
            color = color_palette[color_idx]

            buildings.append({
                'id': f"bldg-{id_}-{ring_idx}" if ring_idx > 0 else f"bldg-{id_}",
                'name': name or '',
                'footprint': footprint,
                'position': [cx, 0, cz],
                'size': [width, bldg_height, depth],
                'color': color,
            })

    return {'buildings': buildings}


def fetch_landuse(con, bbox):
    """Fetch land use features from Overture Maps."""
    print("Fetching land use from Overture Maps...")

    all_results = []

    # Query land features
    query_land = f"""
    SELECT
        id,
        names.primary AS name,
        class,
        'land' as source_type,
        ST_AsGeoJSON(geometry) as geojson
    FROM read_parquet('{OVERTURE_S3_BASE}base/type=land/*', filename=true, hive_partitioning=1)
    WHERE bbox.xmin >= {bbox['min_lon']}
      AND bbox.xmax <= {bbox['max_lon']}
      AND bbox.ymin >= {bbox['min_lat']}
      AND bbox.ymax <= {bbox['max_lat']}
    """
    land_results = con.execute(query_land).fetchall()
    all_results.extend(land_results)
    print(f"  Found {len(land_results)} land features")

    # Query water features
    try:
        query_water = f"""
        SELECT
            id,
            names.primary AS name,
            class,
            'water' as source_type,
            ST_AsGeoJSON(geometry) as geojson
        FROM read_parquet('{OVERTURE_S3_BASE}base/type=water/*', filename=true, hive_partitioning=1)
        WHERE bbox.xmin >= {bbox['min_lon']}
          AND bbox.xmax <= {bbox['max_lon']}
          AND bbox.ymin >= {bbox['min_lat']}
          AND bbox.ymax <= {bbox['max_lat']}
        """
        water_results = con.execute(query_water).fetchall()
        all_results.extend(water_results)
        print(f"  Found {len(water_results)} water features")
    except Exception as e:
        print(f"  Water query failed: {e}")

    # Query infrastructure (parking, railways, etc.)
    try:
        query_infra = f"""
        SELECT
            id,
            names.primary AS name,
            class,
            'infrastructure' as source_type,
            ST_AsGeoJSON(geometry) as geojson
        FROM read_parquet('{OVERTURE_S3_BASE}base/type=infrastructure/*', filename=true, hive_partitioning=1)
        WHERE bbox.xmin >= {bbox['min_lon']}
          AND bbox.xmax <= {bbox['max_lon']}
          AND bbox.ymin >= {bbox['min_lat']}
          AND bbox.ymax <= {bbox['max_lat']}
        """
        infra_results = con.execute(query_infra).fetchall()
        all_results.extend(infra_results)
        print(f"  Found {len(infra_results)} infrastructure features")
    except Exception as e:
        print(f"  Infrastructure query failed: {e}")

    result = all_results
    print(f"  Total land use features: {len(result)}")

    features = []
    for row in result:
        id_, name, lu_class, source_type, geojson = row

        # Parse geometry
        geom = json.loads(geojson)

        if geom['type'] == 'Polygon':
            rings = [geom['coordinates'][0]]
        elif geom['type'] == 'MultiPolygon':
            rings = [poly[0] for poly in geom['coordinates']]
        else:
            continue

        for ring_idx, ring in enumerate(rings):
            points = [latlon_to_local(lon, lat, CENTER_LON, CENTER_LAT)
                     for lon, lat in ring[:-1]]

            if len(points) < 3:
                continue

            # Map Overture class to our types
            if source_type == 'water':
                feature_type = 'water'
            elif source_type == 'infrastructure':
                feature_type = lu_class if lu_class in ['parking', 'railway'] else 'parking'
            else:
                type_map = {
                    'park': 'park',
                    'grass': 'grass',
                    'forest': 'park',
                    'garden': 'park',
                    'meadow': 'grass',
                    'wetland': 'water',
                    'residential': 'residential',
                    'commercial': 'commercial',
                    'industrial': 'industrial',
                }
                feature_type = type_map.get(lu_class, lu_class or 'park')

            features.append({
                'id': f"{feature_type}-{id_}-{ring_idx}" if ring_idx > 0 else f"{feature_type}-{id_}",
                'type': feature_type,
                'name': name or '',
                'points': points,
            })

    return {'features': features}


def main():
    print("=" * 60)
    print("Overture Maps Data Fetcher for Belle Epoque")
    print("=" * 60)
    print(f"Center: {CENTER_LAT}°N, {CENTER_LON}°W (Belleville, IL)")
    print(f"Radius: {RADIUS_KM} km")
    print()

    # Create bounding box
    bbox = create_bbox(CENTER_LAT, CENTER_LON, RADIUS_KM)
    print(f"Bounding box: {bbox['min_lat']:.4f} to {bbox['max_lat']:.4f} lat")
    print(f"              {bbox['min_lon']:.4f} to {bbox['max_lon']:.4f} lon")
    print()

    # Setup DuckDB
    con = setup_duckdb()

    # Fetch data
    streets = fetch_roads(con, bbox)
    buildings = fetch_buildings(con, bbox)
    landuse = fetch_landuse(con, bbox)

    # Create output directory if needed
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # Save files
    print()
    print("Saving data files...")

    with open(OUTPUT_DIR / "streets.json", 'w') as f:
        json.dump(streets, f, indent=2)
    print(f"  ✓ streets.json ({len(streets['streets'])} streets)")

    with open(OUTPUT_DIR / "buildings.json", 'w') as f:
        json.dump(buildings, f, indent=2)
    print(f"  ✓ buildings.json ({len(buildings['buildings'])} buildings)")

    with open(OUTPUT_DIR / "landuse.json", 'w') as f:
        json.dump(landuse, f, indent=2)
    print(f"  ✓ landuse.json ({len(landuse['features'])} features)")

    print()
    print("Done! Refresh your app to see the new data.")


if __name__ == "__main__":
    main()
