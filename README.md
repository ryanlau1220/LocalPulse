# LocalPulse

A Next.js prototype for discovering food and drink businesses near Jalan Telawi, Bangsar, checking their websites, saving prospects, preparing bilingual proposals, and previewing outreach.

## Run on this computer

Requires Node.js 20.9 or newer.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Open http://localhost:3001. Leave the development server running; changes to app code will refresh automatically. For a production build use `pnpm build` and `pnpm start` (production mode does not automatically refresh code changes).

## Discovery and audit

- **Find businesses** searches OpenStreetMap's map service in a fixed area around Jalan Telawi. The optional name narrows that area's results. Community data can be incomplete or outdated, and the public service may be unavailable or rate-limited. Results credit [OpenStreetMap contributors](https://www.openstreetmap.org/copyright). You can enter a known business manually if search is unavailable.
- Website checks fetch the returned HTML and look for HTTP status, HTTPS, a viewport tag, and obvious WhatsApp or booking text. They do not render scripts, check other pages, or provide a full mobile usability assessment. A website absent from the map data is **not** proof that the business has none.
- Prospects, website check results, proposal details and price are saved in this browser's local storage. Clearing browser data removes them. They are not shared between devices or browsers.
- The local Google Cloud project `localpulse-audit-20261117` has Places API enabled, billing disabled, and a daily Text Search quota of 25. The project currently responds without billing; Google may restrict unbilled projects, so continued availability is not guaranteed. The API key is stored in the ignored `.env.local` file and restricted to the Places API.
- **Google listing checks** run when an audit starts and use Google Places API (New) when configured; the user can also retry the check. Copy `.env.example` to `.env.local` and supply `GOOGLE_PLACES_API_KEY` on the server. Configure appropriate API restrictions and Google Cloud quota limits before enabling it. Google has different free allowances for different requested fields; requests can incur charges beyond those allowances. A budget alert is not a spending cap. See [Google's quota instructions](https://developers.google.com/maps/billing-and-pricing/manage-costs). This app does not enforce a billing cap itself. The user must select the correct listing from the returned candidates. Google results are temporary and not saved in local storage. Review responsiveness cannot be established from the information used here and is marked unverified.
- Proposals download as an English and Bahasa Malaysia PDF. RM 1,500 is a user-editable illustrative placeholder, not a market quote. The owner should verify findings and pricing before sharing.
- Outreach is a **demo**: the WhatsApp-style and email views do not connect to an account or send messages. The conversation interface is informed by the user's Quora Chat repository.

This is a local prototype; it has not been hardened or deployed as a public service.
