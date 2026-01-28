import { describe, it, expect } from "vitest";
import { createIdentity, computeNullifier, computeNullifierRaw } from "../identity.js";

describe("createIdentity", () => {
  it("should create identity with correct values", () => {
    const identity = createIdentity(12345n, 1n);

    expect(identity.secretBase).toBe(12345n);
    expect(identity.appId).toBe(1n);
    expect(identity.identitySecret).toBeDefined();
  });

  it("should accept string and number inputs", () => {
    const identity1 = createIdentity("12345", "1");
    const identity2 = createIdentity(12345, 1);
    const identity3 = createIdentity(12345n, 1n);

    expect(identity1.identitySecret).toBe(identity2.identitySecret);
    expect(identity2.identitySecret).toBe(identity3.identitySecret);
  });

  it("should produce deterministic identity secret", () => {
    const identity1 = createIdentity(12345n, 1n);
    const identity2 = createIdentity(12345n, 1n);

    expect(identity1.identitySecret).toBe(identity2.identitySecret);
  });

  it("should produce different secrets for different inputs", () => {
    const identity1 = createIdentity(12345n, 1n);
    const identity2 = createIdentity(12345n, 2n);
    const identity3 = createIdentity(67890n, 1n);

    expect(identity1.identitySecret).not.toBe(identity2.identitySecret);
    expect(identity1.identitySecret).not.toBe(identity3.identitySecret);
  });

  it("should match expected identity secret value (Semaphore compatible)", () => {
    // This value was verified against poseidon-lite directly
    const identity = createIdentity(12345n, 1n);
    expect(identity.identitySecret).toBe(
      0x0950acb7e532ebb21176a28dee52617a5a37ce9294aab1cf603024e5b9063f9an
    );
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
    // This value was verified against poseidon-lite and our Noir circuit
    const identity = createIdentity(12345n, 1n);
    const nullifier = computeNullifier(identity, 100n);

    expect(nullifier).toBe(
      0x028cb81d059c6d5eecc531b003aefff6cd4b6a799b6bdd537a498494763275f7n
    );
  });
});

describe("computeNullifierRaw", () => {
  it("should compute nullifier from raw values", () => {
    const nullifier = computeNullifierRaw(12345n, 1n, 100n);

    expect(nullifier).toBe(
      0x028cb81d059c6d5eecc531b003aefff6cd4b6a799b6bdd537a498494763275f7n
    );
  });

  it("should match computeNullifier with createIdentity", () => {
    const identity = createIdentity(12345n, 1n);
    const nullifier1 = computeNullifier(identity, 100n);
    const nullifier2 = computeNullifierRaw(12345n, 1n, 100n);

    expect(nullifier1).toBe(nullifier2);
  });
});
