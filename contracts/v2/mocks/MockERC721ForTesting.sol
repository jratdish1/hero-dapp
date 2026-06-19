// SPDX-License-Identifier: MIT
// Mock ERC-721 for local unit testing only. NOT FOR PRODUCTION USE.
// Date: 2026-06-18 17:10 PDT
// A+ Fix (2026-06-18): Added ERC-2981 royalty support via setRoyalty() for marketplace royalty path tests.
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Royalty.sol";

contract MockERC721ForTesting is ERC721Royalty {
    constructor(string memory name_, string memory symbol_) ERC721(name_, symbol_) {}

    function mint(address to, uint256 tokenId) external {
        _mint(to, tokenId);
    }

    /**
     * @notice Set default royalty for all tokens. For testing only.
     * @param receiver Royalty receiver address.
     * @param feeBps Royalty fee in basis points (e.g. 500 = 5%).
     */
    function setRoyalty(address receiver, uint96 feeBps) external {
        _setDefaultRoyalty(receiver, feeBps);
    }

    /**
     * @notice Delete the default royalty. For testing only.
     */
    function deleteRoyalty() external {
        _deleteDefaultRoyalty();
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721Royalty)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
