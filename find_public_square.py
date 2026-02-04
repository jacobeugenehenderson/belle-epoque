#!/usr/bin/env python3
"""Find Public Square in OSM data as alignment reference."""

import json
import urllib.request
import urllib.parse
import ssl

# Downtown Belleville bounding box
MIN_LAT, MAX_LAT = 38.516, 38.526
MIN_LON, MAX_LON = -89.993, -89.975

# Overpass query for plaza, square, fountain features
query = f"""
[out:json][timeout:60];
(
  way["leisure"="park"]({MIN_LAT},{MIN_LON},{MAX_LAT},{MAX_LON});
  way["landuse"="grass"]({MIN_LAT},{MIN_LON},{MAX_LAT},{MAX_LON});
  way["amenity"="fountain"]({MIN_LAT},{MIN_LON},{MAX_LAT},{MAX_LON});
  node["amenity"="fountain"]({MIN_LAT},{MIN_LON},{MAX_LAT},{MAX_LON});
  way["place"="square"]({MIN_LAT},{MIN_LON},{MAX_LAT},{MAX_LON});
  way["highway"="pedestrian"]({MIN_LAT},{MIN_LON},{MAX_LAT},{MAX_LON});
  way["junction"="roundabout"]({MIN_LAT},{MIN_LON},{MAX_LAT},{MAX_LON});
  node["historic"]({MIN_LAT},{MIN_LON},{MAX_LAT},{MAX_LON});
  node["tourism"]({MIN_LAT},{MIN_LON},{MAX_LAT},{MAX_LON});
  way["name"~"Public Square|Fountain|Plaza",i]({MIN_LAT},{MIN_LON},{MAX_LAT},{MAX_LON});
  node["name"~"Public Square|Fountain|Plaza",i]({MIN_LAT},{MIN_LON},{MAX_LAT},{MAX_LON});
);
out body;
>;
out skel qt;
"""

url = "https://overpass-api.de/api/interpreter"
data = urllib.parse.urlencode({'data': query}).encode()

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

print("Fetching Public Square features from OSM...")
try:
    req = urllib.request.Request(url, data=data)
    with urllib.request.urlopen(req, timeout=120, context=ctx) as response:
        result = json.loads(response.read().decode())
except Exception as e:
    print(f"Error: {e}")
    exit(1)

# Parse
nodes = {}
for el in result.get('elements', []):
    if el['type'] == 'node':
        nodes[el['id']] = el

print(f"\nFound {len(result.get('elements', []))} elements")

for el in result.get('elements', []):
    tags = el.get('tags', {})
    if not tags:
        continue

    name = tags.get('name', '')
    el_type = el['type']

    if el_type == 'node':
        lat, lon = el['lat'], el['lon']
        print(f"\nNode: {name or tags}")
        print(f"  Location: {lat:.6f}, {lon:.6f}")
    elif el_type == 'way':
        print(f"\nWay: {name or tags}")
        if 'nodes' in el and el['nodes']:
            # Get center
            pts = [(nodes[nid]['lat'], nodes[nid]['lon'])
                   for nid in el['nodes'] if nid in nodes]
            if pts:
                avg_lat = sum(p[0] for p in pts) / len(pts)
                avg_lon = sum(p[1] for p in pts) / len(pts)
                print(f"  Center: {avg_lat:.6f}, {avg_lon:.6f}")
