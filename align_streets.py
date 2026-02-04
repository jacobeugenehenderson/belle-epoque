#!/usr/bin/env python3
"""Align streets to buildings using Illinois Street as reference."""

import json

with open('src/data/streets.json') as f:
    streets = json.load(f)['streets']

with open('src/data/buildings.json') as f:
    buildings = json.load(f)['buildings']

# Illinois Street is at X ≈ -27, should be at X = 0
# Apply offset of +27 to streets X coordinates
OFFSET_X = 27

print(f"Applying X offset of {OFFSET_X}m to streets")

for street in streets:
    street['points'] = [
        [round(pt[0] + OFFSET_X, 1), round(pt[1], 1)]
        for pt in street['points']
    ]

# Filter to streets within building bounds
bldg_xs = [pt[0] for b in buildings for pt in b['footprint']]
bldg_zs = [pt[1] for b in buildings for pt in b['footprint']]
margin = 100
min_x, max_x = min(bldg_xs) - margin, max(bldg_xs) + margin
min_z, max_z = min(bldg_zs) - margin, max(bldg_zs) + margin

filtered = []
for s in streets:
    if any(min_x <= pt[0] <= max_x and min_z <= pt[1] <= max_z for pt in s['points']):
        filtered.append(s)

print(f"Filtered from {len(streets)} to {len(filtered)} streets")

# Save
with open('src/data/streets.json', 'w') as f:
    json.dump({'streets': filtered}, f, indent=2)

# Verify Illinois Street position
for s in filtered:
    if s['name'] and 'illinois' in s['name'].lower():
        xs = [p[0] for p in s['points']]
        print(f"  {s['name']} now at avg X = {sum(xs)/len(xs):.1f}")
