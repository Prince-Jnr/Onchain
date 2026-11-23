// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {OnchainEntries} from "../src/OnchainEntries.sol";
import {OnchainSocial} from "../src/OnchainSocial.sol";
import {OnchainProfiles} from "../src/OnchainProfiles.sol";
import {OnchainModeration} from "../src/OnchainModeration.sol";

/// @notice Deployment script for the ONCHAIN protocol contracts
/// @dev Run with:
///   forge script script/Deploy.s.sol --rpc-url $RPC_URL --private-key $PRIVATE_KEY --broadcast --verify
contract DeployScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console2.log("Deploying ONCHAIN contracts");
        console2.log("Deployer:", deployer);
        console2.log("Chain ID:", block.chainid);

        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy OnchainEntries
        OnchainEntries entries = new OnchainEntries(deployer);
        console2.log("OnchainEntries deployed at:", address(entries));

        // 2. Deploy OnchainSocial (depends on Entries)
        OnchainSocial social = new OnchainSocial(deployer, address(entries));
        console2.log("OnchainSocial deployed at:", address(social));

        // 3. Deploy OnchainProfiles
        OnchainProfiles profiles = new OnchainProfiles(deployer);
        console2.log("OnchainProfiles deployed at:", address(profiles));

        // 4. Deploy OnchainModeration
        OnchainModeration moderation = new OnchainModeration(deployer);
        console2.log("OnchainModeration deployed at:", address(moderation));

        vm.stopBroadcast();

        // Write deployment addresses to stdout for capture
        console2.log("\n=== DEPLOYMENT SUMMARY ===");
        console2.log("Network:", _networkName(block.chainid));
        console2.log("OnchainEntries:", address(entries));
        console2.log("OnchainSocial:", address(social));
        console2.log("OnchainProfiles:", address(profiles));
        console2.log("OnchainModeration:", address(moderation));
        console2.log("=========================\n");
    }

    function _networkName(uint256 chainId) internal pure returns (string memory) {
        if (chainId == 31337) return "anvil-local";
        if (chainId == 84532) return "base-sepolia";
        if (chainId == 8453) return "base-mainnet";
        return "unknown";
    }
}
