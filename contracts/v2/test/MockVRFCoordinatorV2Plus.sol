// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {VRFV2PlusClient} from "../HeroSpinVRFConsumer.sol";

interface IRawFulfill {
    function rawFulfillRandomWords(uint256 requestId, uint256[] calldata randomWords) external;
}

/// @notice TEST ONLY. Records requests and fulfills them like the real coordinator's callback.
contract MockVRFCoordinatorV2Plus {
    uint256 public nonce;
    mapping(uint256 => address) public consumerOf;
    VRFV2PlusClient.RandomWordsRequest internal _last;

    event Fulfilled(uint256 indexed requestId, uint256 gasUsed);

    function requestRandomWords(VRFV2PlusClient.RandomWordsRequest calldata req) external returns (uint256 requestId) {
        requestId = uint256(keccak256(abi.encode(msg.sender, ++nonce)));
        consumerOf[requestId] = msg.sender;
        _last = req;
    }

    function lastRequest() external view returns (VRFV2PlusClient.RandomWordsRequest memory) {
        return _last;
    }

    function fulfill(uint256 requestId, uint256 word) external {
        uint256[] memory words = new uint256[](1);
        words[0] = word;
        uint256 before = gasleft();
        IRawFulfill(consumerOf[requestId]).rawFulfillRandomWords(requestId, words);
        emit Fulfilled(requestId, before - gasleft());
    }

    function fulfillRaw(address consumer, uint256 requestId, uint256[] calldata words) external {
        IRawFulfill(consumer).rawFulfillRandomWords(requestId, words);
    }
}
