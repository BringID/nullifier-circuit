# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Privacy-preserving nullifier circuit using Noir for anonymous authentication. Three layers: Noir ZK circuit, TypeScript SDK (`@bringid/nullifier`), and Solidity on-chain verifier. Nullifiers are Semaphore v4 compatible.

## Build & Test Commands

### Noir Circuit
```bash
nargo check          # Type-check circuit
nargo compile        # Compile to ACIR (outputs to target/)
nargo execute        # Generate witness from Prover.toml inputs
nargo test           # Run all circuit tests
nargo test test_name # Run a specific test
```

### Proof Generation (requires Barretenberg CLI)
```bash
bb prove -b ./target/nullifier_circuit.json -w ./target/nullifier_circuit.gz -o ./target/proof --write_vk
bb verify -k ./target/proof/vk -p ./target/proof/proof -i ./target/proof/public_inputs
```

### TypeScript SDK (`packages/nullifier/`)
```bash
cd packages/nullifier
npm run build        # tsc → dist/
npm run test         # vitest single run
npm run test:watch   # vitest watch mode
```

### Solidity Contracts
```bash
forge build                    # Compile contracts
forge test                     # Run all tests
forge test --match-test test_validProof  # Run single test
forge test -vvv                # Verbose output
```

### Web Demo
```bash
npm run web          # Vite dev server (localhost:5173)
npm run web:build    # Production build
```

## Architecture

### Circuit (`src/main.nr`)
The circuit takes `secret_base` (private), `app_id` (public), `scope` (public) and returns a public `nullifier`. Two-step Poseidon2 hash: `identity_secret = poseidon(secret_base, app_id)`, then `nullifier = poseidon(scope, identity_secret)`. The hash ordering `[scope, identity_secret]` matches Semaphore v4.

### TypeScript SDK (`packages/nullifier/src/`)
- **identity.ts** — `createIdentity()` and `computeNullifier()` using `poseidon-lite` (no circuit needed)
- **proof.ts** — WASM-based proof generation/verification via `@noir-lang/noir_js` and `@aztec/bb.js`. Handles auto WASM initialization for browsers. Call `cleanup()` to free WASM resources
- **types.ts** — `NullifierIdentity`, `NullifierProof`, `NullifierProofWithVK`

The compiled circuit artifact lives at `packages/nullifier/circuit/nullifier_circuit.json`.

### Solidity Contracts (`contracts/`)
- **HonkVerifier.sol** — Auto-generated from `nargo contract`. Do not edit manually
- **NullifierVerifier.sol** — Application contract that wraps HonkVerifier, tracks used nullifiers via mapping, and emits `NullifierUsed` events. Prevents double-spending

### Web Demo (`web/`)
Vanilla JS + Vite. Requires COOP/COEP headers for SharedArrayBuffer (WASM threads). Uses `vite-plugin-top-level-await` for async WASM init.

## Key Version Constraints

Barretenberg (`@aztec/bb.js`) is pinned to **3.0.3** and Noir JS packages to **1.0.0-beta.18**. These must stay in sync — mismatched versions will cause proof generation failures.

## Verification Script

`node scripts/compute-nullifier.mjs` — Verifies Poseidon hash outputs match between the Noir circuit, TypeScript SDK, and Semaphore v4. Use this after changing hash logic.
