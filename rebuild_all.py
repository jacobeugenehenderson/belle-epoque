#!/usr/bin/env python3
"""
Rebuild both datasets from scratch with aligned center point.
Use Illinois Street location from OSM as the center reference.
"""

import json
import urllib.request
import urllib.parse
import ssl
import shapefile
from pyproj import Transformer

# ============ Step 1: Find Illinois Street center from OSM ============

MIN_LAT, MAX_LAT = 38.516, 38.526
MIN_LON, MAX_LON = -89.993, -89.975

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

query = f"""
[out:json][timeout:60];
way["name"="North Illinois Street"]["highway"]({MIN_LAT},{MIN_LON},{MAX_LAT},{MAX_LON});
out body;
>;
out skel qt;
"""

url = "https://overpass-api.de/api/interpreter"
data = urllib.parse.urlencode({'data': query}).encode()

print("Finding Illinois Street in OSM...")
req = urllib.request.Request(url, data=data)
with urllib.request.urlopen(req, timeout=120, context=ctx) as response:
    result = json.loads(response.read().decode())

# Get Illinois Street coordinates
nodes = {el['id']: (el['lon'], el['lat']) for el in result['elements'] if el['type'] == 'node'}
illinois_coords = []
for el in result['elements']:
    if el['type'] == 'way':
        for nid in el.get('nodes', []):
            if nid in nodes:
                illinois_coords.append(nodes[nid])

if illinois_coords:
    avg_lon = sum(c[0] for c in illinois_coords) / len(illinois_coords)
    avg_lat = sum(c[1] for c in illinois_coords) / len(illinois_coords)
    print(f"Illinois Street center (OSM): {avg_lat:.6f}, {avg_lon:.6f}")
else:
    print("Could not find Illinois Street!")
    exit(1)

# Use Illinois Street longitude as X=0, and find a good latitude for center
# (maybe use the middle of the street)
lats = [c[1] for c in illinois_coords]
mid_lat = (min(lats) + max(lats)) / 2

CENTER_LON = avg_lon  # Illinois Street longitude
CENTER_LAT = mid_lat  # Middle of Illinois Street

print(f"New center point: {CENTER_LAT:.6f}, {CENTER_LON:.6f}")

LAT_TO_METERS = 111000
LON_TO_METERS = 87000

def to_local(lon, lat):
    x = (lon - CENTER_LON) * LON_TO_METERS
    z = -(lat - CENTER_LAT) * LAT_TO_METERS
    return round(x, 1), round(z, 1)

# ============ Step 2: Extract streets with new center ============

print("\nFetching all streets...")
query = f"""
[out:json][timeout:60];
(
  way["highway"~"primary|secondary|tertiary|residential|service"]({MIN_LAT},{MIN_LON},{MAX_LAT},{MAX_LON});
);
out body;
>;
out skel qt;
"""

data = urllib.parse.urlencode({'data': query}).encode()
req = urllib.request.Request(url, data=data)
with urllib.request.urlopen(req, timeout=120, context=ctx) as response:
    result = json.loads(response.read().decode())

nodes = {el['id']: (el['lon'], el['lat']) for el in result['elements'] if el['type'] == 'node'}

street_types = {
    'primary': {'width': 10, 'color': '#3a3a4a'},
    'secondary': {'width': 8, 'color': '#3a3a4a'},
    'tertiary': {'width': 7, 'color': '#353545'},
    'residential': {'width': 6, 'color': '#353545'},
    'service': {'width': 4, 'color': '#303040'},
}

streets = []
for el in result['elements']:
    if el['type'] != 'way' or 'nodes' not in el:
        continue

    tags = el.get('tags', {})
    highway_type = tags.get('highway', 'residential')
    name = tags.get('name', '')

    points = []
    for nid in el['nodes']:
        if nid in nodes:
            lon, lat = nodes[nid]
            x, z = to_local(lon, lat)
            points.append([x, z])

    if len(points) >= 2:
        type_info = street_types.get(highway_type, street_types['residential'])
        streets.append({
            'id': f"street-{el['id']}",
            'name': name,
            'type': highway_type,
            'points': points,
            'width': type_info['width'],
            'color': type_info['color'],
        })

print(f"Extracted {len(streets)} streets")

# Filter to area
streets = [s for s in streets if any(-900 < p[0] < 900 and -800 < p[1] < 600 for p in s['points'])]
print(f"Filtered to {len(streets)} streets in area")

with open('src/data/streets.json', 'w') as f:
    json.dump({'streets': streets}, f, indent=2)

# Verify Illinois Street position
for s in streets:
    if s['name'] and 'illinois' in s['name'].lower():
        xs = [p[0] for p in s['points']]
        print(f"  {s['name']} X: [{min(xs):.0f}, {max(xs):.0f}]")

# ============ Step 3: Extract buildings with new center ============

print("\nReading building shapefile...")
transformer = Transformer.from_crs("EPSG:3436", "EPSG:4326", always_xy=True)

sf = shapefile.Reader("footprints_data/StClair_County_Building_Footprints.shp")

buildings = []
for i, shape in enumerate(sf.shapes()):
    if not shape.points:
        continue

    # Convert first point
    x, y = shape.points[0]
    try:
        lon, lat = transformer.transform(x, y)
    except:
        continue

    if not (MIN_LAT <= lat <= MAX_LAT and MIN_LON <= lon <= MAX_LON):
        continue

    # Convert all points
    local_points = []
    for px, py in shape.points:
        plon, plat = transformer.transform(px, py)
        lx, lz = to_local(plon, plat)
        local_points.append([lx, lz])

    # Simplify
    step = max(1, len(local_points) // 20)
    local_points = [local_points[i] for i in range(0, len(local_points), step)]

    xs = [p[0] for p in local_points]
    zs = [p[1] for p in local_points]
    width = max(xs) - min(xs)
    depth = max(zs) - min(zs)

    if width < 3 or depth < 3:
        continue

    area = width * depth
    if area < 50:
        height = 5 + area / 10
    elif area < 200:
        height = 8 + area / 30
    elif area < 500:
        height = 12 + area / 50
    else:
        height = 18 + min(area / 80, 25)

    buildings.append({
        'id': f'bldg-{len(buildings)+1}',
        'footprint': local_points,
        'position': [round((min(xs)+max(xs))/2, 1), 0, round((min(zs)+max(zs))/2, 1)],
        'size': [round(width, 1), round(height, 1), round(depth, 1)],
    })

print(f"Extracted {len(buildings)} buildings")

# Sort by distance from center
buildings.sort(key=lambda b: b['position'][0]**2 + b['position'][2]**2)

# Assign colors
colors = ["#74b9ff", "#a29bfe", "#fd79a8", "#ffeaa7", "#81ecec",
          "#fab1a0", "#00b894", "#e17055", "#6c5ce7", "#fdcb6e",
          "#55efc4", "#b2bec3", "#dfe6e9", "#636e72"]

for i, b in enumerate(buildings):
    b['color'] = colors[i % len(colors)]
    b['id'] = f'bldg-{i+1}'

with open('src/data/buildings.json', 'w') as f:
    json.dump({'buildings': buildings}, f, indent=2)

print(f"Wrote {len(buildings)} buildings")

# Verify
print("\nBuildings near center:")
for b in buildings[:5]:
    print(f"  {b['id']}: ({b['position'][0]:.0f}, {b['position'][2]:.0f})")
