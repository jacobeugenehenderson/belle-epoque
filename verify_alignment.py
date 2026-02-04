#!/usr/bin/env python3
"""Verify alignment by checking what's near center (0,0) = Public Square."""

import json
import math

with open('src/data/buildings.json') as f:
    buildings = json.load(f)['buildings']

with open('src/data/streets.json') as f:
    streets = json.load(f)['streets']

def dist_to_center(x, z):
    return math.sqrt(x*x + z*z)

# Buildings near center
print("Buildings nearest to (0,0):")
buildings_by_dist = sorted(buildings, key=lambda b: dist_to_center(b['position'][0], b['position'][2]))
for b in buildings_by_dist[:5]:
    d = dist_to_center(b['position'][0], b['position'][2])
    print(f"  {b['id']}: ({b['position'][0]:.0f}, {b['position'][2]:.0f}) - dist={d:.0f}m, size={b['size'][0]:.0f}x{b['size'][2]:.0f}")

# Streets near center
print("\nStreets passing near (0,0):")
street_min_dists = []
for s in streets:
    min_dist = min(dist_to_center(pt[0], pt[1]) for pt in s['points'])
    street_min_dists.append((s, min_dist))

street_min_dists.sort(key=lambda x: x[1])
for s, d in street_min_dists[:10]:
    # Find the point closest to center
    closest_pt = min(s['points'], key=lambda pt: dist_to_center(pt[0], pt[1]))
    name = s['name'] or f"unnamed {s['type']}"
    print(f"  {name}: closest point ({closest_pt[0]:.0f}, {closest_pt[1]:.0f}) - dist={d:.0f}m")

# Check if Main Street runs through the expected area
print("\n\nLooking for main corridors (East-West streets near Z=0):")
for s in streets:
    if not s['points']:
        continue
    # Check if street runs roughly E-W and crosses near Z=0
    zs = [pt[1] for pt in s['points']]
    xs = [pt[0] for pt in s['points']]
    z_range = max(zs) - min(zs)
    x_range = max(xs) - min(xs)

    # E-W street: x_range >> z_range, and z near 0
    if x_range > 100 and x_range > z_range * 2:
        avg_z = sum(zs) / len(zs)
        if -100 < avg_z < 100:
            name = s['name'] or f"unnamed {s['type']}"
            print(f"  {name}: X=[{min(xs):.0f}, {max(xs):.0f}], avg Z={avg_z:.0f}")
