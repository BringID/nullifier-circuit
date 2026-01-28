import { poseidon2 } from "poseidon-lite/poseidon2";
import type { NullifierIdentity } from "./types.js";

/**
 * Create a nullifier identity from a secret and app ID.
 *
 * The identity secret is derived as: poseidon([secretBase, appId])
 * This binds the identity to a specific application.
 *
 * @param secretBase - The private secret (keep this safe!)
 * @param appId - The application identifier
 * @returns NullifierIdentity object
 *
 * @example
 * ```typescript
 * const identity = createIdentity(12345n, 1n);
 * console.log(identity.identitySecret); // Derived secret
 * ```
 */
export function createIdentity(
  secretBase: bigint | number | string,
  appId: bigint | number | string
): NullifierIdentity {
  const secretBaseBigInt = BigInt(secretBase);
  const appIdBigInt = BigInt(appId);

  // Derive identity secret: poseidon([secretBase, appId])
  const identitySecret = poseidon2([secretBaseBigInt, appIdBigInt]);

  return {
    secretBase: secretBaseBigInt,
    appId: appIdBigInt,
    identitySecret,
  };
}

/**
 * Compute the nullifier for an identity and scope.
 *
 * The nullifier is derived as: poseidon([scope, identitySecret])
 * This is Semaphore v4 compatible ordering.
 *
 * @param identity - The nullifier identity
 * @param scope - The scope/context
 * @returns The nullifier as bigint
 *
 * @example
 * ```typescript
 * const identity = createIdentity(12345n, 1n);
 * const nullifier = computeNullifier(identity, 100n);
 * ```
 */
export function computeNullifier(
  identity: NullifierIdentity,
  scope: bigint | number | string
): bigint {
  const scopeBigInt = BigInt(scope);

  // Semaphore v4 compatible: poseidon([scope, secret])
  return poseidon2([scopeBigInt, identity.identitySecret]);
}

/**
 * Compute nullifier directly from raw values (without creating identity object).
 * Useful for verification or testing.
 *
 * @param secretBase - The private secret
 * @param appId - The application identifier
 * @param scope - The scope/context
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
