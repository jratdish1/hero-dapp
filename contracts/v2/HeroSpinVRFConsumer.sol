// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable, Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";

/// @notice Chainlink VRF v2.5 request types, copied verbatim from smartcontractkit/chainlink
///         contracts-v1.3.0 (vrf/dev/libraries/VRFV2PlusClient.sol). Inline to avoid a new dependency.
library VRFV2PlusClient {
    bytes4 internal constant EXTRA_ARGS_V1_TAG = bytes4(keccak256("VRF ExtraArgsV1"));

    struct ExtraArgsV1 {
        bool nativePayment;
    }

    struct RandomWordsRequest {
        bytes32 keyHash;
        uint256 subId;
        uint16 requestConfirmations;
        uint32 callbackGasLimit;
        uint32 numWords;
        bytes extraArgs;
    }

    function _argsToBytes(ExtraArgsV1 memory extraArgs) internal pure returns (bytes memory bts) {
        return abi.encodeWithSelector(EXTRA_ARGS_V1_TAG, extraArgs);
    }
}

/// @notice The one coordinator function this consumer calls (IVRFCoordinatorV2Plus, contracts-v1.3.0).
interface IVRFCoordinatorV2PlusRequest {
    function requestRandomWords(VRFV2PlusClient.RandomWordsRequest calldata req) external returns (uint256 requestId);
}

/// @title HeroSpinVRFConsumer - Tier 3 (Chainlink VRF v2.5) randomness for HERO spins on Base.
/// @notice One draw per spin, and a spin's identity is fixed on-chain: (wallet, UTC day from the block clock,
///         tier, sequence number). The daily spin cap is enforced here, so the operator cannot request a second
///         draw to replace an outcome it dislikes. Every request and result is public and permanent.
/// @dev Add this contract as a consumer on a funded VRF v2.5 subscription. Chainlink calls
///      rawFulfillRandomWords; it never reverts on unknown or duplicate requests (Chainlink guidance).
contract HeroSpinVRFConsumer is Ownable2Step {
    uint32 public constant MAX_CALLBACK_GAS = 2_500_000; // Base coordinator maxGasLimit
    uint16 public constant MAX_CONFIRMATIONS = 200;
    uint8 public constant MAX_TIER = 2; // 0 bronze, 1 silver, 2 gold
    uint8 public constant MAX_SPINS_CAP = 10;

    struct Request {
        bytes32 spinKey;
        address wallet;
        uint32 day;
        uint8 tier;
        uint64 requestedAt;
        bool fulfilled;
        uint256 word;
    }

    IVRFCoordinatorV2PlusRequest public immutable coordinator;
    bytes32 public keyHash;
    uint256 public subscriptionId;
    uint32 public callbackGasLimit;
    uint16 public requestConfirmations;
    bool public nativePayment;
    bool public paused;
    uint8 public maxSpinsPerDay = 1;

    mapping(address => bool) public isRequester;
    mapping(uint256 => Request) public requests;
    mapping(bytes32 => uint256) public requestIdOfSpin;
    mapping(address => mapping(uint32 => uint8)) public spinsOnDay;

    event SpinRequested(uint256 indexed requestId, bytes32 indexed spinKey, address indexed wallet, uint32 day, uint8 tier, uint8 nonce);
    event SpinFulfilled(uint256 indexed requestId, bytes32 indexed spinKey, uint256 word);
    event ConfigUpdated(bytes32 keyHash, uint256 subscriptionId, uint32 callbackGasLimit, uint16 requestConfirmations, bool nativePayment);
    event RequesterSet(address indexed requester, bool allowed);
    event PausedSet(bool paused);
    event MaxSpinsPerDaySet(uint8 maxSpinsPerDay);

    error OnlyCoordinatorCanFulfill(address have, address want);
    error NotRequester(address caller);
    error RequestsPaused();
    error SpinLimitReached(address wallet, uint32 day);
    error InvalidTier(uint8 tier);
    error InvalidConfig();
    error UnknownRequest(uint256 requestId);
    error ZeroAddress();

    constructor(
        address coordinator_,
        bytes32 keyHash_,
        uint256 subscriptionId_,
        uint32 callbackGasLimit_,
        uint16 requestConfirmations_,
        bool nativePayment_,
        address owner_
    ) Ownable(owner_) {
        if (coordinator_ == address(0)) revert ZeroAddress();
        coordinator = IVRFCoordinatorV2PlusRequest(coordinator_);
        _setConfig(keyHash_, subscriptionId_, callbackGasLimit_, requestConfirmations_, nativePayment_);
    }

    // ------------------------------------------------------------------ owner

    function setConfig(bytes32 keyHash_, uint256 subscriptionId_, uint32 callbackGasLimit_, uint16 requestConfirmations_, bool nativePayment_)
        external
        onlyOwner
    {
        _setConfig(keyHash_, subscriptionId_, callbackGasLimit_, requestConfirmations_, nativePayment_);
    }

    function setRequester(address requester, bool allowed) external onlyOwner {
        if (requester == address(0)) revert ZeroAddress();
        isRequester[requester] = allowed;
        emit RequesterSet(requester, allowed);
    }

    function setPaused(bool paused_) external onlyOwner {
        paused = paused_;
        emit PausedSet(paused_);
    }

    function setMaxSpinsPerDay(uint8 max_) external onlyOwner {
        if (max_ == 0 || max_ > MAX_SPINS_CAP) revert InvalidConfig();
        maxSpinsPerDay = max_;
        emit MaxSpinsPerDaySet(max_);
    }

    // --------------------------------------------------------------- requests

    /// @notice Request the draw for `wallet`'s next spin today. Reverts past the daily cap: no rerolls.
    function requestSpin(address wallet, uint8 tier) external returns (uint256 requestId, bytes32 spinKey) {
        if (!isRequester[msg.sender]) revert NotRequester(msg.sender);
        if (paused) revert RequestsPaused();
        if (wallet == address(0)) revert ZeroAddress();
        if (tier > MAX_TIER) revert InvalidTier(tier);
        uint32 day = currentDay();
        uint8 nonce = spinsOnDay[wallet][day];
        if (nonce >= maxSpinsPerDay) revert SpinLimitReached(wallet, day);
        spinsOnDay[wallet][day] = nonce + 1;
        spinKey = computeSpinKey(wallet, day, tier, nonce);

        requestId = coordinator.requestRandomWords(
            VRFV2PlusClient.RandomWordsRequest({
                keyHash: keyHash,
                subId: subscriptionId,
                requestConfirmations: requestConfirmations,
                callbackGasLimit: callbackGasLimit,
                numWords: 1,
                extraArgs: VRFV2PlusClient._argsToBytes(VRFV2PlusClient.ExtraArgsV1({nativePayment: nativePayment}))
            })
        );
        if (requestId == 0 || requests[requestId].spinKey != bytes32(0)) revert InvalidConfig();
        requests[requestId] = Request(spinKey, wallet, day, tier, uint64(block.timestamp), false, 0);
        requestIdOfSpin[spinKey] = requestId;
        emit SpinRequested(requestId, spinKey, wallet, day, tier, nonce);
    }

    /// @notice Called by the VRF coordinator only. Never reverts for unknown or repeated requests.
    function rawFulfillRandomWords(uint256 requestId, uint256[] calldata randomWords) external {
        if (msg.sender != address(coordinator)) revert OnlyCoordinatorCanFulfill(msg.sender, address(coordinator));
        Request storage r = requests[requestId];
        if (r.spinKey == bytes32(0) || r.fulfilled || randomWords.length == 0) return;
        r.fulfilled = true;
        r.word = randomWords[0];
        emit SpinFulfilled(requestId, r.spinKey, randomWords[0]);
    }

    // ------------------------------------------------------------------ views

    /// @notice Same shape as Chainlink's sample consumers, so off-chain readers can poll one function.
    function getRequestStatus(uint256 requestId) external view returns (bool fulfilled, uint256[] memory randomWords) {
        Request storage r = requests[requestId];
        if (r.spinKey == bytes32(0)) revert UnknownRequest(requestId);
        fulfilled = r.fulfilled;
        randomWords = new uint256[](fulfilled ? 1 : 0);
        if (fulfilled) randomWords[0] = r.word;
    }

    function currentDay() public view returns (uint32) {
        return uint32(block.timestamp / 1 days);
    }

    function computeSpinKey(address wallet, uint32 day, uint8 tier, uint8 nonce) public pure returns (bytes32) {
        return keccak256(abi.encode(wallet, day, tier, nonce));
    }

    // --------------------------------------------------------------- internal

    function _setConfig(bytes32 keyHash_, uint256 subscriptionId_, uint32 callbackGasLimit_, uint16 requestConfirmations_, bool nativePayment_)
        internal
    {
        if (
            keyHash_ == bytes32(0) || subscriptionId_ == 0 || callbackGasLimit_ < 40_000 || callbackGasLimit_ > MAX_CALLBACK_GAS
                || requestConfirmations_ > MAX_CONFIRMATIONS
        ) revert InvalidConfig();
        keyHash = keyHash_;
        subscriptionId = subscriptionId_;
        callbackGasLimit = callbackGasLimit_;
        requestConfirmations = requestConfirmations_;
        nativePayment = nativePayment_;
        emit ConfigUpdated(keyHash_, subscriptionId_, callbackGasLimit_, requestConfirmations_, nativePayment_);
    }
}
