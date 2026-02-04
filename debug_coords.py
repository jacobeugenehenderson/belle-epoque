#!/usr/bin/env python3
"""Debug: check coordinate ranges in shapefile."""

import shapefile
from pyproj import Transformer

SHP_PATH = "footprints_data/StClair_County_Building_Footprints.shp"

# Try different EPSG codes for Illinois State Plane West
transformers = {
    'EPSG:6456': Transformer.from_crs("EPSG:6456", "EPSG:4326", always_xy=True),
    'EPSG:3436': Transformer.from_crs("EPSG:3436", "EPSG:4326", always_xy=True),
    'EPSG:2193': Transformer.from_crs("EPSG:2193", "EPSG:4326", always_xy=True),
}

sf = shapefile.Reader(SHP_PATH)
print(f"Total shapes: {len(sf)}")
print(f"Bounding box: {sf.bbox}")

# Check first 10 shapes
print("\nFirst 10 shapes (raw coordinates):")
for i, shape in enumerate(sf.shapes()[:10]):
    if shape.points:
        x, y = shape.points[0]
        print(f"  Shape {i}: raw=({x:.2f}, {y:.2f})")

        for name, trans in transformers.items():
            try:
                lon, lat = trans.transform(x, y)
                print(f"    {name} -> lat={lat:.6f}, lon={lon:.6f}")
            except Exception as e:
                print(f"    {name} -> ERROR: {e}")

# Find shapes near Belleville by trying different transformations
print("\n\nSearching for Belleville (38.52, -89.98)...")
TARGET_LAT, TARGET_LON = 38.52, -89.98

for name, trans in transformers.items():
    print(f"\nUsing {name}:")
    min_dist = float('inf')
    best_shape = None

    for i, shape in enumerate(sf.shapes()[:5000]):
        if not shape.points:
            continue
        x, y = shape.points[0]
        try:
            lon, lat = trans.transform(x, y)
            dist = ((lat - TARGET_LAT)**2 + (lon - TARGET_LON)**2)**0.5
            if dist < min_dist:
                min_dist = dist
                best_shape = (i, lat, lon, x, y)
        except:
            pass

    if best_shape:
        i, lat, lon, x, y = best_shape
        print(f"  Closest shape {i}: lat={lat:.6f}, lon={lon:.6f} (dist={min_dist:.6f})")
        print(f"    Raw coords: ({x:.2f}, {y:.2f})")
