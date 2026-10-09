# SnapKart — Scan. Shop. Done.
Mobile-first self-checkout frontend (React + Vite). Talks only to the SnapKart HTTP API.

## Setup
    npm install
    cp .env.example .env     # set VITE_API_BASE_URL (default http://localhost:3000)
    npm run dev              # http://localhost:5173
    npm run build            # production build

## Structure
`src/services/api.js` API client (base URL, auth header, timeout, error mapping, 401) · `src/context/AppContext.jsx` auth + cart state · `src/components/ui.jsx` shared components · `src/screens/` screens · `src/utils/format.js` currency/date helpers · `src/theme/theme.css` design tokens.

## Notes
- **Scanner:** `Scan.jsx` exports `Scanner`, which decodes with the browser `BarcodeDetector` and returns barcode text only (no images uploaded). Browsers without it (or without camera access) get a manual barcode field. Swap in ZXing by replacing the detect loop; `onDetect(text)` stays the same. Camera requires HTTPS or localhost.
- **Auth:** JWT stored in `localStorage` (`sk_token`), sent as `Authorization: Bearer`. A 401 clears it and returns the user to sign-in.
- **Cart:** backend is the source of truth; add returns the cart, other changes re-fetch `GET /cart`. Items are addressed by barcode in `PATCH/DELETE /cart/items/:barcode`.
- **Checkout:** `POST /checkout` with an `Idempotency-Key` kept in sessionStorage; reused on retry/pending, cleared on a definitive result.
- **If endpoints change:** edit `src/services/api.js` (paths, error mapping); response shapes are read in `AppContext.jsx`, `Checkout.jsx`, `Bills.jsx`.
