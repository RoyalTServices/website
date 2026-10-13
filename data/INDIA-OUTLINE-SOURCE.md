# India outline used in the homepage globe

The highlighted India boundary is derived from Survey of India's published international boundary vector data at 1:16 million scale:

- Publisher: Survey of India, Government of India
- Source page: https://surveyofindia.gov.in/pages/outline-maps-of-india
- Source archive: https://surveyofindia.gov.in/documents/Outline_of_India.zip
- Downloaded: 13 October 2026
- Archived source: `soi-outline-india.zip`

`scripts/extract_india_outline.py` reads the shapefile and its WGS84 Lambert Conformal Conic projection parameters, converts coordinates to longitude/latitude and simplifies the outline with a 1 km tolerance for the small illustration. The resulting `india-outline-soi.geojson` overrides the general world dataset's India geometry when `scripts/redraw_globe.py` builds `assets/shipping-network.svg`.

The globe uses one continuous highlighted external India outline, including the northern region shown in the official source. It does not draw internal lines across that highlight. The redraw script checks that Jammu, Srinagar, Leh, a northern control point and the India route marker fall within the outline.

Rebuild with `python scripts/extract_india_outline.py`, then `python scripts/redraw_globe.py`. This artwork is a simplified shipping illustration, not a survey map or a map certification.
