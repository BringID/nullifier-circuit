// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {IVerifier} from "./HonkVerifier.sol";

contract NullifierVerifier {
    IVerifier public immutable verifier;

    mapping(bytes32 => bool) public usedNullifiers;

    event NullifierUsed(bytes32 indexed nullifier, uint256 appId, uint256 scope);

    error NullifierAlreadyUsed(bytes32 nullifier);
    error ProofVerificationFailed();

    constructor(IVerifier _verifier) {
        verifier = _verifier;
    }

    /// @notice Verify a nullifier proof and mark the nullifier as used.
    /// @param nullifier The nullifier hash produced by the circuit.
    /// @param appId The application identifier.
    /// @param scope The scope value.
    /// @param proof The serialized UltraHonk proof.
    function verifyProof(bytes32 nullifier, uint256 appId, uint256 scope, bytes calldata proof) external {
        if (usedNullifiers[nullifier]) {
            revert NullifierAlreadyUsed(nullifier);
        }

        // Public inputs order must match the circuit: appId, scope, nullifier
        bytes32[] memory publicInputs = new bytes32[](3);
        publicInputs[0] = bytes32(appId);
        publicInputs[1] = bytes32(scope);
        publicInputs[2] = nullifier;

        bool success = verifier.verify(proof, publicInputs);
        if (!success) {
            revert ProofVerificationFailed();
        }

        usedNullifiers[nullifier] = true;

        emit NullifierUsed(nullifier, appId, scope);
    }
}
