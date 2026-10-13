"""Build the globe from world coordinates, overriding India with Survey of India data."""
from pathlib import Path
import json
import math

ROOT = Path(__file__).resolve().parents[1]
data = json.loads((ROOT / 'data/globe-countries.geojson').read_text(encoding='utf-8'))
CX, CY, R = 379, 221, 178
LON0, LAT0 = map(math.radians, (70, 10))

def vector(lon, lat):
    lon, lat = math.radians(lon)-LON0, math.radians(lat)
    return (math.cos(lat)*math.sin(lon), math.cos(LAT0)*math.sin(lat)-math.sin(LAT0)*math.cos(lat)*math.cos(lon), math.sin(LAT0)*math.sin(lat)+math.cos(LAT0)*math.cos(lat)*math.cos(lon))

def xy(v):
    return (CX+R*v[0], CY-R*v[1])

def point(lon, lat):
    return xy(vector(lon, lat))

def limb(a, b):
    t=a[2]/(a[2]-b[2])
    v=tuple(a[i]+t*(b[i]-a[i]) for i in range(3))
    norm=math.hypot(v[0],v[1])
    return (v[0]/norm,v[1]/norm,0)

def ring_path(ring):
    vs=[vector(*coordinate) for coordinate in ring]
    if not any(v[2]>=0 for v in vs):
        return ''
    clipped=[]
    previous=vs[-1]
    for current in vs:
        if (previous[2]>=0)!=(current[2]>=0):
            clipped.append(limb(previous,current))
        if current[2]>=0:
            clipped.append(current)
        previous=current
    if len(clipped)<3:
        return ''
    projected=[]
    for i,current in enumerate(clipped):
        previous=clipped[i-1]
        if previous[2]==0 and current[2]==0:
            start,end=math.atan2(previous[1],previous[0]),math.atan2(current[1],current[0])
            delta=(end-start+math.pi)%(2*math.pi)-math.pi
            steps=max(1,int(abs(delta)*R/4))
            projected.extend(xy((math.cos(start+delta*j/steps),math.sin(start+delta*j/steps),0)) for j in range(1,steps))
        projected.append(xy(current))
    return 'M'+'L'.join(f'{x:.2f},{y:.2f}' for x,y in projected)+'Z'

def feature_path(feature):
    geometry=feature['geometry']
    polygons=geometry['coordinates'] if geometry['type']=='MultiPolygon' else [geometry['coordinates']]
    return ''.join(ring_path(ring) for polygon in polygons for ring in polygon)

def line_path(coordinates):
    result=[]
    active=False
    for lon,lat in coordinates:
        v=vector(lon,lat)
        if v[2]<0:
            active=False
            continue
        x,y=xy(v)
        result.append(('L' if active else 'M')+f'{x:.2f},{y:.2f}')
        active=True
    return ''.join(result)

parts=['<!-- Geographic globe: orthographic projection centred on 70 E, 10 N. -->',
       '<circle cx="379" cy="221" r="178" fill="url(#ocean)" stroke="#b9d0e1" stroke-width="1.5"/>',
       '<g clip-path="url(#globe)" fill="none" stroke="#d0e0eb" stroke-width=".7">']
for lon in range(-180,181,30):
    parts.append(f'<path d="{line_path([(lon,lat) for lat in range(-90,91)])}"/>')
for lat in range(-60,61,30):
    parts.append(f'<path d="{line_path([(lon,lat) for lon in range(-180,181)])}"/>')
parts.append('</g><g clip-path="url(#globe)" fill="#b8cfdf" stroke="#edf4f8" stroke-width=".45" fill-rule="evenodd">')
india=None
for feature in data['features']:
    if feature['properties']['ADMIN']=='India':
        india=feature
        continue
    path=feature_path(feature)
    if path:
        parts.append(f'<path d="{path}"/>')
assert india is not None
india=json.loads((ROOT / 'data/india-outline-soi.geojson').read_text(encoding='utf-8'))
def contains(ring, lon, lat):
    inside=False
    for a,b in zip(ring,ring[1:]+ring[:1]):
        if (a[1]>lat)!=(b[1]>lat):
            boundary=a[0]+(lat-a[1])*(b[0]-a[0])/(b[1]-a[1])
            if lon<boundary:
                inside=not inside
    return inside
india_geometry=india['geometry']
india_polygons=india_geometry['coordinates'] if india_geometry['type']=='MultiPolygon' else [india_geometry['coordinates']]
assert any(contains(polygon[0],79,22) for polygon in india_polygons), 'The India marker must be inside the India outline.'
for lon,lat,name in [(74.8,34.1,'Srinagar'),(74.86,32.73,'Jammu'),(77.58,34.15,'Leh'),(74.3,35.9,'northern outline')]:
    assert any(contains(ring,lon,lat) for polygon in india_polygons for ring in polygon), f'{name} must be included in the India outline.'
parts.append(f'</g><path id="india-outline" data-country="India" data-source="Survey of India" d="{feature_path(india)}" fill="#e5b54e" stroke="#a87820" stroke-width=".9" fill-rule="evenodd"/>')
ix,iy=point(79,22)
destinations=[point(-.12,51.5),point(103.8,1.35),point(151.2,-33.87)]
for dx,dy in destinations:
    control_x=(ix+dx)/2
    control_y=min(iy,dy)-45
    parts.append(f'<path d="M{ix:.2f},{iy:.2f}Q{control_x:.2f},{control_y:.2f} {dx:.2f},{dy:.2f}" fill="none" stroke="#c39430" stroke-width="1.7" stroke-dasharray="4 5"/>')
    parts.append(f'<circle cx="{dx:.2f}" cy="{dy:.2f}" r="4" fill="#123b5a" stroke="white" stroke-width="2"/>')
parts.extend([
    f'<circle class="route-signal" cx="{ix:.2f}" cy="{iy:.2f}" r="12" fill="none" stroke="#b18427" stroke-width="1.3"/>',
    f'<circle id="india-marker" data-longitude="79" data-latitude="22" cx="{ix:.2f}" cy="{iy:.2f}" r="5" fill="#123b5a" stroke="white" stroke-width="2"/>',
    f'<path d="M{ix+9:.2f},{iy:.2f}L462,184L481,184" stroke="#294e6a" stroke-width="1.2" fill="none"/>',
    '<rect x="480" y="170" width="70" height="28" rx="3" fill="white" stroke="#c6d7e3"/>',
    '<text x="515" y="188" text-anchor="middle" font-family="Arial,sans-serif" font-size="13" font-weight="700" fill="#123b5a">INDIA</text>',
])
svg_path=ROOT/'assets/shipping-network.svg'
svg=svg_path.read_text(encoding='utf-8')
start=svg.index('  <!-- Globe and latitude') if '  <!-- Globe and latitude' in svg else svg.index('<!-- Geographic globe:')
end=svg.index('  <!-- Cargo aircraft:',start)
svg_path.write_text(svg[:start]+'\n'.join(parts)+'\n'+svg[end:],encoding='utf-8')
print(f'India marker: 79 E, 22 N -> ({ix:.2f}, {iy:.2f})')
