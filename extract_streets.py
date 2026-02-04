#!/usr/bin/env python3
"""
Extract street data for downtown Belleville from OpenStreetMap via Overpass API.
"""

import json
import urllib.request
import urllib.parse
import ssl

# Downtown Belleville bounding box (same as buildings)
MIN_LAT, MAX_LAT = 38.516, 38.526
MIN_LON, MAX_LON = -89.993, -89.975

# Center point (Public Square)
CENTER_LAT = 38.5200
CENTER_LON = -89.9839

# Conversion factors
LAT_TO_METERS = 111000
LON_TO_METERS = 87000

def convert_to_local(lon, lat):
    """Convert WGS84 to local meters centered on Public Square."""
    x = (lon - CENTER_LON) * LON_TO_METERS
    z = -(lat - CENTER_LAT) * LAT_TO_METERS
    return round(x, 1), round(z, 1)

def main():
    # Overpass query for streets
    query = f"""
    [out:json][timeout:60];
    (
      way["highway"~"primary|secondary|tertiary|residential|service|footway|path"]({MIN_LAT},{MIN_LON},{MAX_LAT},{MAX_LON});
    );
    out body;
    >;
    out skel qt;
    """

    url = "https://overpass-api.de/api/interpreter"
    data = urllib.parse.urlencode({'data': query}).encode()

    print("Fetching street data from OpenStreetMap...")

    # Create SSL context that doesn't verify
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE

    try:
        req = urllib.request.Request(url, data=data)
        with urllib.request.urlopen(req, timeout=120, context=ctx) as response:
            result = json.loads(response.read().decode())
    except Exception as e:
        print(f"Error fetching data: {e}")
        return

    # Parse nodes
    nodes = {}
    for element in result.get('elements', []):
        if element['type'] == 'node':
            nodes[element['id']] = (element['lon'], element['lat'])

    # Parse ways (streets)
    streets = []
    street_types = {
        'primary': {'width': 12, 'color': '#636e72'},
        'secondary': {'width': 10, 'color': '#636e72'},
        'tertiary': {'width': 8, 'color': '#4a5568'},
        'residential': {'width': 6, 'color': '#4a5568'},
        'service': {'width': 4, 'color': '#3d4448'},
        'footway': {'width': 2, 'color': '#2d3436'},
        'path': {'width': 2, 'color': '#2d3436'},
    }

    for element in result.get('elements', []):
        if element['type'] == 'way' and 'nodes' in element:
            tags = element.get('tags', {})
            highway_type = tags.get('highway', 'residential')
            name = tags.get('name', '')

            # Get points
            points = []
            for node_id in element['nodes']:
                if node_id in nodes:
                    lon, lat = nodes[node_id]
                    x, z = convert_to_local(lon, lat)
                    points.append([x, z])

            if len(points) >= 2:
                type_info = street_types.get(highway_type, street_types['residential'])
                street = {
                    'id': f"street-{element['id']}",
                    'name': name,
                    'type': highway_type,
                    'points': points,
                    'width': type_info['width'],
                    'color': type_info['color'],
                }
                streets.append(street)

    print(f"Found {len(streets)} streets")

    # Output
    output = {'streets': streets}
    with open('src/data/streets.json', 'w') as f:
        json.dump(output, f, indent=2)

    print(f"Wrote {len(streets)} streets to src/data/streets.json")

    # Summary
    by_type = {}
    for s in streets:
        t = s['type']
        by_type[t] = by_type.get(t, 0) + 1

    print("\nStreets by type:")
    for t, count in sorted(by_type.items(), key=lambda x: -x[1]):
        print(f"  {t}: {count}")

    # Named streets
    named = [s for s in streets if s['name']]
    print(f"\nNamed streets: {len(named)}")
    for s in named[:15]:
        print(f"  {s['name']} ({s['type']})")

if __name__ == '__main__':
    main()
