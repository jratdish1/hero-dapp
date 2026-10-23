// SPDX-License-Identifier: MIT
// HERO V3 test helper. Owner: VETS (jratdish1).
// Dependency-free subset of forge-std (no git submodule needed).
pragma solidity >=0.8.20;

interface Vm {
    function etch(address target, bytes calldata code) external;
    function prank(address sender) external;
    function startPrank(address sender) external;
    function stopPrank() external;
    function expectRevert(bytes calldata revertData) external;
    function expectRevert() external;
    function deal(address who, uint256 newBalance) external;
    function warp(uint256 newTimestamp) external;
    function addr(uint256 privateKey) external pure returns (address);
    function load(address target, bytes32 slot) external view returns (bytes32);
    function envOr(string calldata name, address defaultValue) external view returns (address);
    function envOr(string calldata name, uint256 defaultValue) external view returns (uint256);
    function envOr(string calldata name, bool defaultValue) external view returns (bool);
}

abstract contract MiniTest {
    bool public IS_TEST = true;
    Vm internal constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    function assertEq(uint256 a, uint256 b, string memory m) internal pure {
        require(a == b, m);
    }

    function assertEq(address a, address b, string memory m) internal pure {
        require(a == b, m);
    }

    function assertTrue(bool c, string memory m) internal pure {
        require(c, m);
    }
}
