import { describe, it, expect } from "vitest";
import {
  createIdentity,
  computeNullifier,
  computeNullifierRaw,
  hashScope,
  BABY_JUBJUB_SUB_ORDER,
} from "../identity.js";

describe("createIdentity", () => {
  it("should create identity with correct values", () => {
    const identity = createIdentity(12345n, 1n);

    expect(identity.secretBase).toBe(12345n);
    expect(identity.appId).toBe(1n);
    expect(identity.identitySecret).toBeDefined();
    expect(identity.secretScalar).toBeDefined();
  });

  it("should accept string and number inputs", () => {
    const identity1 = createIdentity("12345", "1");
    const identity2 = createIdentity(12345, 1);
    const identity3 = createIdentity(12345n, 1n);

    expect(identity1.identitySecret).toBe(identity2.identitySecret);
    expect(identity2.identitySecret).toBe(identity3.identitySecret);
    expect(identity1.secretScalar).toBe(identity2.secretScalar);
    expect(identity2.secretScalar).toBe(identity3.secretScalar);
  });

  it("should produce deterministic identity secret", () => {
    const identity1 = createIdentity(12345n, 1n);
    const identity2 = createIdentity(12345n, 1n);

    expect(identity1.identitySecret).toBe(identity2.identitySecret);
    expect(identity1.secretScalar).toBe(identity2.secretScalar);
  });

  it("should produce different secrets for different inputs", () => {
    const identity1 = createIdentity(12345n, 1n);
    const identity2 = createIdentity(12345n, 2n);
    const identity3 = createIdentity(67890n, 1n);

    expect(identity1.identitySecret).not.toBe(identity2.identitySecret);
    expect(identity1.identitySecret).not.toBe(identity3.identitySecret);
  });

  it("should match expected identity secret value (Semaphore compatible)", () => {
    const identity = createIdentity(12345n, 1n);
    expect(identity.identitySecret).toBe(
      0x0950acb7e532ebb21176a28dee52617a5a37ce9294aab1cf603024e5b9063f9an
    );
  });

  it("should compute secretScalar as identitySecret % SUB_ORDER", () => {
    const identity = createIdentity(12345n, 1n);
    expect(identity.secretScalar).toBe(
      identity.identitySecret % BABY_JUBJUB_SUB_ORDER
    );
    expect(identity.secretScalar).toBe(
      0x034422e9890cb7acda6c99d71e22366eaef8e0da5b89c3c4f8bd8d097fe518a9n
    );
  });
});

describe("hashScope", () => {
  it("should hash scope with keccak256 >> 8", () => {
    const hashed = hashScope(100n);
    expect(hashed).toBe(
      0x0026700e13983fefbd9cf16da2ed70fa5c6798ac55062a4803121a869731e308n
    );
  });

  it("should produce different hashes for different scopes", () => {
    const hash1 = hashScope(100n);
    const hash2 = hashScope(200n);
    expect(hash1).not.toBe(hash2);
  });

  it("should fit within 248 bits (safe for BN254)", () => {
    const hashed = hashScope(100n);
    expect(hashed < 2n ** 248n).toBe(true);
  });
});

describe("computeNullifier", () => {
  it("should compute nullifier correctly", () => {
    const identity = createIdentity(12345n, 1n);
    const nullifier = computeNullifier(identity, 100n);

    expect(nullifier).toBeDefined();
    expect(typeof nullifier).toBe("bigint");
  });

  it("should be deterministic", () => {
    const identity = createIdentity(12345n, 1n);
    const nullifier1 = computeNullifier(identity, 100n);
    const nullifier2 = computeNullifier(identity, 100n);

    expect(nullifier1).toBe(nullifier2);
  });

  it("should differ for different scopes", () => {
    const identity = createIdentity(12345n, 1n);
    const nullifier1 = computeNullifier(identity, 100n);
    const nullifier2 = computeNullifier(identity, 200n);

    expect(nullifier1).not.toBe(nullifier2);
  });

  it("should match expected value (Semaphore v4 compatible)", () => {
    // poseidon2([hashScope(100), secretScalar])
    const identity = createIdentity(12345n, 1n);
    const nullifier = computeNullifier(identity, 100n);

    expect(nullifier).toBe(
      0x2c73821ec1394f339024d4b025a9aee7967915af6494d2e4c6bc09baa442e6f0n
    );
  });
});

describe("computeNullifierRaw", () => {
  it("should compute nullifier from raw values", () => {
    const nullifier = computeNullifierRaw(12345n, 1n, 100n);

    expect(nullifier).toBe(
      0x2c73821ec1394f339024d4b025a9aee7967915af6494d2e4c6bc09baa442e6f0n
    );
  });

  it("should match computeNullifier with createIdentity", () => {
    const identity = createIdentity(12345n, 1n);
    const nullifier1 = computeNullifier(identity, 100n);
    const nullifier2 = computeNullifierRaw(12345n, 1n, 100n);

    expect(nullifier1).toBe(nullifier2);
  });
});
