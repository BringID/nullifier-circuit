# @bringid/nullifier

Privacy-preserving nullifier circuit for anonymous authentication. Compatible with Semaphore v4 nullifier derivation.

## Installation

```bash
npm install @bringid/nullifier
```

## Quick Start

```typescript
import {
  createIdentity,
  generateProof,
  verifyProof,
  computeNullifier,
} from "@bringid/nullifier";

// 1. Create an identity (keep secretBase private!)
const identity = createIdentity(
  12345n,  // secretBase - your private secret
  1n       // appId - application identifier
);

// 2. Generate a proof for a specific scope
const proof = await generateProof(identity, 100n); // scope = 100

console.log("Nullifier:", proof.nullifier);
// The same inputs always produce the same nullifier

// 3. Verify the proof (anyone can do this)
const isValid = await verifyProof(proof);
console.log("Valid:", isValid);
```

## How It Works

The nullifier is a deterministic value derived from your secret:

```
identity_secret = poseidon([secretBase, appId])
nullifier = poseidon([scope, identity_secret])
```

- **Same inputs** → Same nullifier (deterministic)
- **Different scope** → Different nullifier
- **Secret never revealed** in the proof

This enables:
- Anonymous authentication
- Double-action prevention (voting, claiming)
- Privacy-preserving identity verification

## API Reference

### `createIdentity(secretBase, appId)`

Create a nullifier identity.

```typescript
const identity = createIdentity(
  secretBase: bigint | number | string,
  appId: bigint | number | string
): NullifierIdentity;
```

### `computeNullifier(identity, scope)`

Compute the nullifier without generating a proof.

```typescript
const nullifier = computeNullifier(identity, scope);
```

### `generateProof(identity, scope, options?)`

Generate a ZK proof.

```typescript
const proof = await generateProof(
  identity: NullifierIdentity,
  scope: bigint | number | string,
  options?: { includeVK?: boolean }
): Promise<NullifierProofWithVK>;
```

Returns:
- `nullifier` - The deterministic nullifier
- `publicInputs` - [appId, scope, nullifier]
- `proof` - ZK proof (hex string)
- `verificationKey` - VK for standalone verification (hex string)

### `verifyProof(proof)`

Verify a proof.

```typescript
const isValid = await verifyProof(proof): Promise<boolean>;
```

### `extractPublicInputs(proof)`

Extract public values from a proof.

```typescript
const { appId, scope, nullifier } = extractPublicInputs(proof);
```

### `cleanup()`

Free WASM resources when done.

```typescript
await cleanup();
```

## Semaphore v4 Compatibility

The nullifier derivation is compatible with Semaphore v4:

```typescript
// Semaphore v4 formula:
// nullifier = poseidon([scope, secret])

// Our formula:
// identity_secret = poseidon([secretBase, appId])
// nullifier = poseidon([scope, identity_secret])
```

The difference is we derive `identity_secret` from `secretBase` and `appId`, allowing app-specific identity binding.

## Types

```typescript
type NullifierIdentity = {
  secretBase: bigint;
  appId: bigint;
  identitySecret: bigint;
};

type NullifierProof = {
  nullifier: bigint;
  publicInputs: string[];
  proof: string;
};

type NullifierProofWithVK = NullifierProof & {
  verificationKey: string;
};
```

## License

MIT
