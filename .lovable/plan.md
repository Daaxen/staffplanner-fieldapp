# Google Maps: address autocomplete, map links and mini-maps

Connect Google Maps so that typing an address suggests real addresses, and every saved address shows a small map plus a "Open in Google Maps" link.

## What you will get

- **Address suggestions while typing** — in the order/planner form (Location field and each transport stop), and in the client register office address.
- **Mini-map preview** — a small embedded map appears under the address as soon as a valid address is chosen or typed.
- **Open in Google Maps link** — kept where it already exists (installer project view, transport stops) and added next to the new mini-maps, so installers can start navigation on their phone.
- **Installer project page** — the Info tab shows the mini-map above the existing map link.

## Setup step

Google Maps needs to be connected to the project first. A connect card will appear in chat; approving it enables both the map display and the address lookup. Nothing else is required from you.

## Technical notes

1. Connect the `google_maps` connector (`standard_connectors--connect`).
2. New edge function `maps-places`:
   - `POST { action: "autocomplete", input, sessionToken }` → gateway `places/v1/places:autocomplete`
   - `POST { action: "details", placeId, sessionToken }` → gateway `places/v1/places/{id}` with field mask `id,formattedAddress,location`
   - Requires a signed-in user (verify JWT) before calling the gateway; input length capped and requests debounced client-side (~300 ms). No unauthenticated proxy.
   - Uses `LOVABLE_API_KEY` + `GOOGLE_MAPS_API_KEY` headers per gateway rules; relays provider status/body on errors.
3. New shared components in `src/components/maps/`:
   - `AddressAutocomplete.tsx` — app-owned input + suggestion dropdown (no browser Places library), one UUID session token per interaction, reused for the details call; returns `{ address, lat, lng }`.
   - `MiniMap.tsx` — `iframe` using Maps Embed API with `VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY`, `place` mode when coordinates are known, lazy-loaded, fixed small height, rounded border matching current cards.
4. Wire into:
   - `src/components/gantt/CreateOrderDialog.tsx` — Location input and transport stop inputs (replace plain `Input`), mini-map under each.
   - `src/components/clients/ClientsRegister.tsx` — office address field.
   - `src/components/installer/InstallerProjectDetail.tsx` — mini-map in the Info tab above the existing Google Maps link.
5. Store the chosen coordinates alongside the address in the project/client `data` JSON so the mini-map does not need a re-lookup later.
6. Cost guard: suggestions only fire after 3+ characters, debounced, and results cached per session.
