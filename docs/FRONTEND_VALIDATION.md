# Frontend validation record

Worker-side validation of the Swarmlers site (`web/` source, `dist/` export) on 2026-10-13. These are the builder's own results, not an independent certification.

## 1. Scope and assumptions

- Pages: one page, hash-free, relative base. Flows: connect, wrong-network switch/add, mint (approve + mint), free claim with eligibility preflight, owned Swarmlers with claim/pair/refresh, gallery, reward pool deposit and maintenance, SWARMLER swap (quote, Permit2 approvals, Universal Router execute), fee hook status and actions, owner setup.
- Export: `dist/` built by `web` (`npm run build`), manifest by `npm run manifest`.
- Runtime configuration is `dist/imd-deployment.json`, generated from `.imd/reads/deployment.json` and `.imd/reads/network.json`. All four handoff ABI hashes (canonical sorted-key keccak) matched `docs/abi/*.json` at source commit `7170ab40427c84277eb47bf00bff5fd1eb43a143`.
- Live chain at validation time (chain 1, public RPC): `totalMinted` 25, `publicMintOpen` false, `rewardDuration` 0, `SwarmlerActivity.reporter` zero, `SwarmlerHookDeployer.hook()` zero. The site therefore shows the "not configured yet" states and an owner setup panel; the fee hook is shown as not deployed.
- Inferred choices: injected (EIP-6963) wallets only, no WalletConnect project id supplied; USD values not shown because the site reads no price source; `og:image` relative because the hosted address is not fixed yet.
- `DESIGN.md` is at `web/DESIGN.md` (copy at `docs/DESIGN.md`): the assignment's write scope excludes the repository root.

## 2. Commands and outcomes

| Command (in `web/`) | Result |
| --- | --- |
| `npm install` | wagmi 2.19.5, viem 2.57.5, vite 6, react 18, vitest 3 |
| `npx tsc --noEmit -p tsconfig.json` | exit 0, no errors |
| `npx vitest run` | 17 passed, 0 failed (swap encoding incl. 5/6-field tuples and settle/take currencies, slippage, pool id; manifest validation incl. missing contract, traversal/URL paths, chain mismatch; 4902 add-then-switch and rejection; amount formatting/parsing, token URI decoding; error translation) |
| `npx vite build` | exit 0: `index.html` 1.15 kB, CSS 6.9 kB, JS 579.6 kB (177.8 kB gzip) + 2.9 kB chunk |
| `node scripts/manifest.mjs` | wrote `dist/imd-deployment.json`: 4 contracts, 11 assets, 678 KiB total; ABI hashes verified |
| `node .imd/reads/skills/design-critic/scripts/taste.mjs --out test/scratch/taste` (with `IMD_PLAYWRIGHT` naming Playwright 1.64 installed in `$HOME/.imd-taste`) | **16/16 passed** on the final export: render, layout, targets, contrast, casing, tracking, eyebrows, type-sizes, type-faces, glyphs, slogans, repetition, copy-budget (56 words at 390, under 90 at 1440), chrome, motion, share |
| `node test/scratch/browser.mjs ../../dist` (Playwright, export served under `/preview/` subpath, mocked EIP-1193 wallet, live mainnet reads) | 49/51 checks passed; the 2 "failures" were the script's own stale regex for the reporter notice wording (the notice text is present in the captured output). Screenshots: `test/scratch/browser-out/*.png` (scratch, not submitted) |

### Browser interaction run, what was exercised

Widths 390×844 (wallet mock on Sepolia first), 1440×844 (wallet on chain 1), 320×700 (layout only).

- Reads without a wallet: supply "25 of 2500", price "0.25 IMD", "not open yet" notice; mint button disabled; no horizontal scroll; mint control bottom at 677 px and wallet button inside the first screen at 390.
- Connect: mock wallet via EIP-6963; header shows `0xd2B2…8c03`.
- Wrong chain: banner with exactly one "Switch to Ethereum" control; mint disabled; the mock rejects the first `wallet_switchEthereumChain` with 4902; the app sent `wallet_addEthereumChain` with the manifest's `walletAddChain` (chainId 0x1, name Ethereum, both RPC URLs, explorer) and switched again; banner cleared.
- On the right chain: IMD balance and allowance read for the account; mint still disabled because minting is closed; the creator wallet's 25 Swarmlers enumerated with on-chain SVG artwork rendered; "Claim reward" disabled at zero claimable.
- Eligibility preflight for identity 1: verdict "Not eligible", reporter-unset notice, claim disabled.
- Swap: a 1 IMD quote came back through the Quoter via `simulateContract` (about 392,515 SWARMLER), minimum after 1% slippage shown, and the first action offered was "Step 1: approve IMD to Permit2".
- Rejected transaction: deposit 0.1 IMD → approve → the mock rejected with 4001 → "Request cancelled in the wallet." shown beside the button and the button re-enabled.
- Hook panel shows "not deployed yet"; owner panel absent for a non-owner; no console errors; no failed local resource loads.

## 3. Better Interface review (six domains)

Coverage: Checked = reviewed in source and in the rendered export (Chromium via Playwright); unperformed subchecks listed.

| Domain | Status | Evidence / notes |
| --- | --- | --- |
| Accessibility | Checked | Native `button`/`a`/`label for`/`input`; skip link first in DOM; `:focus-visible` 2px outline; `aria-describedby` hints, `aria-invalid` on bad input; `role="status"`/`aria-live` for progress, `role="alert"` for errors; menu with `role="menu"`, Escape and outside click; `prefers-reduced-motion` gate; 44px targets (probe `targets` pass). **Not verified:** screen-reader session, keyboard-only walk observed visually (focus ring viewed only via computed styles), native 200% zoom, WebKit/Safari rendering, automated axe audit. |
| Layout | Checked | Space-first grouping, shared edges, logical properties, one column until 720px; probe `layout` pass at 320/390/1440 with the longest values (full addresses in footer, 25-item owned list). **Not verified:** RTL mirror. |
| Writing | Checked | Sentence case, verb-first buttons, errors with a next step beside the control, empty states point forward, SWARMLER vs Swarmlers named distinctly. |
| Typography | Checked | One sans + one mono, 6 sizes, 3 weights, h1 heaviest; tabular numerals; 16px inputs; probe `type-sizes`, `type-faces`, `tracking`, `casing` pass. Note: the validation machine's system font rendered the h1 visibly lighter than weight 700 (no bold face installed); the CSS weight is 700. |
| Colors | Checked | Role tokens, one accent for the primary action, light and dark ramps; probe `contrast` pass after darkening the light accent. Dark-mode pairs computed from tokens only. **Not verified:** rendered dark-mode screenshot, forced-colors mode. |
| UI | Checked | Flat surfaces (border or rule, never border+shadow), no cards-in-cards after restyling notices, no `transition: all`, disabled/pending/success/error states per button; probe `chrome`, `motion`, `share` pass. |

### Findings and fixes (from the first probe and browser run)

| # | Severity | Location | Finding | Fix | Recheck |
| --- | --- | --- | --- | --- | --- |
| 1 | High | `web/src/NetworkBanner.tsx:12-24` | "Switch to Ethereum" stayed disabled on a wrong chain: wagmi's connector client is undefined off-chain. | Take the provider from `connector.getProvider()`. | Browser run: switch + 4902 add flow passes. |
| 2 | High | `web/src/MintPanel.tsx` (actions order), `web/src/index.css` `.hero` | Mint control below the first screen at 390 (notice sat above the button; hero padding). | Actions above notices; shorter lead; hero padding 8/16px. | Button bottom 677 px of 844 at 390; 390 screenshot confirmed. |
| 3 | Medium | `web/src/index.css` `--accent` | Primary buttons 3.81:1 on white in light mode. | Accent `#8a5604`, hover `#6d4303`. | Probe `contrast` pass. |
| 4 | Medium | `web/src/index.css` `.status` | Filled, rounded notices inside cards read as cards-in-cards (4). | Left-rule text blocks, no fill, no radius. | Probe `chrome` pass. |
| 5 | Medium | panels' disconnected hint | "Connect a wallet to continue" repeated 4×. | Panel-specific hints ("…to mint", "…to deposit", "…to trade"). | Probe `repetition` pass. |
| 6 | Medium | `MintPanel`, `ClaimPanel`, `MySwarmlers`, `Gallery` leads and notices | First-screen prose 79 words at 390 / 164 at 1440. | Shortened leads, hints and notices. | 56 at 390, under 90 at 1440; `copy-budget` pass. |
| 7 | Low | `web/src/SwapPanel.tsx` pool fact | Ticker pair "IMD / SWARMLER" flagged as all-caps content. | "Swarmler token paired with IMD, fee 1.25%". | `casing` pass. |
| 8 | Low | `web/test/unit.test.ts` | Address shortening test expected lowercase for a checksummed input. | Test corrected. | 17/17 pass. |

## 4. Deployment manifest check

`dist/imd-deployment.json`: top-level keys `version, launchId, chainId, sourceCommit, attestationHash, contracts, assets, poolKey, network, walletAddChain` only. `launchId`, `chainId` (1), `sourceCommit`, `attestationHash`, the four contracts (name, address, abiHash) and `poolKey` are copied from the handoff; `network` and `walletAddChain` are byte-for-byte copies from `.imd/reads/network.json`. `abiPath` values are `abi/<Name>.json`; assets list 11 files (index.html, 3 bundle files, 5 ABI JSON including `SwarmlerFeeHook.json`, favicon.svg, og.png) with lowercase SHA-256 of the final bytes, excluding the manifest itself. Largest file 580 kB; total 678 KiB.

## 5. Not tested / limitations

- No real transaction was broadcast (not authorised): mint, freeClaim, pair, claim, deposit, maintenance calls, swaps, approvals, hook and owner actions were validated through `simulateContract`-based flows, unit-tested encoding, disabled-state logic and a rejecting wallet mock. Success paths after signing (receipt wait, refetch) are untested on a live chain.
- Public minting, the reporter, reward duration and the fee hook are unset on chain, so open-mint, eligible-claim, accruing-reward, hook-trading and swap-execute states were not observable live; their controls stay disabled with the reason shown.
- The swap quote was obtained live against the launch pool; `execute` was not simulated with a funded account.
- WebKit/Safari, physical devices, screen readers, native zoom and RTL were not exercised.
- The publisher's checks (CID, named entrypoint, hashes, RPC chain id and code) run after submission and are not claimed here.

## 6. Completion

Complete for the stated scope, with the limitations above. Final export and manifest regenerated after the last source change; the probe and the browser run reported here were executed on that final export.
