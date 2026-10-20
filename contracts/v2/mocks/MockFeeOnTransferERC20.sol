// SPDX-License-Identifier: MIT
// Mock fee-on-transfer ERC-20 (1% burned per transfer) for local unit testing only.
// NOT FOR PRODUCTION USE.
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockFeeOnTransferERC20 is ERC20 {
    constructor(uint256 initialSupply) ERC20("Fee Token", "FEE") {
        _mint(msg.sender, initialSupply);
    }

    function _update(address from, address to, uint256 value) internal override {
        if (from != address(0) && to != address(0)) {
            uint256 fee = value / 100;
            super._update(from, address(0), fee);
            super._update(from, to, value - fee);
        } else {
            super._update(from, to, value);
        }
    }
}
