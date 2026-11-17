# LocalPulse

A Next.js prototype for discovering local businesses around a chosen area, checking their websites, saving prospects, preparing proposals in English, Bahasa Malaysia or Simplified Chinese, and previewing outreach.

## Run on this computer

Requires Node.js 20.9 or newer.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Open http://localhost:3001. Leave the development server running; changes to app code will refresh automatically. For a production build use `pnpm build` and `pnpm start` (production mode does not automatically refresh code changes).

## Discovery and audit

- **Demo mode** is on by default and includes four fictional businesses: Bluebird Corner Cafe, Luma Hair Studio, Petal & Stem and Golden Crumb Bakery. Each has its own fictional brand mark, simulated report, and demo website. Business names open websites, and location links open Google Maps searches (general areas for the fictional businesses). Switching to Live restores your live prospects; demo changes stay separate.

- **Find businesses** searches OpenStreetMap around the selected area, defaulting to central Kuala Lumpur. Choose Bangsar, Petaling Jaya or Cheras, or explicitly request the device's current location. Coordinates are sent with a live search only after permission. The optional name filters results. Community data can be incomplete or outdated, and the public service may be unavailable or rate-limited. Results credit [OpenStreetMap contributors](https://www.openstreetmap.org/copyright).
- Website checks fetch the returned HTML and look for HTTP status, HTTPS, a viewport tag, and obvious WhatsApp or booking text. They do not render scripts, check other pages, or provide a full mobile usability assessment. A website absent from the map data is **not** proof that the business has none.
- Prospects, website check results, proposal details and price are saved in this browser's local storage. Clearing browser data removes them. They are not shared between devices or browsers.
- The local Google Cloud project `localpulse-audit-20261117` has Places API enabled, billing disabled, and a daily Text Search quota of 25. The project currently responds without billing; Google may restrict unbilled projects, so continued availability is not guaranteed. The API key is stored in the ignored `.env.local` file and restricted to the Places API.
- **Google listing checks** run when an audit starts and use Google Places API (New) when configured; the user can also retry the check. Copy `.env.example` to `.env.local` and supply `GOOGLE_PLACES_API_KEY` on the server. Configure appropriate API restrictions and Google Cloud quota limits before enabling it. Google has different free allowances for different requested fields; requests can incur charges beyond those allowances. A budget alert is not a spending cap. See [Google's quota instructions](https://developers.google.com/maps/billing-and-pricing/manage-costs). This app does not enforce a billing cap itself. The user must select the correct listing from the returned candidates. Google results are temporary and not saved in local storage. Review responsiveness cannot be established from the information used here and is marked unverified.
- Choose English, Bahasa Malaysia or Simplified Chinese for the proposal PDF and outreach attachment. Screenshots, supplied company text, and reviewer notes remain in their original language. RM 1,500 is a user-editable illustrative placeholder, not a market quote. The owner should verify findings and pricing before sharing.
- Outreach is a **demo**: the WhatsApp-style and email views do not connect to an account or send messages. The conversation interface is informed by the user's Quora Chat repository.

This is a local prototype; it has not been hardened or deployed as a public service.

## Tests

Run the repeatable regression suite with:

```sh
pnpm test
```

It starts a separate local test server on port 3100 and runs desktop and mobile browser checks with isolated, seeded browser storage. Business discovery, website audit and Google responses are mocked; it never sends outreach or uses Google quota. The suite checks discovery, reports, Google-match selection, proposals, demo outreach, saving and removing prospects, manual entry, errors, and animation controls. Test artifacts on failure are written to `test-results/`. If Chrome is unavailable, install the Playwright browser with `pnpm exec playwright install chromium`, or set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` to a Chromium executable. `pnpm test:ui` opens Playwright's interactive runner.

To check the real services, first run `pnpm dev` and then use `pnpm test:live`. It checks OpenStreetMap discovery and a website audit; add `--google` (`pnpm test:live --google`) to also make **one** Google request, which uses the project's quota. Live checks depend on outside services and real map data, so they can fail when services are unavailable or listings change. They do not send outreach or change saved prospects.

## Company information upload

Use **Upload information** on Discover to upload up to three PDF, XLSX, DOCX, CSV or TXT files (5 MB each), paste company notes, or do both. LocalPulse extracts up to 20 PDF pages, eight spreadsheet sheets and 200 rows per sheet, up to 10,000 characters per file and 24,000 characters in total. Password-protected documents and image-only scanned PDFs cannot be read; use text-based files or paste their contents. Old `.xls` files should be saved as `.xlsx` first.

Readable text is sent to Gemini 3.1 Flash-Lite for analysis. Google may use free-tier content to improve its products; do not submit company information unless you have permission to share it. Uploaded files and extracted text are not stored by LocalPulse after processing. The generated summary and recommendations are saved in this browser with the prospect, and identical analyses are cached in server memory for 30 minutes (up to 40 entries); restarting the server clears that cache. AI suggestions and any information not mentioned in a document require verification; an omitted website is not proof that none exists.

The local Google Cloud project has billing disabled and the Gemini API enabled. The restricted `GEMINI_API_KEY` is stored in `.env.local`. Free-tier availability and quotas are determined by Google; exhaustion or service unavailability is reported in the app. Demo mode lets you select files and uses prefilled fictional notes, but shows simulated results without reading or uploading those files or making an AI request. Download the example PDF from the upload panel. Switch to Live for real document extraction and Gemini analysis.

The discovery radar is an interactive visualisation, not a geographic map: its pin positions are illustrative. At most 12 results are shown on the radar, while the full list appears below. Click a pin to open a listed website or view its audit. All four demo sites and their findings are fictional. Screenshot thumbnails open at full size, where the reviewer can draw or adjust a labelled red review rectangle. The label and rectangle are included in the PDF; they indicate an area to review and do not by themselves prove that a feature is missing. Live screenshots must be supplied by the reviewer.

## Visual audit evidence

The Bluebird demo deliberately contains a clipped heading on small screens. Its mobile screenshot and the recorded viewport and page widths come from a real Chromium mobile-emulation capture of the fictional site. To regenerate the screenshot and measurements, run `pnpm dev` in one terminal and `pnpm demo:evidence` in another. The capture also generates a separate inspection view for each demo finding: a captured page alongside the links or metadata actually observed on its initial rendered page. These views are labelled as generated fictional evidence; they do not establish what exists on other pages. The capture command only accepts a local demo server.

No general live-site screenshots or automated visual usability tests are performed. The existing live audit checks returned HTML, and a missing viewport tag or link is a signal for review, not proof of a rendered defect. For real businesses, upload a relevant screenshot and record the view, viewport size, observation and reproduction steps. Red annotations are reviewer-drawn unless explicitly labelled as measured demo evidence.

## Solution concept after outreach

Outreach is a local simulation. When a message with the attached proposal is previewed, a clearly labelled simulated interested reply lets you send a before-and-after concept as a separate outgoing preview. Sent PDF attachments remain clickable in the conversation and clear from the composer. The Bluebird comparison uses the measured mobile screenshot and a second capture with a temporary CSS correction at the same viewport; this is an illustration, not a deployed change. Other businesses show reviewer-provided evidence when available and a clearly labelled generic concept. The comparison is not included in the downloadable proposal PDF, and it is not a quotation.
