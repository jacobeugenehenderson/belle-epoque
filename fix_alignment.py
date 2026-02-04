#!/usr/bin/env python3
"""Fix alignment between buildings and streets by applying offset."""

import json

# Load data
with open('src/data/buildings.json') as f:
    buildings = json.load(f)['buildings']

with open('src/data/streets.json') as f:
    streets_data = json.load(f)
    streets = streets_data['streets']

# Calculate centers
bldg_xs = [pt[0] for b in buildings for pt in b['footprint']]
bldg_zs = [pt[1] for b in buildings for pt in b['footprint']]
bldg_center_x = (min(bldg_xs) + max(bldg_xs)) / 2
bldg_center_z = (min(bldg_zs) + max(bldg_zs)) / 2

street_xs = [pt[0] for s in streets for pt in s['points']]
street_zs = [pt[1] for s in streets for pt in s['points']]
street_center_x = (min(street_xs) + max(street_xs)) / 2
street_center_z = (min(street_zs) + max(street_zs)) / 2

# Offset to apply to streets
offset_x = bldg_center_x - street_center_x
offset_z = bldg_center_z - street_center_z

print(f"Applying offset: X={offset_x:.1f}m, Z={offset_z:.1f}m")

# Apply offset to all street points
for street in streets:
    street['points'] = [
        [round(pt[0] + offset_x, 1), round(pt[1] + offset_z, 1)]
        for pt in street['points']
    ]

# Filter streets to only those within building bounds (with some margin)
margin = 50
min_x, max_x = min(bldg_xs) - margin, max(bldg_xs) + margin
min_z, max_z = min(bldg_zs) - margin, max(bldg_zs) + margin

filtered_streets = []
for street in streets:
    # Keep street if any point is within bounds
    in_bounds = any(
        min_x <= pt[0] <= max_x and min_z <= pt[1] <= max_z
        for pt in street['points']
    )
    if in_bounds:
        # Clip points to bounds
        filtered_streets.append(street)

print(f"Streets before filtering: {len(streets)}")
print(f"Streets after filtering: {len(filtered_streets)}")

# Verify alignment
new_street_xs = [pt[0] for s in filtered_streets for pt in s['points']]
new_street_zs = [pt[1] for s in filtered_streets for pt in s['points']]

print(f"\nNew streets bounding box:")
print(f"  X: {min(new_street_xs):.1f} to {max(new_street_xs):.1f}")
print(f"  Z: {min(new_street_zs):.1f} to {max(new_street_zs):.1f}")

print(f"\nBuildings bounding box:")
print(f"  X: {min(bldg_xs):.1f} to {max(bldg_xs):.1f}")
print(f"  Z: {min(bldg_zs):.1f} to {max(bldg_zs):.1f}")

# Save
with open('src/data/streets.json', 'w') as f:
    json.dump({'streets': filtered_streets}, f, indent=2)

print(f"\nWrote {len(filtered_streets)} aligned streets to src/data/streets.json")
