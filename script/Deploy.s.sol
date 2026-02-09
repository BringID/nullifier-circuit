// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {Script, console} from "forge-std/Script.sol";
import {HonkVerifier} from "../contracts/HonkVerifier.sol";
import {NullifierVerifier} from "../contracts/NullifierVerifier.sol";
import {IVerifier} from "../contracts/HonkVerifier.sol";

contract Deploy is Script {
    function run() external {
        string memory pkStr = vm.envString("PRIVATE_KEY");
        // Accept keys with or without 0x prefix
        if (bytes(pkStr).length > 1 && bytes(pkStr)[0] != "0") {
            pkStr = string.concat("0x", pkStr);
        } else if (bytes(pkStr).length > 2 && bytes(pkStr)[1] != "x") {
            pkStr = string.concat("0x", pkStr);
        }
        uint256 deployerPrivateKey = vm.parseUint(pkStr);
        vm.startBroadcast(deployerPrivateKey);

        HonkVerifier honkVerifier = new HonkVerifier();
        console.log("HonkVerifier deployed at:", address(honkVerifier));

        NullifierVerifier nullifierVerifier = new NullifierVerifier(IVerifier(address(honkVerifier)));
        console.log("NullifierVerifier deployed at:", address(nullifierVerifier));

        vm.stopBroadcast();
    }
}
