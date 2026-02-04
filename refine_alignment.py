#!/usr/bin/env python3
"""
Refine street alignment by analyzing building edges vs street positions.
"""

import json

with open('src/data/streets.json') as f:
    streets = json.load(f)['streets']

with open('src/data/buildings.json') as f:
    buildings = json.load(f)['buildings']

# Find Illinois Street average X position
illinois = [s for s in streets if s.get('name') and 'illinois' in s['name'].lower()]
illinois_x = sum(p[0] for s in illinois for p in s['points']) / sum(len(s['points']) for s in illinois)
print(f"Illinois Street center X: {illinois_x:.1f}")

# Illinois Street runs N-S through downtown
# Buildings should be on SIDES of the street, not overlapping
# Find buildings that are likely ON Illinois Street (their center X is close to street X)

# In reality, buildings along Illinois St should have:
# - West-side buildings: east edge near illinois_x - street_half_width
# - East-side buildings: west edge near illinois_x + street_half_width

# Let's look at buildings near the street and see where their edges are
print("\nBuildings near Illinois Street (|X| < 20):")
near = [b for b in buildings if abs(b['position'][0] - illinois_x) < 20]
for b in sorted(near, key=lambda x: x['position'][0])[:15]:
    cx = b['position'][0]
    half_w = b['size'][0] / 2
    west_edge = cx - half_w
    east_edge = cx + half_w
    print(f"  {b['id']}: center={cx:.0f}, edges=[{west_edge:.0f}, {east_edge:.0f}]")

# Most buildings touching X=0 suggest the building data is offset
# Let's compute what offset would put building edges AT the street edges

# For a primary street with ~10m width, edges are at X = illinois_x ± 5
street_half_width = 6  # 12m street / 2

print(f"\nIf Illinois St edges are at X = {illinois_x - street_half_width:.1f} and {illinois_x + street_half_width:.1f}")

# Find buildings whose west edge is closest to the east edge of the street
# (buildings on the EAST side of Illinois)
east_side_buildings = [b for b in buildings if b['position'][0] > illinois_x]
if east_side_buildings:
    closest_east = min(east_side_buildings,
                       key=lambda b: b['position'][0] - b['size'][0]/2)
    b = closest_east
    west_edge = b['position'][0] - b['size'][0]/2
    print(f"\nClosest building on EAST side: {b['id']}")
    print(f"  Its west edge: {west_edge:.1f}")
    print(f"  Street east edge: {illinois_x + street_half_width:.1f}")
    offset_needed = west_edge - (illinois_x + street_half_width)
    print(f"  Offset needed to align: {offset_needed:.1f}m (shift streets EAST)")
