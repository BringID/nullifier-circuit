/**
 * Computes nullifier using Semaphore v4's poseidon-lite library
 *
 * Semaphore v4 circuit formula:
 *   nullifier = poseidon2([scope, secret])
 *
 * Our circuit formula:
 *   identity_secret = poseidon2([secret_base, app_id])
 *   nullifier = poseidon2([scope, identity_secret])
 *
 * This script verifies that poseidon-lite (used by Semaphore) produces
 * the same results as our Noir Poseidon implementation.
 */

import { poseidon2 } from "poseidon-lite/poseidon2";
import { Identity } from "@semaphore-protocol/identity";

console.log("=== Using poseidon-lite directly (same lib as Semaphore) ===\n");

// Test values (same as Prover.toml)
const secret_base = 12345n;
const app_id = 1n;
const scope = 100n;

// Step 1: Derive identity_secret (our approach)
const identity_secret = poseidon2([secret_base, app_id]);
console.log("identity_secret:", "0x" + identity_secret.toString(16).padStart(64, "0"));

// Step 2: Derive nullifier (Semaphore v4 order: [scope, secret])
const nullifier = poseidon2([scope, identity_secret]);
console.log("nullifier:      ", "0x" + nullifier.toString(16).padStart(64, "0"));

console.log("\n=== Semaphore Identity for reference ===\n");

// Create a Semaphore identity from a private key
const identity = new Identity("test-private-key");
console.log("Semaphore secretScalar:", "0x" + identity.secretScalar.toString(16).padStart(64, "0"));
console.log("Semaphore commitment:  ", "0x" + identity.commitment.toString(16).padStart(64, "0"));

// Compute nullifier using Semaphore's secretScalar
const semaphoreNullifier = poseidon2([scope, identity.secretScalar]);
console.log("Semaphore nullifier:   ", "0x" + semaphoreNullifier.toString(16).padStart(64, "0"));

console.log("\n=== Summary ===\n");
console.log("Our circuit nullifier (for Noir test):");
console.log(nullifier.toString());
