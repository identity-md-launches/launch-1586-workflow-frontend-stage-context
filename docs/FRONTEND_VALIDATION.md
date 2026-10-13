# Frontend validation record

Worker-side validation of the Swarmlers site (`web/` source, `dist/` export) on 2026-10-13, for the follow-up job that made the site interactive, themed it around the collection and added a theme option. These are the builder's own results, not an independent certification. The previous build's record is superseded by this one.

## 1. Scope and assumptions

- Request: make the site more interactive in the manner of crawlscan.fun (dark, animated crawler network behind the hero, a live "recently scanned" feed, a terminal-style log, counters), add a dark-mode option, and theme the site around the project rather than a generic panel.
- Reference inspected: crawlscan.fun rendered in headless Chromium at 1440 and 390 (the page is a JavaScript bundle; its text and screenshots were captured, not copied). Ideas adapted, not its content or palette: the animated web with crawlers, a live event feed, counters, chips, mono data labels, dark-first with coloured accents.
- Delivered: dark default theme on the art's own ground with a persisted light option; hero web canvas with crawlers coloured like the next Swarmlers in line; vitals strip with count-up counters and a supply meter; "Inspect any Swarmler" (any ID drawn locally from a port of `SwarmlerArt.sol`, live facts for minted IDs, next-in-line chips, rarity-by-tier meters); "On the web" live event feed from `eth_getLogs`; clickable gallery tiles; section navigation. All earlier flows kept: mint (approve + mint), free claim with eligibility preflight, your Swarmlers (claim, pair, refresh), reward pool deposit and maintenance, SWARMLER swap, fee hook, owner setup, wrong-network switch.
- Runtime configuration is still `dist/imd-deployment.json`, generated from `.imd/reads/deployment.json` and `.imd/reads/network.json`; it now also carries each contract's deployment `blockNumber` from the handoff (the feed never scans before it). All four handoff ABI hashes matched `docs/abi/*.json` at source commit `7170ab40427c84277eb47bf00bff5fd1eb43a143`.
- Live chain at validation time (chain 1, public RPC): `totalMinted` 25 at the start and 26 by the end of the run (the owner minted #26 live during validation and it appeared in the feed), `publicMintOpen` true, `rewardDuration` 1,728,000 s (20 days), reporter set to the owner address, reward reserve 0.22 IMD after that mint, `SwarmlerHookDeployer.hook()` zero.
- Inferred choices: dark is the default without a stored preference because the collection's art is drawn on `#090d19`; the toggle offers light, and `system` is honoured if stored. Amber stays the single action colour. System fonts only. Event lookback is at most five 10,000-block chunks (about 7 days) because the free public RPCs refuse wider `eth_getLogs` ranges.

## 2. Commands and outcomes

| Command (in `web/` unless noted) | Result |
| --- | --- |
| `npm ci` | 573 packages (wagmi 2.19, viem 2.57, vite 6.4, react 18.3, vitest 3.2) |
| `npx tsc --noEmit -p tsconfig.json` | exit 0, no errors |
| `npx vitest run` | 22 passed, 0 failed (17 earlier tests plus: art port tier sizes over all 2,500 IDs, contract formulas for known IDs and the SVG shape, ID validation and next-of-tier search, data-URL output, manifest `blockNumber` validation) |
| `npm run build` | exit 0: `index.html` 1.9 kB, CSS 11.4 kB, JS 599.7 kB (184.7 kB gzip) + 2.9 kB chunk |
| `node scripts/manifest.mjs` | wrote `dist/imd-deployment.json`: 4 contracts, 11 assets, 767.0 KiB; ABI hashes verified |
| `node test/scratch/art-check.mjs` (repo root, live RPC) | the local `svg()` for IDs 1, 2, 7, 13 and 25 is byte-identical to the SVG inside the on-chain `tokenURI`, and `rarity()` matches the contract for each: 5/5 |
| `IMD_PLAYWRIGHT=$HOME/.imd-taste/node_modules/playwright/index.mjs node .imd/reads/skills/design-critic/scripts/taste.mjs --out test/scratch/taste` (repo root, final export, dark default) | **16/16 passed**: render, layout, targets, contrast (all measured text at 4.5:1 or better; 38 text boxes over canvas or images not measured by the probe), casing, tracking, eyebrows, type-sizes (6 per width), type-faces (2 families, 3 weights), glyphs, slogans, repetition, copy-budget (26 words at 390, 56 at 1440), chrome, motion (1 endless animation, none running under reduced motion), share |
| the same probe on a copy of the export with `data-theme="light"` forced and the pre-paint script removed (`test/scratch/dist-light`, `--out test/scratch/taste-light`) | **16/16 passed**, including contrast and chrome for the light theme |
| `node test/scratch/browser.mjs ../../dist` (Playwright 1.64 headless Chromium, export served under `/preview/`, mocked EIP-6963 wallet that forwards reads to the public RPC and rejects every signature with 4001) | 390 and 320 sections: 28/28 passed. 1440 wallet section: 10/11 passed; the one failure was the script's own expectation that a "Connect wallet" button is shown before connecting, whereas wagmi auto-connected because the mock answers `eth_accounts` as already authorised (a mock property, not a site defect). Screenshots in `test/scratch/browser-out/` (scratch, not submitted) |

### Interaction run, what was exercised

- 390 wide, no wallet: no horizontal scroll; dark theme by default; next ID read from chain; mint button disabled without a wallet; mint button bottom at 532 px of 844 (first screen, under the headline and its line).
- Theme: Tab, Tab, Tab reaches the toggle (accessible name "Switch to light theme"); Enter switches to light; the choice survives a reload (`localStorage` `swarmlers-theme` = `light`); the button then reads "Switch to dark theme" and switches back.
- Inspector: typing 2500 draws Swarmler #2500 locally (alt "Swarmler #2500, Common") with status "Not minted yet, 2,474 in line"; 0 is flagged `aria-invalid`; typing 1 reads the live holder (`0xd2B2…8c03`); Next moves to #2; a "next in line" chip in the mint card opens the inspector at that ID and scrolls it into view; the first gallery tile (#26, dormant) opens the inspector at #26.
- Feed: 12 rows read from the chain, newest first, including "#26 minted by 0x3d6a…6193", "public minting opened", "reward duration set to 20 days", "activity reporter set to …" and the 25 constructor mints.
- Rarity tiers: five meters with "n of total minted"; every section nav anchor resolves.
- Motion: the hero canvas ran 30 frames in 500 ms with motion allowed and 0 frames in 600 ms under emulated `prefers-reduced-motion: reduce`; it also pauses when the hero is scrolled off screen.
- 320 wide: no horizontal scroll.
- 1440 with the mocked wallet (the creator's address): the 25 held Swarmlers were enumerated with on-chain artwork; the mint card offered "Approve 0.25 IMD"; clicking it simulated the approval, the mock rejected the signature and "Request cancelled in the wallet." appeared beside the button, which re-enabled; eligibility preflight for identity 1 answered "Not eligible right now" with the activity record; a 1 IMD swap quote came back through the Quoter; no console errors; light-theme screenshots at 1440 taken from this state.
- No console errors and no failed local resource loads in any section.

## 3. Better Interface review (six domains)

Coverage: Checked = reviewed in source and in the rendered export (headless Chromium via Playwright, both themes). Unperformed subchecks are listed.

| Domain | Status | Evidence / notes |
| --- | --- | --- |
| Accessibility | Checked | Native `button`/`a`/`label for`/`input`; skip link first; `:focus-visible` outline (viewed on the toggle in the 390 light screenshot); toggle has an accessible name that states the result; canvas `aria-hidden`; gallery tiles and chips are buttons with text; `aria-pressed` on the selected chip; supply meter `role="progressbar"`; tier meters `role="img"` with text; feed `aria-live="polite"`; reduced motion stops the canvas, counters, pulse, meter transition and tile lift (measured for the canvas, probe `motion` pass). **Not verified:** screen-reader session, native 200% zoom, WebKit/Safari, axe audit, RTL. |
| Layout | Checked | Mint action in the hero on the first screen at 390; stats, inspector, tiers and feed reflow at 560/720/900 px; probe `layout` pass at 320/390/1440; no nested cards after the fixes below. |
| Writing | Checked | Sentence case, verb-first buttons, waiting and empty states say what is happening, no slogans, no repeated lines (probe `slogans`, `repetition`, `copy-budget` pass). |
| Typography | Checked | 2 families, 3 weights, 6 sizes per width (probe `type-sizes`, `type-faces`, `tracking`, `casing` pass); tabular numerals on counters; 16 px inputs. |
| Colors | Checked | Role tokens for both themes; one action colour; rarity colours always paired with the tier word; probe `contrast` pass in dark and in forced light. **Not verified:** text drawn over the hero canvas and images (38 boxes the probe does not resolve; the canvas strands are at 22% alpha on the page ground, so the pairs are visually the page pairs, but no ratio was measured there), forced-colors mode. |
| UI | Checked | Flat surfaces, no border+shadow, no nested cards, no gradient text, no `transition: all`, one pulsing dot gated by reduced motion; disabled/pending/success/error states per button (probe `chrome`, `motion`, `share` pass). |

### Findings and fixes (this job)

| # | Severity | Location | Finding | Fix | Recheck |
| --- | --- | --- | --- | --- | --- |
| 1 | Medium | `web/src/index.css` `.hero` (first build) | The hero had a radius and ground, so the probe read the mint card inside it as a card in a card. | Hero is no longer a surface: no radius; the dotted ground and canvas stay. | Probe `chrome`: cards inside cards 0. |
| 2 | Medium | `web/src/index.css` `.feed` (first build) | The feed list was a filled, rounded box inside its card. | Rows separated by rules, no fill. | Probe `chrome` pass; 390 and 1440 screenshots. |
| 3 | Medium | `web/src/WebCanvas.tsx` | Decorative canvas must not run under reduced motion or off screen (battery, WCAG 2.3.3). | `requestAnimationFrame` loop gated by the media query, `IntersectionObserver` and `visibilitychange`; still frame otherwise. | 30 frames/500 ms allowed vs 0/600 ms reduced, measured. |
| 4 | Low | `web/src/ThemeToggle.tsx` | A theme control must state the result, not the current state, and be keyboard reachable. | Label "Switch to light/dark theme", 44 px, third Tab stop. | Keyboard walk in the interaction run. |
| 5 | Low | `web/src/Feed.tsx` | Mints emit both `Transfer` and `Minted`; showing both doubles every mint. | `Transfer` from zero is dropped when a `Minted` for the same token exists in the same transaction; constructor mints (no `Minted`) still show. | Feed rows in the interaction run. |

Carried over, unchanged and still valid: the previous job's eight findings (network switch, first-screen action, light accent contrast, left-rule notices, panel-specific hints, shortened leads, pool fact wording, test fix).

## 4. Deployment manifest check

`dist/imd-deployment.json`: top-level keys `version, launchId, chainId, sourceCommit, attestationHash, contracts, assets, poolKey, network, walletAddChain` only. Identity fields, the four contracts (name, address, abiHash, now also blockNumber 26184105) and `poolKey` are copied from the handoff; `network` and `walletAddChain` are copies from `.imd/reads/network.json`. `abiPath` values are `abi/<Name>.json`; assets list 11 files with lowercase SHA-256 of the final bytes. Largest file 600 kB; total 767 KiB. No address outside the handoff is hard-coded in source.

## 5. Not tested / limitations

- No real transaction was broadcast (not authorised): every write path stops at the mocked wallet's rejection after a successful simulation. Success paths after signing (receipt wait, refetch) are untested on a live chain.
- The IMD browser MCP tool could not launch (it requires a Chrome build at `/opt/google/chrome` that is not installed), so all rendered checks used Playwright's bundled Chromium from the taste probe install; no tool-managed preview existed, so a bounded script served the export and exited.
- Contrast of text positioned over the hero canvas and images was not measured by the probe; the pairs are visually the page pairs.
- Free-claim eligible, accruing-reward, hook-trading and swap-execute states were not observable with the mocked account; their controls stay disabled with the reason shown.
- WebKit/Safari, physical devices, screen readers, native zoom and RTL were not exercised.
- The feed depends on the public RPC answering `eth_getLogs`; drpc's free tier refuses ranges over 10,000 blocks, which the chunking respects, and when both RPCs refuse the panel says so and retries.
- The publisher's checks (CID, named entrypoint, hashes, RPC chain id and code) run after submission and are not claimed here.

## 6. Completion

Complete for the stated scope, with the limitations above. The export and manifest were regenerated after the last source change; the probe (both themes) and the interaction run reported here were executed on that final export.
