# Swarmlers web app

Static frontend for the deployed Swarmlers contracts (collection, activity registry, hook deployer and the SWARMLER launch token). Vite, React 18, TypeScript, wagmi 2 and viem 2. The export under the repository's `dist/` is committed and is what gets pinned; it uses a relative base (`./`) and one page, so it works from an IPFS gateway subpath or an ENS name without server rewrites.

## Configuration: one file, read at runtime

The app has no built-in addresses, chain id, ABIs or RPC URLs. At start it fetches `./imd-deployment.json` (next to `index.html`) and the ABI files it references under `abi/`. That manifest is generated from the workflow deployment handoff and carries:

- `chainId`, `launchId`, `sourceCommit`, `attestationHash`
- `contracts[]` with `name`, `address`, `abiHash`, `abiPath`
- `poolKey` of the launch's Uniswap v4 pool (copied exactly from the handoff)
- `network` (public RPC URLs, explorer, native currency, Uniswap v4 addresses: PoolManager, Universal Router, Quoter, StateView, PositionManager, Permit2, and the IMD pair token) copied unchanged from `.imd/reads/network.json`
- `walletAddChain`, the exact `wallet_addEthereumChain` parameters
- `assets[]`: SHA-256 of every other exported file

`src/config.ts` defines the manifest's shape, validates it (relative paths only, required contract set, chain id consistency), and holds the protocol ABIs (ERC-20, Permit2, Quoter, Universal Router, StateView) plus tuning constants (default slippage, Permit2 expiry, swap deadline, poll interval). `src/wagmi.ts` builds the wagmi config from the loaded manifest: one chain, `fallback` over the manifest's RPC URLs, injected (EIP-6963) wallet connectors. No private credentials exist anywhere in the bundle.

WalletConnect is not wired. To add it, install `@walletconnect/ethereum-provider`, add `walletConnect({ projectId })` to `connectors` in `src/wagmi.ts`, and supply the public project id through `VITE_WALLETCONNECT_PROJECT_ID` at build time (it is read in `src/config.ts`).

## Commands

```sh
cd web
npm install            # install dependencies (network access)
npm run typecheck      # tsc --noEmit
npm test               # vitest: swap encoding, manifest validation, chain switching, formatting, errors
npm run build          # typecheck + vite build → ../dist (clears it first)
npm run manifest       # write ../dist/imd-deployment.json (hashes every exported file, verifies ABI keccak hashes)
npm run export         # build + manifest
npm run dev            # dev server; serves ../dist/imd-deployment.json for the app's runtime config
npm run preview        # serve the built export locally
```

Rebuild order after any source change: `npm run build`, then `npm run manifest`, then commit `dist/` together with the source. The manifest script reads `.imd/reads/deployment.json` and `.imd/reads/network.json` when they exist; otherwise it re-uses the identity fields of the committed manifest and only re-hashes assets. It verifies each `dist/abi/<Contract>.json` against the handoff's canonical keccak hash (sorted-key compact JSON) and refuses to write on mismatch.

ABIs under `public/abi/` are copies of `docs/abi/` at the pinned source commit. `SwarmlerFeeHook.json` is shipped too: the child hook is deployed later by the owner, its address is read from `SwarmlerHookDeployer.hook()`, so it is an asset, not a manifest contract.

## What the page does

- Header: name at the left, wallet button at the right (connect, copy address, disconnect).
- Wrong network: a single "Switch to Ethereum" control; on error 4902 the app sends `wallet_addEthereumChain` with the manifest's parameters, then switches again.
- Mint: supply, price, your IMD balance and allowance; approve exactly 0.25 IMD, then `mint()`. Disabled while public minting is closed or the wallet is not ready.
- Claim: Identity MD id input; live `eligible()` and `status()` preflight; `freeClaim(id)`.
- Your Swarmlers: scans `ownerOf` for 1..totalMinted, shows on-chain artwork, rarity, pairing, earned/claimable/claimed, `claimReward`, `claimRewards` batch, `pair`, `refreshMetadata`.
- Latest Swarmlers gallery from token URIs.
- Reward pool: funded reserve (via `previewRewardState`), remaining capacity, allocations, creator credit, reward duration; `depositProceeds` with approval step; `checkpoint`, `syncProceeds`, `withdrawCreator`.
- Trade SWARMLER: quote through the Quoter with `simulateContract`, slippage, Permit2 two-step approval, Universal Router `execute` (`0x10`, actions `0x060c0f`), simulated before signing.
- Fee hook: deployment status; when deployed, `forwardFees`, `buyFeeTokens` with `quoteFeeTokens`, and owner `setFeeTokenPrice`; owner `deploy(creationCode, salt)` form on the deployer.
- Owner setup (only for the connected owner): `setReporter`, `setRewardDuration`, `openPublicMint`, `acceptOwnership`.

Every transaction is simulated against the chain first, then signed by the visitor's wallet, then awaited; the status, hash link and a plain-language error (custom errors are translated in `src/errors.ts`) appear next to the button that started it.

See `../docs/FRONTEND_VALIDATION.md` for the validation record and `DESIGN.md` for the design documentation.
