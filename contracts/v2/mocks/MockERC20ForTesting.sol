// SPDX-License-Identifier: MIT
// Mock ERC-20 for local unit testing only. NOT FOR PRODUCTION USE.
// Date: 2026-06-18 17:10 PDT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockERC20ForTesting is ERC20 {
    constructor(string memory name_, string memory symbol_, uint256 initialSupply) ERC20(name_, symbol_) {
        _mint(msg.sender, initialSupply);
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
