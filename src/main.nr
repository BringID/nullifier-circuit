use dep::poseidon::poseidon::bn254::hash_2;

fn main(
    secret_base: Field,      // private
    app_id: pub Field,       // public
    scope: pub Field         // public
) -> pub Field {
    // Derive identity secret from secret_base and app_id
    let identity_secret = hash_2([secret_base, app_id]);

    // Derive nullifier from identity_secret and scope
    let nullifier = hash_2([identity_secret, scope]);

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
    assert(nullifier == 0x10a8d64a648299a475bcb660649610f1f05501677a1affd1aaee8f549c83ab53);
}

#[test]
fn test_zero_inputs() {
    // Circuit should handle zero values
    let nullifier = main(0, 0, 0);
    // Just verify it executes without error and produces a non-zero output
    // (Poseidon hash of zeros is not zero)
    assert(nullifier != 0);
}
