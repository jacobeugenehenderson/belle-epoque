#!/usr/bin/env python3
"""
Recenter data on the actual Public Square fountain location.
"""

import json
import math

# OSM fountain location (the real Public Square)
FOUNTAIN_LAT = 38.522207
FOUNTAIN_LON = -89.984903

# My original center
OLD_CENTER_LAT = 38.5200
OLD_CENTER_LON = -89.9839

# Conversion
LAT_TO_METERS = 111000
LON_TO_METERS = 87000

# Calculate offset from old center to fountain
offset_x = (FOUNTAIN_LON - OLD_CENTER_LON) * LON_TO_METERS  # in meters
offset_z = -(FOUNTAIN_LAT - OLD_CENTER_LAT) * LAT_TO_METERS  # negative because +Z is south

print(f"Old center: {OLD_CENTER_LAT}, {OLD_CENTER_LON}")
print(f"Fountain (new center): {FOUNTAIN_LAT}, {FOUNTAIN_LON}")
print(f"Offset to apply: X={offset_x:.1f}m, Z={offset_z:.1f}m")
print("(Buildings need to shift by this amount to center on fountain)")

# Load and recenter buildings
with open('src/data/buildings.json') as f:
    buildings = json.load(f)['buildings']

for b in buildings:
    # Shift position
    b['position'][0] -= offset_x
    b['position'][2] -= offset_z

    # Shift footprint
    b['footprint'] = [
        [round(pt[0] - offset_x, 1), round(pt[1] - offset_z, 1)]
        for pt in b['footprint']
    ]

    # Round position
    b['position'][0] = round(b['position'][0], 1)
    b['position'][2] = round(b['position'][2], 1)

# Save buildings
with open('src/data/buildings.json', 'w') as f:
    json.dump({'buildings': buildings}, f, indent=2)
print(f"\nRecentered {len(buildings)} buildings")

# Load and recenter streets (need to re-extract with new center)
# For now, just apply offset to existing streets
with open('src/data/streets.json') as f:
    streets = json.load(f)['streets']

for s in streets:
    s['points'] = [
        [round(pt[0] - offset_x, 1), round(pt[1] - offset_z, 1)]
        for pt in s['points']
    ]

# Save streets
with open('src/data/streets.json', 'w') as f:
    json.dump({'streets': streets}, f, indent=2)
print(f"Recentered {len(streets)} streets")

# Verify - check what's near new (0, 0)
print("\nBuildings near new center (0, 0):")
for b in sorted(buildings, key=lambda x: x['position'][0]**2 + x['position'][2]**2)[:5]:
    dist = math.sqrt(b['position'][0]**2 + b['position'][2]**2)
    print(f"  {b['id']}: ({b['position'][0]:.0f}, {b['position'][2]:.0f}), dist={dist:.0f}m")

print("\nStreets near new center:")
for s in streets:
    if 'illinois' in s.get('name', '').lower():
        xs = [p[0] for p in s['points']]
        print(f"  Illinois St: X range = [{min(xs):.0f}, {max(xs):.0f}]")
        break
