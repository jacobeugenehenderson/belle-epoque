#!/usr/bin/env python3
"""Final pass: filter streets to building area and verify alignment."""

import json

with open('src/data/streets.json') as f:
    streets = json.load(f)['streets']

with open('src/data/buildings.json') as f:
    buildings = json.load(f)['buildings']

# Get building bounds
bldg_xs = [pt[0] for b in buildings for pt in b['footprint']]
bldg_zs = [pt[1] for b in buildings for pt in b['footprint']]
min_x, max_x = min(bldg_xs), max(bldg_xs)
min_z, max_z = min(bldg_zs), max(bldg_zs)

# Add margin
margin = 30
min_x -= margin
max_x += margin
min_z -= margin
max_z += margin

print(f"Filtering streets to area: X=[{min_x:.0f},{max_x:.0f}] Z=[{min_z:.0f},{max_z:.0f}]")

# Filter and clip streets
filtered = []
for s in streets:
    # Check if any point is in bounds
    pts_in_bounds = [
        pt for pt in s['points']
        if min_x <= pt[0] <= max_x and min_z <= pt[1] <= max_z
    ]

    if len(pts_in_bounds) >= 2:
        s['points'] = pts_in_bounds
        filtered.append(s)

print(f"Kept {len(filtered)} streets")

# Save
with open('src/data/streets.json', 'w') as f:
    json.dump({'streets': filtered}, f, indent=2)

# Stats
by_type = {}
for s in filtered:
    t = s['type']
    by_type[t] = by_type.get(t, 0) + 1

print("\nStreets by type:")
for t, c in sorted(by_type.items(), key=lambda x: -x[1]):
    print(f"  {t}: {c}")

# Named streets
named = [s for s in filtered if s['name']]
print(f"\n{len(named)} named streets")
