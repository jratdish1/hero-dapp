// SPDX-License-Identifier: MIT
// HERO V3 LOCAL fork dry-run deploy. Owner: VETS (jratdish1).
// Runs ONLY against a local anvil fork via script/dryrun/run_fork_dryrun.sh, which refuses any
// non-127.0.0.1 / non-anvil RPC. No private keys: the sender is an anvil-impersonated throwaway
// address derived from a public label (no key exists for it). All role addresses below are
// throwaway placeholders derived the same way, NOT real Safes. Nothing here is a V3 live value.
pragma solidity 0.8.26;

interface Vm {
    function getCode(string calldata artifactPath) external view returns (bytes memory);
    function envString(string calldata name) external view returns (string memory);
    function startBroadcast() external;
    function stopBroadcast() external;
}

interface IOwnable {
    function transferOwnership(address newOwner) external;
}

interface IHeroV3 {
    function buyAndBurn() external view returns (address);
}

contract DryRunV3 {
    Vm internal constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    function label(string memory name) public pure returns (address) {
        return address(uint160(uint256(keccak256(bytes(string.concat("herobot.v3.dryrun.", name))))));
    }

    function _deploy(bytes memory initCode) internal returns (address a) {
        assembly {
            a := create(0, add(initCode, 0x20), mload(initCode))
        }
        require(a != address(0), "deploy failed");
    }

    function run() external returns (address hero, address buyAndBurn, address able, address staking) {
        bytes32 chain = keccak256(bytes(vm.envString("DRYRUN_CHAIN")));
        bool isBase = chain == keccak256("base");
        require(isBase || chain == keccak256("pulsechain"), "DRYRUN_CHAIN must be base|pulsechain");
        require(block.chainid == (isBase ? 8453 : 369), "unexpected chainid");
        string memory dir = isBase ? "out-dryrun/" : "out-dryrun/pulsechain/";
        address os = label("OS");

        vm.startBroadcast();
        // nonce 0: HERO (its constructor creates HeroBuyAndBurn at HERO's nonce 1)
        hero = _deploy(
            abi.encodePacked(
                vm.getCode(string.concat(dir, "Hero.sol/Hero.json")),
                abi.encode(uint32(block.timestamp), label("R_LP"), label("R_DON"), label("R_STK"))
            )
        );
        buyAndBurn = IHeroV3(hero).buyAndBurn();
        // nonce 1: HeroABLE
        able = _deploy(abi.encodePacked(vm.getCode(string.concat(dir, "HeroABLE.sol/HeroABLE.json")), abi.encode(hero)));
        // nonce 2: staking (Base only; the OZ 5.6.1 cancun build cannot run on PulseChain, Tier B)
        if (isBase) {
            staking = _deploy(
                abi.encodePacked(
                    vm.getCode("out-dryrun/HeroSingleSidedStaking.sol/HeroSingleSidedStaking.json"),
                    abi.encode(os, hero, uint256(7 days))
                )
            );
        }
        // Ownership handoff to the OS placeholder (single-step Ownable on HERO / B&B / HeroABLE).
        IOwnable(hero).transferOwnership(os);
        IOwnable(buyAndBurn).transferOwnership(os);
        IOwnable(able).transferOwnership(os);
        vm.stopBroadcast();
    }
}
