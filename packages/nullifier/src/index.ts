/**
 * @bringid/nullifier
 *
 * Privacy-preserving nullifier circuit for anonymous authentication.
 * Compatible with Semaphore v4 nullifier derivation.
 *
 * @example
 * ```typescript
 * import {
 *   createIdentity,
 *   generateProof,
 *   verifyProof,
 *   computeNullifier
 * } from "@bringid/nullifier";
 *
 * // Create an identity bound to your app
 * const identity = createIdentity(mySecret, appId);
 *
 * // Generate a proof for a specific scope
 * const proof = await generateProof(identity, scope);
 *
 * // The nullifier is deterministic - same inputs = same output
 * console.log("Nullifier:", proof.nullifier);
 *
 * // Anyone can verify the proof without knowing the secret
 * const isValid = await verifyProof(proof);
 * ```
 *
 * @packageDocumentation
 */

// Types
export type {
  NullifierIdentity,
  NullifierProof,
  NullifierProofWithVK,
  NullifierProofInput,
  ProofOptions,
} from "./types.js";

// Identity functions
export {
  createIdentity,
  computeNullifier,
  computeNullifierRaw,
} from "./identity.js";

// Proof functions
export {
  initWasm,
  generateProof,
  verifyProof,
  extractPublicInputs,
  cleanup,
} from "./proof.js";
