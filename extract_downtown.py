#!/usr/bin/env python3
"""
Extract downtown Belleville building footprints from St. Clair County shapefile.
Converts from Illinois State Plane West to local meters centered on Public Square.
"""

import shapefile
from pyproj import Transformer
import json

# Input shapefile
SHP_PATH = "footprints_data/StClair_County_Building_Footprints.shp"

# Downtown Belleville bounding box (WGS84)
# Public Square is approximately at 38.5200, -89.9839
MIN_LAT, MAX_LAT = 38.516, 38.526
MIN_LON, MAX_LON = -89.993, -89.975

# Center point (Public Square fountain)
CENTER_LAT = 38.5200
CENTER_LON = -89.9839

# Transformer: Illinois State Plane West (EPSG:3436) to WGS84
transformer_to_wgs84 = Transformer.from_crs(
    "EPSG:3436",  # NAD83 / Illinois West (ftUS)
    "EPSG:4326",  # WGS84
    always_xy=True
)

# For local meter coordinates
# At 38.5N: 1 degree lat ≈ 111,000 meters, 1 degree lon ≈ 87,000 meters
LAT_TO_METERS = 111000
LON_TO_METERS = 87000

def convert_to_local(lon, lat):
    """Convert WGS84 to local meters centered on Public Square."""
    x = (lon - CENTER_LON) * LON_TO_METERS
    z = -(lat - CENTER_LAT) * LAT_TO_METERS  # Negative because +Z is south in Three.js
    return x, z

def simplify_polygon(points, tolerance=0.5):
    """Simple polygon simplification."""
    if len(points) <= 4:
        return points

    # Keep every nth point based on total count
    step = max(1, len(points) // 20)
    simplified = [points[i] for i in range(0, len(points), step)]

    # Ensure closed polygon
    if simplified[0] != simplified[-1]:
        simplified.append(simplified[0])

    return simplified

def main():
    print("Reading shapefile...")
    sf = shapefile.Reader(SHP_PATH)

    buildings = []
    total_records = len(sf)
    in_bounds = 0

    print(f"Total records in shapefile: {total_records}")
    print(f"Filtering to downtown Belleville ({MIN_LAT}-{MAX_LAT}, {MIN_LON}-{MAX_LON})...")

    for i, shape in enumerate(sf.shapes()):
        if i % 20000 == 0:
            print(f"  Processing record {i}/{total_records}...")

        points = shape.points
        if not points:
            continue

        # Convert first point to check bounds
        x, y = points[0]
        try:
            lon, lat = transformer_to_wgs84.transform(x, y)
        except:
            continue

        # Check if in downtown Belleville
        if not (MIN_LAT <= lat <= MAX_LAT and MIN_LON <= lon <= MAX_LON):
            continue

        in_bounds += 1

        # Convert all points to local coordinates
        local_points = []
        for px, py in points:
            plon, plat = transformer_to_wgs84.transform(px, py)
            lx, lz = convert_to_local(plon, plat)
            local_points.append([round(lx, 1), round(lz, 1)])

        # Simplify polygon
        local_points = simplify_polygon(local_points)

        # Get bounds
        xs = [p[0] for p in local_points]
        zs = [p[1] for p in local_points]
        min_x, max_x = min(xs), max(xs)
        min_z, max_z = min(zs), max(zs)

        width = max_x - min_x
        depth = max_z - min_z
        center_x = (min_x + max_x) / 2
        center_z = (min_z + max_z) / 2

        # Skip very tiny buildings
        if width < 3 or depth < 3:
            continue

        # Estimate height based on footprint area
        area = width * depth
        if area < 50:
            height = 5 + (area / 10)
        elif area < 200:
            height = 8 + (area / 30)
        elif area < 500:
            height = 12 + (area / 50)
        else:
            height = 18 + min(area / 80, 25)

        building = {
            'id': f'bldg-{in_bounds}',
            'footprint': local_points,
            'position': [round(center_x, 1), 0, round(center_z, 1)],
            'size': [round(width, 1), round(height, 1), round(depth, 1)],
        }

        buildings.append(building)

    print(f"\nFound {len(buildings)} buildings in downtown Belleville")

    # Sort by distance from center
    buildings.sort(key=lambda b: b['position'][0]**2 + b['position'][2]**2)

    # Assign colors from palette
    colors = [
        "#74b9ff", "#a29bfe", "#fd79a8", "#ffeaa7", "#81ecec",
        "#fab1a0", "#00b894", "#e17055", "#6c5ce7", "#fdcb6e",
        "#55efc4", "#b2bec3", "#dfe6e9", "#636e72"
    ]

    for i, b in enumerate(buildings):
        b['color'] = colors[i % len(colors)]
        # Re-number IDs after sorting
        b['id'] = f'bldg-{i+1}'

    # Output
    output = {'buildings': buildings}

    with open('src/data/buildings.json', 'w') as f:
        json.dump(output, f, indent=2)

    print(f"Wrote {len(buildings)} buildings to src/data/buildings.json")

    # Summary
    if buildings:
        print("\nBounding box of all buildings:")
        all_x = [b['position'][0] for b in buildings]
        all_z = [b['position'][2] for b in buildings]
        print(f"  X: {min(all_x):.1f} to {max(all_x):.1f}")
        print(f"  Z: {min(all_z):.1f} to {max(all_z):.1f}")

        print("\nSample buildings near center:")
        for b in buildings[:10]:
            print(f"  {b['id']}: pos=({b['position'][0]:.0f}, {b['position'][2]:.0f}), "
                  f"size={b['size'][0]:.0f}x{b['size'][2]:.0f}, h={b['size'][1]:.0f}")

if __name__ == '__main__':
    main()
