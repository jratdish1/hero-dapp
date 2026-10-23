// SPDX-License-Identifier: MIT
// HERO V3 test mocks. Owner: VETS (jratdish1). Unit tests only.
pragma solidity >=0.8.20;

contract MockPair {}

contract MockFactory {
    mapping(address => mapping(address => address)) public getPair;

    function createPair(address a, address b) external returns (address p) {
        p = address(new MockPair());
        getPair[a][b] = p;
        getPair[b][a] = p;
    }
}

/// Runtime code is etched at the hardcoded router address; factory is an immutable so it survives etch.
contract MockRouter {
    address public immutable factory;

    constructor(address f) {
        factory = f;
    }
}

contract MockToken {
    mapping(address => mapping(address => uint256)) public allowance;

    function approve(address s, uint256 a) external returns (bool) {
        allowance[msg.sender][s] = a;
        return true;
    }
}
