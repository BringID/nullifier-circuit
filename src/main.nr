use dep::poseidon::poseidon::bn254::hash_2;

fn main(
    secret_base: Field,      // private
    app_id: pub Field,       // public
    scope: pub Field         // public
) -> pub Field {
    // Derive identity secret from secret_base and app_id
    let identity_secret = hash_2([secret_base, app_id]);

    // Derive nullifier from scope and identity_secret (Semaphore v4 compatible order)
    let nullifier = hash_2([scope, identity_secret]);

    nullifier
}

#[test]
fn test_determinism() {
    // Same inputs should always produce the same nullifier
    let nullifier1 = main(12345, 1, 100);
    let nullifier2 = main(12345, 1, 100);
    assert(nullifier1 == nullifier2);
}

#[test]
fn test_different_secrets_produce_different_nullifiers() {
    let nullifier1 = main(12345, 1, 100);
    let nullifier2 = main(67890, 1, 100);
    assert(nullifier1 != nullifier2);
}

#[test]
fn test_different_app_ids_produce_different_nullifiers() {
    // Same secret but different app_id should produce different nullifiers
    let nullifier1 = main(12345, 1, 100);
    let nullifier2 = main(12345, 2, 100);
    assert(nullifier1 != nullifier2);
}

#[test]
fn test_different_scopes_produce_different_nullifiers() {
    // Same secret and app_id but different scope should produce different nullifiers
    let nullifier1 = main(12345, 1, 100);
    let nullifier2 = main(12345, 1, 200);
    assert(nullifier1 != nullifier2);
}

#[test]
fn test_known_vector() {
    // Test with Prover.toml values - nullifier should match execute output
    let nullifier = main(12345, 1, 100);
    assert(nullifier == 0x028cb81d059c6d5eecc531b003aefff6cd4b6a799b6bdd537a498494763275f7);
}

#[test]
fn test_zero_inputs() {
    // Circuit should handle zero values
    let nullifier = main(0, 0, 0);
    // Just verify it executes without error and produces a non-zero output
    // (Poseidon hash of zeros is not zero)
    assert(nullifier != 0);
}

#[test]
fn test_semaphore_v4_compatibility() {
    // Verify nullifier derivation matches Semaphore v4 formula:
    // identity_secret = Poseidon([secret_base, app_id])
    // nullifier = Poseidon([scope, identity_secret])
    //
    // Values verified against @semaphore-protocol/identity's poseidon-lite library
    // Run: node scripts/compute-nullifier.mjs

    let secret_base: Field = 12345;
    let app_id: Field = 1;
    let scope: Field = 100;

    // Step 1: Derive identity_secret (same as our circuit)
    let identity_secret = hash_2([secret_base, app_id]);

    // Verify identity_secret matches poseidon-lite output
    // From JS: poseidon2([12345n, 1n]) = 0x0950acb7e532ebb21176a28dee52617a5a37ce9294aab1cf603024e5b9063f9a
    assert(identity_secret == 0x0950acb7e532ebb21176a28dee52617a5a37ce9294aab1cf603024e5b9063f9a);

    // Step 2: Derive nullifier using Semaphore v4 order: Poseidon([scope, secret])
    let expected_nullifier = hash_2([scope, identity_secret]);

    // Step 3: Verify our circuit produces the same result
    let circuit_nullifier = main(secret_base, app_id, scope);

    assert(circuit_nullifier == expected_nullifier);

    // Verify nullifier matches poseidon-lite output
    // From JS: poseidon2([100n, identity_secret]) = 0x028cb81d059c6d5eecc531b003aefff6cd4b6a799b6bdd537a498494763275f7
    assert(circuit_nullifier == 0x028cb81d059c6d5eecc531b003aefff6cd4b6a799b6bdd537a498494763275f7);
}
