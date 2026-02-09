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
The circuit takes `secret_base` (private), `secret_scalar` (private witness), `quotient` (private witness), `app_id` (public), `scope` (public, pre-hashed) and returns a public `nullifier`.

Three-step derivation:
1. `identity_secret = poseidon2([secret_base, app_id])`
2. Constrained modular reduction: `identity_secret == quotient * SUB_ORDER + secret_scalar` with range checks (`quotient < 8`, `secret_scalar < SUB_ORDER`)
3. `nullifier = poseidon2([scope, secret_scalar])`

The `scope` public input is already hashed by the caller (`keccak256(raw_scope) >> 8`). The `secret_scalar` is `identity_secret % BABY_JUBJUB_SUB_ORDER`, matching Semaphore v4's requirement that the secret be less than the BabyJubJub subgroup order.

### TypeScript SDK (`packages/nullifier/src/`)
- **identity.ts** — `createIdentity()`, `computeNullifier()`, `hashScope()` using `poseidon-lite` and `js-sha3`. Exports `BABY_JUBJUB_SUB_ORDER` constant. `createIdentity()` computes both `identitySecret` and `secretScalar` (= identitySecret % SUB_ORDER). `computeNullifier()` hashes the scope and uses `secretScalar`
- **proof.ts** — WASM-based proof generation/verification via `@noir-lang/noir_js` and `@aztec/bb.js`. Handles scope hashing and witness computation (secret_scalar, quotient) before calling the circuit. Call `cleanup()` to free WASM resources
- **types.ts** — `NullifierIdentity` (includes `secretScalar`), `NullifierProof`, `NullifierProofWithVK`

The compiled circuit artifact lives at `packages/nullifier/circuit/nullifier_circuit.json`.

### Solidity Contracts (`contracts/`)
- **HonkVerifier.sol** — Auto-generated from `nargo contract`. Do not edit manually
- **NullifierVerifier.sol** — Application contract that wraps HonkVerifier, tracks used nullifiers via mapping, and emits `NullifierUsed` events. Hashes the scope (`keccak256(scope) >> 8`) before constructing public inputs to match Semaphore v4. Prevents double-spending

### Web Demo (`web/`)
Vanilla JS + Vite. Requires COOP/COEP headers for SharedArrayBuffer (WASM threads). Uses `vite-plugin-top-level-await` for async WASM init.

## Deployment

### Base Sepolia
- **HonkVerifier:** `0x340b5C66B8B392A566C48fdf6Dd8aB1DbD7368f9`
- **NullifierVerifier:** `0x65AC244c6c35F57cB310B98F0b1f47c16aD0eCf1`
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

## Semaphore v4 Compatibility

The nullifier must match what Semaphore v4 produces for the same identity. The full derivation:
```
identitySecret = poseidon2([secretBase, appId])
secretScalar = identitySecret % BABY_JUBJUB_SUB_ORDER
hashedScope = keccak256(scope_as_bytes32) >> 8
nullifier = poseidon2([hashedScope, secretScalar])
```

Key constants:
- `BABY_JUBJUB_SUB_ORDER = 2736030358979909402780800718157159386076813972158567259200215660948447373041` (~2^251)
- Scope hashing (`keccak256 >> 8`) ensures the result fits in 248 bits, safely within the BN254 field
- The subOrder reduction is proven in-circuit via witness variables (`secret_scalar`, `quotient`) with range checks

## Verification Script

`node scripts/compute-nullifier.mjs` — Verifies Poseidon hash outputs match between the Noir circuit, TypeScript SDK, and Semaphore v4. Use this after changing hash logic.

## CRS Cache

Barretenberg (`bb`) downloads the BN254 CRS from `http://crs.aztec.network/g1.dat`. If this fails (e.g., VPN blocking HTTP, server down), manually download via HTTPS:
```bash
curl -sL -r 0-1048575 -o ~/.bb-crs/bn254_g1.dat "https://crs.aztec.network/g1.dat"
```
The cached file at `~/.bb-crs/bn254_g1.dat` is used automatically by `bb`. 1MB is sufficient for this circuit.
