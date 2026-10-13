# Homepage globe

The previous hand-drawn world shapes were replaced with geographic outlines from Natural Earth, using its 1:110 million admin-0 dataset:

https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_110m_admin_0_countries.geojson

The downloaded dataset is saved in data/globe-countries.geojson. scripts/redraw_globe.py projects it into the homepage SVG using an orthographic projection centred on 70° E, 10° N. The map is generated into the existing SVG and needs no runtime map library or remote requests.

India is highlighted separately. The marker is at 79° E, 22° N, inside India; it represents the country origin rather than an office or branch. The script verifies that this geographic point lies within India's source polygon. Graticule lines and route endpoints use the same projection. The parcel, aircraft and client-branded van are preserved.
