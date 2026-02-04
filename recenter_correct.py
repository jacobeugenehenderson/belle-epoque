#!/usr/bin/env python3
"""
Correctly recenter data on the actual Public Square fountain.
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

# To recenter on fountain:
# Old system: (0,0) = OLD_CENTER
# New system: (0,0) = FOUNTAIN
# Point P at old coords (x,z) should be at new coords:
#   new_x = x + (OLD_CENTER_LON - FOUNTAIN_LON) * LON_TO_METERS
#   new_z = z - (OLD_CENTER_LAT - FOUNTAIN_LAT) * LAT_TO_METERS

shift_x = (OLD_CENTER_LON - FOUNTAIN_LON) * LON_TO_METERS
shift_z = -(OLD_CENTER_LAT - FOUNTAIN_LAT) * LAT_TO_METERS

print(f"Fountain is at: {FOUNTAIN_LAT}, {FOUNTAIN_LON}")
print(f"Shift to apply: X={shift_x:.1f}m, Z={shift_z:.1f}m")

# First, undo the previous wrong recenter by re-extracting
# Let me just recalculate from scratch

# Actually, let me re-extract buildings fresh
# For now, apply the inverse of the wrong offset plus the correct offset

# The wrong offset applied was: x -= -87.3, z -= -245 (i.e., x += 87.3, z += 245)
# To undo: x -= 87.3, z -= 245
# Then apply correct offset: x += shift_x, z += shift_z

undo_x = -87.3  # undo wrong offset
undo_z = -245.0

total_shift_x = undo_x + shift_x
total_shift_z = undo_z + shift_z

print(f"Total shift (undo wrong + apply correct): X={total_shift_x:.1f}, Z={total_shift_z:.1f}")

# Load buildings
with open('src/data/buildings.json') as f:
    buildings = json.load(f)['buildings']

for b in buildings:
    b['position'][0] = round(b['position'][0] + total_shift_x, 1)
    b['position'][2] = round(b['position'][2] + total_shift_z, 1)
    b['footprint'] = [
        [round(pt[0] + total_shift_x, 1), round(pt[1] + total_shift_z, 1)]
        for pt in b['footprint']
    ]

with open('src/data/buildings.json', 'w') as f:
    json.dump({'buildings': buildings}, f, indent=2)
print(f"Fixed {len(buildings)} buildings")

# Load streets
with open('src/data/streets.json') as f:
    streets = json.load(f)['streets']

for s in streets:
    s['points'] = [
        [round(pt[0] + total_shift_x, 1), round(pt[1] + total_shift_z, 1)]
        for pt in s['points']
    ]

with open('src/data/streets.json', 'w') as f:
    json.dump({'streets': streets}, f, indent=2)
print(f"Fixed {len(streets)} streets")

# Verify
print("\nBuildings near (0,0):")
for b in sorted(buildings, key=lambda x: x['position'][0]**2 + x['position'][2]**2)[:5]:
    dist = math.sqrt(b['position'][0]**2 + b['position'][2]**2)
    print(f"  {b['id']}: ({b['position'][0]:.0f}, {b['position'][2]:.0f}), dist={dist:.0f}m")

for s in streets:
    if 'illinois' in s.get('name', '').lower():
        xs = [p[0] for p in s['points']]
        print(f"\nIllinois St X: [{min(xs):.0f}, {max(xs):.0f}]")
        break
