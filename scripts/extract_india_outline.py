"""Convert Survey of India's published LCC/WGS84 outline to a simplified geographic polygon.

Source: https://surveyofindia.gov.in/documents/Outline_of_India.zip
Uses the archive's projection parameters and standard ellipsoidal LCC inverse equations.
No GIS dependencies are required. Simplification tolerance is 1 km for the small globe.
"""
from pathlib import Path
import json
import math
import struct
import zipfile

ROOT = Path(__file__).resolve().parents[1]
archive = zipfile.ZipFile(ROOT / 'data/soi-outline-india.zip')
prj = archive.read('Outline_of_India.prj').decode()
assert 'LCC_WGS84' in prj and '35.172806' in prj and '12.472944' in prj
a = 6378137.0
flattening = 1 / 298.257223563
eccentricity = math.sqrt(flattening * (2 - flattening))
rad = math.radians

def t(phi):
    s = eccentricity * math.sin(phi)
    return math.tan(math.pi / 4 - phi / 2) / ((1 - s) / (1 + s)) ** (eccentricity / 2)

def m(phi):
    return math.cos(phi) / math.sqrt(1 - eccentricity ** 2 * math.sin(phi) ** 2)

p1, p2 = rad(12.472944), rad(35.172806)
n = math.log(m(p1) / m(p2)) / math.log(t(p1) / t(p2))
factor = m(p1) / (n * t(p1) ** n)
rho0 = a * factor * t(rad(24)) ** n

def geographic(x, y):
    east, north = x - 4000000, rho0 - (y - 4000000)
    rho = math.hypot(east, north)
    tv = (rho / (a * factor)) ** (1 / n)
    phi = math.pi / 2 - 2 * math.atan(tv)
    for _ in range(12):
        s = eccentricity * math.sin(phi)
        phi = math.pi / 2 - 2 * math.atan(tv * ((1-s)/(1+s)) ** (eccentricity/2))
    return [round(80 + math.degrees(math.atan2(east,north)/n), 6), round(math.degrees(phi), 6)]

def projected(lon, lat):
    theta = n * rad(lon - 80)
    rho = a * factor * t(rad(lat)) ** n
    return 4000000 + rho * math.sin(theta), 4000000 + rho0 - rho * math.cos(theta)

# Independently check inverse/forward consistency at mainland and northern control points.
for lon, lat in [(80,24),(74.8,34.1),(74.3,35.9),(77.6,34.2),(92,12)]:
    recovered = geographic(*projected(lon,lat))
    assert max(abs(recovered[0]-lon), abs(recovered[1]-lat)) < 0.000002

def simplify(points, tolerance=1000):
    keep = {0, len(points)-1}
    stack = [(0, len(points)-1)]
    while stack:
        start,end = stack.pop()
        x,y = points[start]
        dx,dy = points[end][0]-x,points[end][1]-y
        length = dx*dx+dy*dy
        furthest,maximum = None,tolerance*tolerance
        for i in range(start+1,end):
            px,py = points[i][0]-x,points[i][1]-y
            ratio = min(1,max(0,(px*dx+py*dy)/length)) if length else 0
            distance = (px-ratio*dx)**2+(py-ratio*dy)**2
            if distance > maximum:
                furthest,maximum = i,distance
        if furthest is not None:
            keep.add(furthest)
            stack.extend([(start,furthest),(furthest,end)])
    return [points[i] for i in sorted(keep)]

blob = archive.read('Outline_of_India.shp')
assert struct.unpack_from('<i',blob,32)[0] == 5
position = 100
rings = []
while position < len(blob):
    _,size = struct.unpack_from('>2i',blob,position)
    record = blob[position+8:position+8+size*2]
    assert struct.unpack_from('<i',record)[0] == 5
    parts,count = struct.unpack_from('<2i',record,36)
    starts = list(struct.unpack_from(f'<{parts}i',record,44))+[count]
    coordinates = list(struct.iter_unpack('<2d',record[44+parts*4:44+parts*4+count*16]))
    for start,end in zip(starts,starts[1:]):
        ring = simplify(coordinates[start:end])
        if len(ring) >= 4:
            rings.append([geographic(*point) for point in ring])
    position += 8+size*2

rings.sort(key=lambda ring: abs(sum(a[0]*b[1]-b[0]*a[1] for a,b in zip(ring,ring[1:]+ring[:1]))), reverse=True)
feature = {'type':'Feature', 'properties':{'ADMIN':'India','source':'Survey of India','sourceUrl':'https://surveyofindia.gov.in/pages/outline-maps-of-india','simplificationMetres':1000}, 'geometry':{'type':'MultiPolygon','coordinates':[[ring] for ring in rings]}}
(ROOT/'data/india-outline-soi.geojson').write_text(json.dumps(feature, separators=(',',':'))+'\n',encoding='utf-8')
print(f'Official India outline: {len(rings)} rings, {sum(map(len,rings))} simplified coordinates.')
