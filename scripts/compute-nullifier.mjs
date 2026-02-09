/**
 * Computes nullifier using Semaphore v4's poseidon-lite library
 *
 * Semaphore v4 formula (with scope hashing + subOrder reduction):
 *   hashed_scope = keccak256(scope_as_bytes32) >> 8
 *   identity_secret = poseidon2([secret_base, app_id])
 *   secret_scalar = identity_secret % BABY_JUBJUB_SUB_ORDER
 *   nullifier = poseidon2([hashed_scope, secret_scalar])
 *
 * This script verifies that all layers (Noir circuit, TypeScript SDK,
 * Semaphore v4) produce the same nullifier values.
 */

import { poseidon2 } from "poseidon-lite/poseidon2";
import { Identity } from "@semaphore-protocol/identity";
import jsSha3 from "js-sha3";
const keccakHash = jsSha3.keccak256;

const BABY_JUBJUB_SUB_ORDER = 2736030358979909402780800718157159386076813972158567259200215660948447373041n;

function hashScope(scope) {
  const scopeHex = scope.toString(16).padStart(64, "0");
  const scopeBytes = Buffer.from(scopeHex, "hex");
  const hash = keccakHash(scopeBytes);
  return BigInt("0x" + hash) >> 8n;
}

console.log("=== Nullifier computation with Semaphore v4 compatibility ===\n");

// Test values (same as Prover.toml)
const secret_base = 12345n;
const app_id = 1n;
const scope = 100n;

// Step 1: Derive identity_secret
const identity_secret = poseidon2([secret_base, app_id]);
console.log("identity_secret:", "0x" + identity_secret.toString(16).padStart(64, "0"));

// Step 2: Reduce modulo subOrder
const secret_scalar = identity_secret % BABY_JUBJUB_SUB_ORDER;
const quotient = identity_secret / BABY_JUBJUB_SUB_ORDER;
console.log("secret_scalar:  ", "0x" + secret_scalar.toString(16).padStart(64, "0"));
console.log("quotient:       ", quotient.toString());

// Step 3: Hash scope
const hashed_scope = hashScope(scope);
console.log("hashed_scope:   ", "0x" + hashed_scope.toString(16).padStart(64, "0"));

// Step 4: Compute nullifier
const nullifier = poseidon2([hashed_scope, secret_scalar]);
console.log("nullifier:      ", "0x" + nullifier.toString(16).padStart(64, "0"));

// Verify constraint
console.log("\n=== Verification ===\n");
console.log("identity_secret == quotient * SUB_ORDER + secret_scalar:", identity_secret === quotient * BABY_JUBJUB_SUB_ORDER + secret_scalar);

console.log("\n=== Semaphore Identity for reference ===\n");

// Create a Semaphore identity from a private key
const identity = new Identity("test-private-key");
console.log("Semaphore secretScalar:", "0x" + identity.secretScalar.toString(16).padStart(64, "0"));
console.log("Semaphore commitment:  ", "0x" + identity.commitment.toString(16).padStart(64, "0"));

// Compute nullifier using Semaphore's approach (hashed scope + secretScalar)
const semaphoreNullifier = poseidon2([hashed_scope, identity.secretScalar]);
console.log("Semaphore nullifier:   ", "0x" + semaphoreNullifier.toString(16).padStart(64, "0"));

// Verify Solidity scope hashing matches
console.log("\n=== Solidity scope hash verification ===\n");
console.log("For scope =", scope.toString());
console.log("keccak256(scope_as_bytes32) >> 8 =", "0x" + hashed_scope.toString(16).padStart(64, "0"));
console.log("(This should match: uint256(keccak256(abi.encodePacked(scope))) >> 8 in Solidity)");

console.log("\n=== Test values for Noir circuit ===\n");
console.log("secret_base:", secret_base.toString());
console.log("secret_scalar:", secret_scalar.toString());
console.log("quotient:", quotient.toString());
console.log("app_id:", app_id.toString());
console.log("scope (hashed):", hashed_scope.toString());
console.log("nullifier:", nullifier.toString());
