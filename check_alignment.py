#!/usr/bin/env python3
"""Check and fix alignment between buildings and streets."""

import json

# Load data
with open('src/data/buildings.json') as f:
    buildings = json.load(f)['buildings']

with open('src/data/streets.json') as f:
    streets = json.load(f)['streets']

# Find bounding boxes
bldg_xs = []
bldg_zs = []
for b in buildings:
    for pt in b['footprint']:
        bldg_xs.append(pt[0])
        bldg_zs.append(pt[1])

street_xs = []
street_zs = []
for s in streets:
    for pt in s['points']:
        street_xs.append(pt[0])
        street_zs.append(pt[1])

print("Buildings bounding box:")
print(f"  X: {min(bldg_xs):.1f} to {max(bldg_xs):.1f} (center: {(min(bldg_xs)+max(bldg_xs))/2:.1f})")
print(f"  Z: {min(bldg_zs):.1f} to {max(bldg_zs):.1f} (center: {(min(bldg_zs)+max(bldg_zs))/2:.1f})")

print("\nStreets bounding box:")
print(f"  X: {min(street_xs):.1f} to {max(street_xs):.1f} (center: {(min(street_xs)+max(street_xs))/2:.1f})")
print(f"  Z: {min(street_zs):.1f} to {max(street_zs):.1f} (center: {(min(street_zs)+max(street_zs))/2:.1f})")

# Calculate offset
bldg_center_x = (min(bldg_xs) + max(bldg_xs)) / 2
bldg_center_z = (min(bldg_zs) + max(bldg_zs)) / 2
street_center_x = (min(street_xs) + max(street_xs)) / 2
street_center_z = (min(street_zs) + max(street_zs)) / 2

offset_x = bldg_center_x - street_center_x
offset_z = bldg_center_z - street_center_z

print(f"\nOffset (buildings - streets):")
print(f"  X: {offset_x:.1f}m")
print(f"  Z: {offset_z:.1f}m")

# Look for Main Street in streets data
main_streets = [s for s in streets if 'main' in s['name'].lower()]
print(f"\nMain Street segments: {len(main_streets)}")
for s in main_streets[:3]:
    pts = s['points']
    avg_z = sum(p[1] for p in pts) / len(pts)
    print(f"  {s['name']}: Z avg = {avg_z:.1f}")
