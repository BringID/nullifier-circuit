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

### Proof Generation (requires Barretenberg CLI at `~/.bb/bb`)
```bash
~/.bb/bb prove -b ./target/nullifier_circuit.json -w ./target/nullifier_circuit.gz -o ./target/proof --verifier_target evm --write_vk
~/.bb/bb verify -k ./target/proof/vk -p ./target/proof/proof
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

## Deployment

### Base Sepolia
- **HonkVerifier:** `0x342F55472e3B4d82bF19F4248a04106CBc067b13`
- **NullifierVerifier:** `0xf320A18Fd92a638911904A4864824368890Fc148`
- Both contracts verified on Basescan

### Deploy Commands
```bash
# Set env vars in .env: PRIVATE_KEY, ETHERSCAN_API_KEY
source .env
forge script script/Deploy.s.sol --rpc-url base_sepolia --broadcast
# Verify on Basescan:
forge verify-contract <address> HonkVerifier --chain base-sepolia --etherscan-api-key "$ETHERSCAN_API_KEY" --watch
forge verify-contract <address> NullifierVerifier --chain base-sepolia --etherscan-api-key "$ETHERSCAN_API_KEY" --constructor-args $(cast abi-encode "constructor(address)" <HonkVerifierAddress>) --watch
```

### Notes
- HonkVerifier is close to the 24KB EIP-170 contract size limit. `optimizer_runs` is set to `1` in `foundry.toml` to keep bytecode small enough. Do not increase without checking contract size.
- `PRIVATE_KEY` in `.env` works with or without `0x` prefix (handled in `script/Deploy.s.sol`).
- `via_ir = true` causes stack-too-deep errors with HonkVerifier — do not enable.

## Gas & ZK Design Decisions

On-chain proof verification costs ~2.3M gas. This is expected for UltraHonk ZK verification — dominated by BN254 elliptic curve precompile calls (ecMul, ecAdd, ecPairing) in sumcheck and Shplemini steps.

**ZK mode must stay enabled (`--verifier_target evm`, not `evm-no-zk`).** Disabling ZK would make proofs deterministic and linkable — an observer could correlate proofs from the same `secret_base` across different scopes/apps by comparing wire commitments (w1, w2, w3), breaking unlinkability. The `--optimized` flag on `bb write_solidity_verifier` produces identical output on bb 3.0.3.

The `NUMBER_OF_PUBLIC_INPUTS = 19` in HonkVerifier includes 16 pairing point slots for ZK Libra masking — only 3 are logical circuit public inputs (app_id, scope, nullifier).

## Key Version Constraints

Barretenberg (`@aztec/bb.js`) is pinned to **3.0.3** and Noir JS packages to **1.0.0-beta.18**. These must stay in sync — mismatched versions will cause proof generation failures.

## Verification Script

`node scripts/compute-nullifier.mjs` — Verifies Poseidon hash outputs match between the Noir circuit, TypeScript SDK, and Semaphore v4. Use this after changing hash logic.
