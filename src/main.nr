use dep::poseidon::poseidon::bn254::hash_2;

// BabyJubJub prime subgroup order
// Semaphore v4 requires secret < subOrder for EdDSA compatibility
global SUB_ORDER: Field = 2736030358979909402780800718157159386076813972158567259200215660948447373041;

fn main(
    secret_base: Field,       // private: the raw secret
    secret_scalar: Field,     // private: identity_secret % SUB_ORDER (witness)
    quotient: Field,          // private: identity_secret / SUB_ORDER (witness)
    app_id: pub Field,        // public
    scope: pub Field          // public: already hashed scope (keccak256(raw_scope) >> 8)
) -> pub Field {
    // Derive identity secret from secret_base and app_id
    let identity_secret = hash_2([secret_base, app_id]);

    // Constrain modular reduction: identity_secret == quotient * SUB_ORDER + secret_scalar
    assert(identity_secret == quotient * SUB_ORDER + secret_scalar);

    // Range-check quotient < 8 (identity_secret < 8 * SUB_ORDER since BN254_PRIME < 8 * SUB_ORDER)
    let _q_bits: [u1; 3] = quotient.to_be_bits();

    // Range-check secret_scalar < SUB_ORDER
    // If secret_scalar < SUB_ORDER, the difference fits in 251 bits (SUB_ORDER < 2^251)
    // If secret_scalar >= SUB_ORDER, the difference wraps mod p to ~2^254, failing the 251-bit check
    let bound_check = SUB_ORDER - 1 - secret_scalar;
    let _bound_bits: [u1; 251] = bound_check.to_be_bits();

    // Derive nullifier using reduced secret (Semaphore v4 compatible)
    let nullifier = hash_2([scope, secret_scalar]);

    nullifier
}

#[test]
fn test_determinism() {
    // secret_base=12345, app_id=1: quotient=1, secret_scalar=0x0344...
    let ss = 0x034422e9890cb7acda6c99d71e22366eaef8e0da5b89c3c4f8bd8d097fe518a9;
    let nullifier1 = main(12345, ss, 1, 1, 100);
    let nullifier2 = main(12345, ss, 1, 1, 100);
    assert(nullifier1 == nullifier2);
}

#[test]
fn test_different_secrets_produce_different_nullifiers() {
    // (12345, 1): q=1, ss=0x0344...
    let nullifier1 = main(
        12345,
        0x034422e9890cb7acda6c99d71e22366eaef8e0da5b89c3c4f8bd8d097fe518a9,
        1,
        1,
        100,
    );
    // (67890, 1): q=0, ss=0x03f3...
    let nullifier2 = main(
        67890,
        0x03f347e81fe6003ec9d19ca27a11f6b859aa2672d4c3e1c68b1407206950502f,
        0,
        1,
        100,
    );
    assert(nullifier1 != nullifier2);
}

#[test]
fn test_different_app_ids_produce_different_nullifiers() {
    // (12345, 1): q=1
    let nullifier1 = main(
        12345,
        0x034422e9890cb7acda6c99d71e22366eaef8e0da5b89c3c4f8bd8d097fe518a9,
        1,
        1,
        100,
    );
    // (12345, 2): q=5
    let nullifier2 = main(
        12345,
        0x01710a2b3f598783abcad16808060e29a79b513ccb530712197ce53ac77ab386,
        5,
        2,
        100,
    );
    assert(nullifier1 != nullifier2);
}

#[test]
fn test_different_scopes_produce_different_nullifiers() {
    let ss = 0x034422e9890cb7acda6c99d71e22366eaef8e0da5b89c3c4f8bd8d097fe518a9;
    let nullifier1 = main(12345, ss, 1, 1, 100);
    let nullifier2 = main(12345, ss, 1, 1, 200);
    assert(nullifier1 != nullifier2);
}

#[test]
fn test_known_vector() {
    // secret_base=12345, app_id=1, scope=100
    // identity_secret = 0x0950acb7e532ebb21176a28dee52617a5a37ce9294aab1cf603024e5b9063f9a
    // secret_scalar   = 0x034422e9890cb7acda6c99d71e22366eaef8e0da5b89c3c4f8bd8d097fe518a9
    // quotient        = 1
    // nullifier       = poseidon2([100, secret_scalar])
    let nullifier = main(
        12345,
        0x034422e9890cb7acda6c99d71e22366eaef8e0da5b89c3c4f8bd8d097fe518a9,
        1,
        1,
        100,
    );
    assert(nullifier == 0x266bed7dc3f15b455bbb6ef6c2895d334711ae490f85146707d9cdf11980c492);
}

#[test]
fn test_zero_inputs() {
    // secret_base=0, app_id=0: q=5, ss=0x025a...
    let nullifier = main(
        0,
        0x025a44f3d1649a9129b898606a910d4783f6803c425a2eefa2fcf737291085af,
        5,
        0,
        0,
    );
    assert(nullifier != 0);
}

#[test]
fn test_semaphore_v4_compatibility() {
    // Verify nullifier derivation matches Semaphore v4 formula:
    // identity_secret = Poseidon([secret_base, app_id])
    // secret_scalar = identity_secret % SUB_ORDER
    // nullifier = Poseidon([scope, secret_scalar])
    //
    // Values verified against poseidon-lite

    let secret_base: Field = 12345;
    let app_id: Field = 1;
    let scope: Field = 100;
    let secret_scalar: Field =
        0x034422e9890cb7acda6c99d71e22366eaef8e0da5b89c3c4f8bd8d097fe518a9;
    let quotient: Field = 1;

    // Step 1: Verify identity_secret
    let identity_secret = hash_2([secret_base, app_id]);
    assert(
        identity_secret
            == 0x0950acb7e532ebb21176a28dee52617a5a37ce9294aab1cf603024e5b9063f9a,
    );

    // Step 2: Verify modular reduction constraint
    assert(identity_secret == quotient * SUB_ORDER + secret_scalar);

    // Step 3: Verify circuit output
    let circuit_nullifier = main(secret_base, secret_scalar, quotient, app_id, scope);
    assert(circuit_nullifier == 0x266bed7dc3f15b455bbb6ef6c2895d334711ae490f85146707d9cdf11980c492);
}
