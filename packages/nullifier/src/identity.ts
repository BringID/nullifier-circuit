import pkg from "js-sha3";
const { keccak256 } = pkg;
import { poseidon2 } from "poseidon-lite/poseidon2";
import type { NullifierIdentity } from "./types.js";

/**
 * BabyJubJub prime subgroup order.
 * Semaphore v4 requires secret < subOrder for EdDSA compatibility.
 */
export const BABY_JUBJUB_SUB_ORDER =
  2736030358979909402780800718157159386076813972158567259200215660948447373041n;

/**
 * Hash a scope value to match Semaphore v4's scope hashing.
 * Semaphore hashes the scope before using it in the nullifier:
 *   hashed_scope = keccak256(scope_as_bytes32) >> 8
 *
 * @param scope - The raw scope value
 * @returns The hashed scope as bigint (248 bits, safe for BN254)
 */
export function hashScope(scope: bigint | number | string): bigint {
  const scopeBigInt = BigInt(scope);
  // Encode scope as a 32-byte big-endian value
  const scopeHex = scopeBigInt.toString(16).padStart(64, "0");
  const scopeBytes = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    scopeBytes[i] = parseInt(scopeHex.substring(i * 2, i * 2 + 2), 16);
  }
  // keccak256 hash and shift right by 8 bits (drop least significant byte)
  const hash = keccak256(scopeBytes);
  return (BigInt("0x" + hash) >> 8n);
}

/**
 * Create a nullifier identity from a secret and app ID.
 *
 * The identity secret is derived as: poseidon([secretBase, appId])
 * The secret scalar is: identitySecret % BABY_JUBJUB_SUB_ORDER
 *
 * @param secretBase - The private secret (keep this safe!)
 * @param appId - The application identifier
 * @returns NullifierIdentity object
 */
export function createIdentity(
  secretBase: bigint | number | string,
  appId: bigint | number | string
): NullifierIdentity {
  const secretBaseBigInt = BigInt(secretBase);
  const appIdBigInt = BigInt(appId);

  const identitySecret = poseidon2([secretBaseBigInt, appIdBigInt]);
  const secretScalar = identitySecret % BABY_JUBJUB_SUB_ORDER;

  return {
    secretBase: secretBaseBigInt,
    appId: appIdBigInt,
    identitySecret,
    secretScalar,
  };
}

/**
 * Compute the nullifier for an identity and scope.
 *
 * The scope is hashed (keccak256 >> 8) to match Semaphore v4, then:
 *   nullifier = poseidon([hashedScope, secretScalar])
 *
 * @param identity - The nullifier identity
 * @param scope - The raw scope/context (will be hashed)
 * @returns The nullifier as bigint
 */
export function computeNullifier(
  identity: NullifierIdentity,
  scope: bigint | number | string
): bigint {
  const hashedScope = hashScope(scope);
  return poseidon2([hashedScope, identity.secretScalar]);
}

/**
 * Compute nullifier directly from raw values (without creating identity object).
 * Useful for verification or testing.
 *
 * @param secretBase - The private secret
 * @param appId - The application identifier
 * @param scope - The raw scope/context (will be hashed)
 * @returns The nullifier as bigint
 */
export function computeNullifierRaw(
  secretBase: bigint | number | string,
  appId: bigint | number | string,
  scope: bigint | number | string
): bigint {
  const identity = createIdentity(secretBase, appId);
  return computeNullifier(identity, scope);
}
