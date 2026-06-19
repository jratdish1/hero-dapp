// SPDX-License-Identifier: MIT
// Mock ERC-721 for local unit testing only. NOT FOR PRODUCTION USE.
// Date: 2026-06-18 17:10 PDT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract MockERC721ForTesting is ERC721 {
    constructor(string memory name_, string memory symbol_) ERC721(name_, symbol_) {}

    function mint(address to, uint256 tokenId) external {
        _mint(to, tokenId);
    }
}
