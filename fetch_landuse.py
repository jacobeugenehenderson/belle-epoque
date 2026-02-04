#!/usr/bin/env python3
"""Fetch land use, parks, parking lots, and other context from OSM."""

import json
import urllib.request
import urllib.parse
import ssl

MIN_LAT, MAX_LAT = 38.516, 38.526
MIN_LON, MAX_LON = -89.993, -89.975

# Use Illinois Street center as reference (from previous extraction)
CENTER_LAT = 38.521326
CENTER_LON = -89.984205

LAT_TO_METERS = 111000
LON_TO_METERS = 87000

def to_local(lon, lat):
    x = (lon - CENTER_LON) * LON_TO_METERS
    z = -(lat - CENTER_LAT) * LAT_TO_METERS
    return round(x, 1), round(z, 1)

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

query = f"""
[out:json][timeout:60];
(
  way["landuse"]({MIN_LAT},{MIN_LON},{MAX_LAT},{MAX_LON});
  way["leisure"="park"]({MIN_LAT},{MIN_LON},{MAX_LAT},{MAX_LON});
  way["amenity"="parking"]({MIN_LAT},{MIN_LON},{MAX_LAT},{MAX_LON});
  way["natural"]({MIN_LAT},{MIN_LON},{MAX_LAT},{MAX_LON});
  way["man_made"="bridge"]({MIN_LAT},{MIN_LON},{MAX_LAT},{MAX_LON});
  way["waterway"]({MIN_LAT},{MIN_LON},{MAX_LAT},{MAX_LON});
  way["railway"]({MIN_LAT},{MIN_LON},{MAX_LAT},{MAX_LON});
);
out body;
>;
out skel qt;
"""

url = "https://overpass-api.de/api/interpreter"
data = urllib.parse.urlencode({'data': query}).encode()

print("Fetching land use data...")
req = urllib.request.Request(url, data=data)
with urllib.request.urlopen(req, timeout=120, context=ctx) as response:
    result = json.loads(response.read().decode())

nodes = {el['id']: (el['lon'], el['lat']) for el in result['elements'] if el['type'] == 'node'}

features = []
for el in result['elements']:
    if el['type'] != 'way':
        continue

    tags = el.get('tags', {})
    if not tags:
        continue

    # Determine feature type
    feature_type = None
    color = "#1a1a24"

    if tags.get('leisure') == 'park':
        feature_type = 'park'
        color = "#1a2a1a"
    elif tags.get('landuse') == 'grass':
        feature_type = 'grass'
        color = "#1a2a1a"
    elif tags.get('landuse') == 'residential':
        feature_type = 'residential'
        color = "#1c1c26"
    elif tags.get('landuse') == 'commercial':
        feature_type = 'commercial'
        color = "#1e1e28"
    elif tags.get('landuse') == 'industrial':
        feature_type = 'industrial'
        color = "#1a1a22"
    elif tags.get('amenity') == 'parking':
        feature_type = 'parking'
        color = "#202028"
    elif tags.get('natural') == 'water':
        feature_type = 'water'
        color = "#1a2a3a"
    elif tags.get('waterway'):
        feature_type = 'waterway'
        color = "#1a2a3a"
    elif tags.get('railway'):
        feature_type = 'railway'
        color = "#2a2a2a"

    if not feature_type:
        continue

    # Get polygon points
    points = []
    for nid in el.get('nodes', []):
        if nid in nodes:
            lon, lat = nodes[nid]
            x, z = to_local(lon, lat)
            points.append([x, z])

    if len(points) >= 3:
        features.append({
            'id': f"{feature_type}-{el['id']}",
            'type': feature_type,
            'name': tags.get('name', ''),
            'points': points,
            'color': color
        })

print(f"Found {len(features)} land use features")

# Count by type
by_type = {}
for f in features:
    by_type[f['type']] = by_type.get(f['type'], 0) + 1
for t, c in sorted(by_type.items()):
    print(f"  {t}: {c}")

with open('src/data/landuse.json', 'w') as f:
    json.dump({'features': features}, f, indent=2)

print(f"Wrote to src/data/landuse.json")
