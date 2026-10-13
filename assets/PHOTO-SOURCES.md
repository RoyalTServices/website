# Original service images

All six service-card images were created specifically for this project with the built-in image_gen tool. No existing website images were supplied as references. External website photos have been removed from the application.

Final local assets (1536 × 1024, JPEG encoding for smaller downloads):

- assets/services/international-courier.jpeg
- assets/services/domestic-express.jpeg
- assets/services/air-cargo.jpeg
- assets/services/imports.jpeg
- assets/services/surface-cargo.jpeg
- assets/services/dangerous-goods.jpeg

The scenes use realistic documentary photography, natural daylight and no company logos, watermarks or text overlays. They are illustrative service images, not photographs of the client's employees or facilities. Exact generation prompts are saved in assets/service-image-prompts.json. Original generated PNGs remain in the default generated_images directory. JPEG copies preserve the original dimensions and composition.

Client logo: supplied `logo_royaltcourier.jpeg`, used in header, footer and embedded in the homepage SVG delivery van.

Realism revision: regenerated international courier, domestic express and surface cargo with documentary framing and ordinary working environments. Surface cargo uses a strict broadside vehicle view so registration plates are outside the visible faces of the truck. Current prompts are reflected in service-image-prompts.json; the three revision prompts are also saved in service-image-revision-prompts.json.
