# Royal T staff workspace

Open http://localhost:4173/internal while `node server.mjs` is running. On the first visit, create the staff username and password (at least 8 characters). Later visits show the sign-in screen. There is no default staff password. A Staff login link is also in the public website footer.

The dashboard shows total requests, new requests, pending pickups, shipments in progress and completed shipments. Left-side navigation opens a separate list for each status. Search by customer, contact details, reference, destination or tracking number. Open View to see the complete customer enquiry, contact details, shipment data and activity history. Staff can add phone/walk-in shipments and update the status, pickup date, carrier, tracking number and notes.

The website contact and pickup forms now POST to `/api/requests`. Successful submissions receive a reference and are stored immediately. Enquiries start under New requests; pickup requests start under Pending pickup. Updating a status moves the record between lists and updates dashboard counts. This dashboard uses saved operational records; tracking is still awaiting the carrier API.

Records and the salted password hash are saved in `data/internal-store.json`, excluded from Git and blocked by the static server. Back up this file to retain records. `INTERNAL_STORE_PATH` can select a different private file. Records survive server restarts. Staff sessions use an HttpOnly, SameSite cookie with an eight-hour lifetime; sessions are cleared when the server restarts. Password verification uses scrypt, and repeated unsuccessful logins are limited. Sign out invalidates the session.

This implementation supports one staff account on the existing local Node server. Before an internet deployment, move storage to the chosen hosted database, provide HTTPS (`COOKIE_SECURE=true`), account recovery and any additional staff roles required, and deploy behind the production hosting configuration. The preview server listens only on 127.0.0.1. The support-chat mailbox endpoint remains separate and unconnected.

Verification used an isolated store on port 4174 with clearly labelled example records. It covered setup/login, unauthenticated record access, protected data files, public enquiry and pickup intake, staff bookings, status updates/history, sign-out and re-login. Example records and preview credentials are not in the operational store.
