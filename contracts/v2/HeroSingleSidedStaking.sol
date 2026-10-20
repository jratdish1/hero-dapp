// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/**
 * @title HeroSingleSidedStaking
 * @notice Stake HERO, earn HERO. Synthetix StakingRewards-compatible surface
 *         (matches client/src/lib/staking-abi.ts) plus checkpointed voting
 *         power (OpenZeppelin Votes) so a Governor can read staked HERO at a
 *         proposal snapshot.
 *
 * @dev Trust model (VETS 2026-09-25, "TRUSTLESS"):
 *   - Staked principal is tracked separately from reward funds. Rewards are
 *     funded by pulling tokens in notifyRewardAmount, so principal can never
 *     back a reward promise.
 *   - The owner can never move principal or funded rewards. recoverERC20 for
 *     HERO is limited to the true surplus: balance - totalStaked - rewardReserve.
 *   - Pause blocks new stakes only. withdraw, getReward and exit always work.
 *   - Rewards not emitted because nobody was staked are carried into the next
 *     reward period (never stranded, never taken by the owner).
 *   - Fee-on-transfer / rebasing tokens are rejected by exact balance-delta checks.
 *   - Voting power = staked balance, delegated. First stake auto-self-delegates.
 *
 *   NOT DEPLOYED. Deployment requires Codex Grade A at exact SHA and VETS GO.
 */

import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/governance/utils/Votes.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract HeroSingleSidedStaking is Ownable2Step, Pausable, ReentrancyGuard, Votes {
    using SafeERC20 for IERC20;

    // ─── Errors ──────────────────────────────────────────────────────────────
    error ZeroAddress();
    error ZeroAmount();
    error InsufficientStake();
    error UnsupportedToken();       // fee-on-transfer / rebasing behaviour detected
    error RewardRateZero();
    error PeriodActive();
    error InvalidDuration();
    error ExceedsSurplus();
    error RenounceDisabled();

    // ─── Events (Synthetix-compatible names) ─────────────────────────────────
    event RewardAdded(uint256 reward);
    event Staked(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event RewardPaid(address indexed user, uint256 reward);
    event RewardsDurationUpdated(uint256 newDuration);
    event Recovered(address indexed token, address indexed to, uint256 amount);

    // ─── Constants ───────────────────────────────────────────────────────────
    uint256 public constant MIN_DURATION = 1 days;
    uint256 public constant MAX_DURATION = 3650 days;

    // ─── Immutable config ────────────────────────────────────────────────────
    IERC20 public immutable stakingToken;
    IERC20 public immutable rewardsToken; // same token as stakingToken (HERO)

    // ─── Reward state ────────────────────────────────────────────────────────
    uint256 public periodFinish;
    uint256 public rewardRate;
    uint256 public rewardsDuration;
    uint256 public lastUpdateTime;
    uint256 public rewardPerTokenStored;

    /// @notice HERO funded for rewards and not yet paid out (committed + carry).
    uint256 public rewardReserve;
    /// @notice Rewards scheduled while nobody was staked; rolled into next period.
    uint256 public unallocatedRewards;

    mapping(address => uint256) public userRewardPerTokenPaid;
    mapping(address => uint256) public rewards;

    // ─── Stake state ─────────────────────────────────────────────────────────
    uint256 private _totalSupply;
    mapping(address => uint256) private _balances;

    constructor(address hero, address initialOwner, uint256 initialDuration)
        Ownable(initialOwner)
        EIP712("HeroSingleSidedStaking", "1")
    {
        if (hero == address(0)) revert ZeroAddress();
        if (initialDuration < MIN_DURATION || initialDuration > MAX_DURATION) revert InvalidDuration();
        stakingToken = IERC20(hero);
        rewardsToken = IERC20(hero);
        rewardsDuration = initialDuration;
    }

    // ─── Views ───────────────────────────────────────────────────────────────
    function totalSupply() external view returns (uint256) {
        return _totalSupply;
    }

    function balanceOf(address account) external view returns (uint256) {
        return _balances[account];
    }

    function lastTimeRewardApplicable() public view returns (uint256) {
        return block.timestamp < periodFinish ? block.timestamp : periodFinish;
    }

    function rewardPerToken() public view returns (uint256) {
        if (_totalSupply == 0) return rewardPerTokenStored;
        return rewardPerTokenStored
            + ((lastTimeRewardApplicable() - lastUpdateTime) * rewardRate * 1e18) / _totalSupply;
    }

    function earned(address account) public view returns (uint256) {
        return (_balances[account] * (rewardPerToken() - userRewardPerTokenPaid[account])) / 1e18
            + rewards[account];
    }

    function getRewardForDuration() external view returns (uint256) {
        return rewardRate * rewardsDuration;
    }

    // ─── User actions ────────────────────────────────────────────────────────
    function stake(uint256 amount) external nonReentrant whenNotPaused {
        if (amount == 0) revert ZeroAmount();
        _updateReward(msg.sender);

        uint256 before = stakingToken.balanceOf(address(this));
        stakingToken.safeTransferFrom(msg.sender, address(this), amount);
        if (stakingToken.balanceOf(address(this)) - before != amount) revert UnsupportedToken();

        // Self-delegate BEFORE crediting the balance: _delegate moves the account's
        // existing (currently unassigned) units, then the new units are minted once.
        if (delegates(msg.sender) == address(0)) _delegate(msg.sender, msg.sender);

        _totalSupply += amount;
        _balances[msg.sender] += amount;
        _transferVotingUnits(address(0), msg.sender, amount);
        emit Staked(msg.sender, amount);
    }

    /// @notice Always available, including while paused.
    function withdraw(uint256 amount) public nonReentrant {
        _withdraw(msg.sender, amount);
    }

    /// @notice Always available, including while paused.
    function getReward() public nonReentrant {
        _getReward(msg.sender);
    }

    /// @notice Always available, including while paused.
    function exit() external nonReentrant {
        uint256 bal = _balances[msg.sender];
        if (bal > 0) _withdraw(msg.sender, bal);
        _getReward(msg.sender);
    }

    // ─── Owner actions (cannot touch principal or funded rewards) ───────────
    /**
     * @notice Pull `reward` HERO from the caller and schedule it over rewardsDuration.
     *         Unemitted leftover and idle-period carry are rolled in.
     */
    function notifyRewardAmount(uint256 reward) external onlyOwner nonReentrant {
        _updateReward(address(0));

        if (reward > 0) {
            uint256 before = rewardsToken.balanceOf(address(this));
            rewardsToken.safeTransferFrom(msg.sender, address(this), reward);
            if (rewardsToken.balanceOf(address(this)) - before != reward) revert UnsupportedToken();
            rewardReserve += reward;
        }

        uint256 total = reward + unallocatedRewards;
        if (block.timestamp < periodFinish) {
            total += (periodFinish - block.timestamp) * rewardRate;
        }
        uint256 newRate = total / rewardsDuration;
        if (newRate == 0) revert RewardRateZero();

        rewardRate = newRate;
        unallocatedRewards = total - newRate * rewardsDuration; // division dust carried, never lost
        lastUpdateTime = block.timestamp;
        periodFinish = block.timestamp + rewardsDuration;
        emit RewardAdded(reward);
    }

    function setRewardsDuration(uint256 newDuration) external onlyOwner {
        if (block.timestamp <= periodFinish) revert PeriodActive();
        if (newDuration < MIN_DURATION || newDuration > MAX_DURATION) revert InvalidDuration();
        rewardsDuration = newDuration;
        emit RewardsDurationUpdated(newDuration);
    }

    /**
     * @notice Recover tokens sent here by mistake. For HERO only the true surplus
     *         (balance - totalStaked - rewardReserve) is recoverable.
     */
    function recoverERC20(address token, address to, uint256 amount) external onlyOwner nonReentrant {
        if (to == address(0)) revert ZeroAddress();
        if (token == address(stakingToken)) {
            uint256 bal = stakingToken.balanceOf(address(this));
            uint256 locked = _totalSupply + rewardReserve;
            if (bal < locked || amount > bal - locked) revert ExceedsSurplus();
        }
        IERC20(token).safeTransfer(to, amount);
        emit Recovered(token, to, amount);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    /// @dev Prevent accidentally orphaning reward funding. Transfer to a multisig instead.
    function renounceOwnership() public view override onlyOwner {
        revert RenounceDisabled();
    }

    // ─── Internals ───────────────────────────────────────────────────────────
    function _updateReward(address account) internal {
        uint256 applicable = lastTimeRewardApplicable();
        if (_totalSupply == 0) {
            if (applicable > lastUpdateTime) {
                unallocatedRewards += (applicable - lastUpdateTime) * rewardRate;
            }
        } else {
            rewardPerTokenStored = rewardPerToken();
        }
        lastUpdateTime = applicable;
        if (account != address(0)) {
            rewards[account] = earned(account);
            userRewardPerTokenPaid[account] = rewardPerTokenStored;
        }
    }

    function _withdraw(address user, uint256 amount) internal {
        if (amount == 0) revert ZeroAmount();
        if (amount > _balances[user]) revert InsufficientStake();
        _updateReward(user);
        _totalSupply -= amount;
        _balances[user] -= amount;
        _transferVotingUnits(user, address(0), amount);
        stakingToken.safeTransfer(user, amount);
        emit Withdrawn(user, amount);
    }

    function _getReward(address user) internal {
        _updateReward(user);
        uint256 reward = rewards[user];
        if (reward > 0) {
            rewards[user] = 0;
            rewardReserve -= reward;
            rewardsToken.safeTransfer(user, reward);
            emit RewardPaid(user, reward);
        }
    }

    /// @dev Voting units = staked balance.
    function _getVotingUnits(address account) internal view override returns (uint256) {
        return _balances[account];
    }
}
