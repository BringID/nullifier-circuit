// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "forge-std/Test.sol";
import {HonkVerifier} from "../contracts/HonkVerifier.sol";
import {NullifierVerifier, IVerifier} from "../contracts/NullifierVerifier.sol";

contract NullifierVerifierTest is Test {
    HonkVerifier honk;
    NullifierVerifier nullifierVerifier;

    bytes proofBytes;
    bytes32 nullifier;
    uint256 appId;
    uint256 scope;

    function setUp() public {
        honk = new HonkVerifier();
        nullifierVerifier = new NullifierVerifier(IVerifier(address(honk)));

        proofBytes = vm.readFileBinary("target/proof_keccak/proof");
        appId = 1;
        scope = 100;
        // Nullifier = poseidon2([hashScope(100), secretScalar]) where secretScalar = identitySecret % subOrder
        nullifier = bytes32(hex"2c73821ec1394f339024d4b025a9aee7967915af6494d2e4c6bc09baa442e6f0");
    }

    function test_validProof() public {
        vm.expectEmit(true, false, false, true);
        emit NullifierVerifier.NullifierUsed(nullifier, appId, scope);

        nullifierVerifier.verifyProof(nullifier, appId, scope, proofBytes);

        assertTrue(nullifierVerifier.usedNullifiers(nullifier));
    }

    function test_doubleSpendReverts() public {
        nullifierVerifier.verifyProof(nullifier, appId, scope, proofBytes);

        vm.expectRevert(abi.encodeWithSelector(NullifierVerifier.NullifierAlreadyUsed.selector, nullifier));
        nullifierVerifier.verifyProof(nullifier, appId, scope, proofBytes);
    }

    function test_invalidProofReverts() public {
        bytes memory garbage = new bytes(proofBytes.length);
        for (uint256 i = 0; i < garbage.length; i++) {
            garbage[i] = bytes1(uint8(i % 256));
        }

        vm.expectRevert();
        nullifierVerifier.verifyProof(nullifier, appId, scope, garbage);
    }

    function test_wrongInputsReverts() public {
        vm.expectRevert();
        nullifierVerifier.verifyProof(nullifier, 999, scope, proofBytes);
    }

    function test_scopeHashing() public pure {
        // Verify the scope hashing matches our expected value
        // keccak256(abi.encodePacked(uint256(100))) >> 8
        uint256 hashedScope = uint256(keccak256(abi.encodePacked(uint256(100)))) >> 8;
        assert(hashedScope == 0x0026700e13983fefbd9cf16da2ed70fa5c6798ac55062a4803121a869731e308);
    }
}
