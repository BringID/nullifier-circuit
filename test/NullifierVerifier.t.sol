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
        nullifier = bytes32(hex"028cb81d059c6d5eecc531b003aefff6cd4b6a799b6bdd537a498494763275f7");
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
}
