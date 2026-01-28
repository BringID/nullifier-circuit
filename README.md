# Nullifier Circuit

A Noir circuit implementing a privacy-preserving nullifier scheme using Poseidon hashing.

## Overview

This circuit generates deterministic nullifiers from a private secret, allowing anonymous authentication without revealing the underlying secret.

| Input | Visibility | Purpose |
|-------|------------|---------|
| `secret_base` | Private | User's secret, never revealed |
| `app_id` | Public | Application identifier |
| `scope` | Public | Context/action scope |
| **Output** | Public | Deterministic nullifier |

## Prerequisites

Install Nargo (Noir's package manager):

```bash
curl -L https://raw.githubusercontent.com/noir-lang/noirup/main/install | bash
noirup
```

## Usage

### Check circuit compiles correctly

```bash
nargo check
```

### Compile to ACIR

```bash
nargo compile
```

### Execute with witness generation

```bash
nargo execute
```

This will output the nullifier value and save the witness to `target/nullifier_circuit.gz`.

### Generate and verify proofs

Noir 1.0 uses external backends for proof generation. Install Barretenberg:

```bash
curl -L https://raw.githubusercontent.com/AztecProtocol/aztec-packages/master/barretenberg/cpp/installation/install | bash
source ~/.zshrc  # or restart terminal

# Download v3.0.3 manually (bbup may have issues with newer versions)
curl -L "https://github.com/AztecProtocol/aztec-packages/releases/download/v3.0.3/barretenberg-arm64-darwin.tar.gz" -o /tmp/bb.tar.gz
tar -xzf /tmp/bb.tar.gz -C ~/.bb/
```

Then generate and verify proofs:

```bash
# Generate proof (with --write_vk to also output verification key)
bb prove -b ./target/nullifier_circuit.json -w ./target/nullifier_circuit.gz -o ./target/proof --write_vk

# Verify proof
bb verify -k ./target/proof/vk -p ./target/proof/proof -i ./target/proof/public_inputs
```

### Run tests

```bash
nargo test
```

## How It Works

1. **Identity Secret Derivation**: Combines `secret_base` and `app_id` using Poseidon hash
   ```
   identity_secret = poseidon_hash(secret_base, app_id)
   ```

2. **Nullifier Derivation**: Combines `identity_secret` and `scope` using Poseidon hash
   ```
   nullifier = poseidon_hash(identity_secret, scope)
   ```

The nullifier is deterministic (same inputs produce the same output) but reveals nothing about the `secret_base`, making it useful for:
- Anonymous authentication
- Voting systems (prevent double-voting)
- Token systems (prevent double-spending)

## Test Inputs

The `Prover.toml` file contains example inputs for testing:

```toml
secret_base = "12345"
app_id = "1"
scope = "100"
```

Modify these values to test different scenarios.
