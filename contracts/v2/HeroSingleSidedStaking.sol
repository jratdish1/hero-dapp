// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {Votes} from "@openzeppelin/contracts/governance/utils/Votes.sol";

/**
 * @title  HeroSingleSidedStaking
 * @notice Single-sided HERO staking: stake HERO, earn HERO.
 *
 *         - Synthetix StakingRewards-compatible surface (client/src/lib/staking-abi.ts):
 *           totalSupply, balanceOf, earned, rewardRate, rewardsDuration, periodFinish,
 *           rewardPerToken, lastTimeRewardApplicable, stakingToken, rewardsToken, paused,
 *           stake, withdraw, getReward, exit.
 *         - Staked principal is NEVER counted as reward funding. A new reward period is
 *           accepted only if the contract balance covers: all staked principal + all rewards
 *           already accrued but unpaid + the full new schedule.
 *         - The owner has NO path to staked HERO: there is no staking-token recovery,
 *           no upgrade hook, no sweep. recoverERC20 rejects HERO.
 *         - Pause blocks new stakes only. withdraw, getReward and exit always work.
 *         - Staked balances are checkpointed (OpenZeppelin Votes, ERC-5805/ERC-6372):
 *           getVotes / getPastVotes / getPastTotalSupply are the DAO vote source for
 *           HeroGovernor. The clock is block.timestamp so governance periods mean the
 *           same wall-clock time on Base and PulseChain.
 *         - First stake auto-self-delegates so stakers have voting power without an
 *           extra transaction. Stakers may re-delegate at any time via delegate().
 *
 * @dev    Unpaid-reward liability is tracked globally with ceiling rounding, so it is
 *         always >= the sum of every account's earned(). This keeps the solvency check
 *         conservative. No off-chain component is in any value path.
 */
contract HeroSingleSidedStaking is Ownable2Step, Pausable, ReentrancyGuard, Votes {
    using SafeERC20 for IERC20;

    // ─── Constants ────────────────────────────────────────────────────────────
    uint256 private constant PRECISION = 1e18;
    uint256 public constant MAX_REWARDS_DURATION = 365 days;

    // ─── Immutable token (stake token == reward token) ────────────────────────
    IERC20 public immutable hero;

    // ─── Synthetix reward state ───────────────────────────────────────────────
    uint256 public periodFinish;
    uint256 public rewardRate;
    uint256 public rewardsDuration;
    uint256 public lastUpdateTime;
    uint256 public rewardPerTokenStored;

    mapping(address => uint256) public userRewardPerTokenPaid;
    mapping(address => uint256) public rewards;

    // ─── Principal accounting ─────────────────────────────────────────────────
    uint256 private _totalSupply;
    mapping(address => uint256) private _balances;

    // ─── Reward liability accounting (transparency + solvency) ────────────────
    /// @notice Total rewards accrued to stakers (rounded up), all time.
    uint256 public totalRewardsAccrued;
    /// @notice Total rewards paid out to stakers, all time.
    uint256 public totalRewardsPaid;

    // ─── Events ───────────────────────────────────────────────────────────────
    event RewardAdded(uint256 reward, uint256 rewardRate, uint256 periodFinish);
    event Staked(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event RewardPaid(address indexed user, uint256 reward);
    event RewardsDurationUpdated(uint256 newDuration);
    event Recovered(address indexed token, uint256 amount);
    event SurplusRecycled(uint256 amount);

    // ─── Errors ───────────────────────────────────────────────────────────────
    error ZeroAddress();
    error ZeroAmount();
    error InvalidDuration();
    error PeriodNotFinished();
    error InsufficientBalance();
    error RewardTooHigh(uint256 required, uint256 available);
    error CannotRecoverStakingToken();
    error RenounceDisabled();

    constructor(address initialOwner, address heroToken, uint256 initialRewardsDuration)
        Ownable(initialOwner)
        EIP712("HeroSingleSidedStaking", "1")
    {
        if (heroToken == address(0)) revert ZeroAddress();
        if (initialRewardsDuration == 0 || initialRewardsDuration > MAX_REWARDS_DURATION) {
            revert InvalidDuration();
        }
        hero = IERC20(heroToken);
        rewardsDuration = initialRewardsDuration;
        emit RewardsDurationUpdated(initialRewardsDuration);
    }

    // ─── Modifiers ────────────────────────────────────────────────────────────
    modifier updateReward(address account) {
        _updateReward(account);
        _;
    }

    function _updateReward(address account) internal {
        uint256 newRpt = rewardPerToken();
        uint256 delta = newRpt - rewardPerTokenStored;
        if (delta != 0 && _totalSupply != 0) {
            totalRewardsAccrued += Math.mulDiv(_totalSupply, delta, PRECISION, Math.Rounding.Ceil);
        }
        rewardPerTokenStored = newRpt;
        lastUpdateTime = lastTimeRewardApplicable();
        if (account != address(0)) {
            rewards[account] = earned(account);
            userRewardPerTokenPaid[account] = newRpt;
        }
    }

    // ─── Synthetix-compatible views ───────────────────────────────────────────
    function stakingToken() external view returns (address) {
        return address(hero);
    }

    function rewardsToken() external view returns (address) {
        return address(hero);
    }

    function totalSupply() external view returns (uint256) {
        return _totalSupply;
    }

    function balanceOf(address account) external view returns (uint256) {
        return _balances[account];
    }

    function lastTimeRewardApplicable() public view returns (uint256) {
        return Math.min(block.timestamp, periodFinish);
    }

    function rewardPerToken() public view returns (uint256) {
        if (_totalSupply == 0) {
            return rewardPerTokenStored;
        }
        return rewardPerTokenStored
            + ((lastTimeRewardApplicable() - lastUpdateTime) * rewardRate * PRECISION) / _totalSupply;
    }

    function earned(address account) public view returns (uint256) {
        return (_balances[account] * (rewardPerToken() - userRewardPerTokenPaid[account])) / PRECISION
            + rewards[account];
    }

    function getRewardForDuration() external view returns (uint256) {
        return rewardRate * rewardsDuration;
    }

    /**
     * @notice Transparency view separating principal from reward liquidity.
     * @return heldBalance         HERO held by this contract.
     * @return stakedPrincipal     HERO owed to stakers as principal.
     * @return accruedUnpaid       Rewards accrued but not yet claimed (rounded up).
     * @return scheduledRemaining  Rewards still to be streamed in the current period.
     * @return unallocated         HERO above all obligations (0 if none).
     */
    function rewardReserveStatus()
        external
        view
        returns (
            uint256 heldBalance,
            uint256 stakedPrincipal,
            uint256 accruedUnpaid,
            uint256 scheduledRemaining,
            uint256 unallocated
        )
    {
        heldBalance = hero.balanceOf(address(this));
        stakedPrincipal = _totalSupply;
        accruedUnpaid = _accruedUnpaidView();
        scheduledRemaining = block.timestamp < periodFinish ? (periodFinish - block.timestamp) * rewardRate : 0;
        uint256 obligations = stakedPrincipal + accruedUnpaid + scheduledRemaining;
        unallocated = heldBalance > obligations ? heldBalance - obligations : 0;
    }

    function _accruedUnpaidView() internal view returns (uint256) {
        uint256 accrued = totalRewardsAccrued;
        if (_totalSupply != 0) {
            uint256 delta = rewardPerToken() - rewardPerTokenStored;
            accrued += Math.mulDiv(_totalSupply, delta, PRECISION, Math.Rounding.Ceil);
        }
        return accrued - totalRewardsPaid;
    }

    // ─── User actions ─────────────────────────────────────────────────────────
    /// @notice Stake HERO. Blocked while paused. Credits the amount actually received.
    function stake(uint256 amount) external nonReentrant whenNotPaused updateReward(msg.sender) {
        if (amount == 0) revert ZeroAmount();

        // Auto-self-delegate on first use so voting power is live without an extra tx.
        // Done before balances change so no voting units are double counted.
        if (delegates(msg.sender) == address(0)) {
            _delegate(msg.sender, msg.sender);
        }

        uint256 before = hero.balanceOf(address(this));
        hero.safeTransferFrom(msg.sender, address(this), amount);
        uint256 received = hero.balanceOf(address(this)) - before;
        if (received == 0) revert ZeroAmount();

        _totalSupply += received;
        _balances[msg.sender] += received;
        _transferVotingUnits(address(0), msg.sender, received);

        emit Staked(msg.sender, received);
    }

    /// @notice Withdraw staked HERO. Works while paused.
    function withdraw(uint256 amount) public nonReentrant updateReward(msg.sender) {
        _withdraw(amount);
    }

    /// @notice Claim accrued HERO rewards. Works while paused.
    function getReward() public nonReentrant updateReward(msg.sender) {
        _getReward();
    }

    /// @notice Withdraw all principal and claim all rewards. Works while paused.
    function exit() external nonReentrant updateReward(msg.sender) {
        uint256 bal = _balances[msg.sender];
        if (bal != 0) _withdraw(bal);
        _getReward();
    }

    function _withdraw(uint256 amount) internal {
        if (amount == 0) revert ZeroAmount();
        uint256 bal = _balances[msg.sender];
        if (amount > bal) revert InsufficientBalance();
        unchecked {
            _balances[msg.sender] = bal - amount;
            _totalSupply -= amount;
        }
        _transferVotingUnits(msg.sender, address(0), amount);
        hero.safeTransfer(msg.sender, amount);
        emit Withdrawn(msg.sender, amount);
    }

    function _getReward() internal {
        uint256 reward = rewards[msg.sender];
        if (reward != 0) {
            rewards[msg.sender] = 0;
            totalRewardsPaid += reward;
            hero.safeTransfer(msg.sender, reward);
            emit RewardPaid(msg.sender, reward);
        }
    }

    // ─── Owner: reward funding ────────────────────────────────────────────────
    /**
     * @notice Pull `reward` HERO from the caller (0 allowed) and stream it, plus any leftover
     *         of the current period and any unallocated HERO, over rewardsDuration.
     * @dev    Reverts unless balance >= principal + accrued-unpaid + new full schedule.
     *         Staked principal can therefore never be promised as rewards. Calling with 0
     *         recycles stranded HERO (donations, zero-staker periods, dust) to stakers.
     */
    function notifyRewardAmount(uint256 reward) external onlyOwner nonReentrant updateReward(address(0)) {
        uint256 received;
        if (reward != 0) {
            uint256 before = hero.balanceOf(address(this));
            hero.safeTransferFrom(msg.sender, address(this), reward);
            received = hero.balanceOf(address(this)) - before;
            if (received == 0) revert ZeroAmount();
        }

        // Everything above principal + accrued-unpaid + the remaining schedule is unallocated
        // (new funding, direct donations, rewards streamed while nobody was staked, rounding
        // dust). It is streamed to stakers. It can never go to the owner.
        uint256 leftover = block.timestamp < periodFinish ? (periodFinish - block.timestamp) * rewardRate : 0;
        uint256 obligations = _totalSupply + (totalRewardsAccrued - totalRewardsPaid) + leftover;
        uint256 balance = hero.balanceOf(address(this));
        uint256 unallocated = balance > obligations ? balance - obligations : 0;

        uint256 newRate = (leftover + unallocated) / rewardsDuration;
        if (newRate == 0) revert ZeroAmount();

        // Defence in depth: principal is never promised as rewards.
        uint256 required = _totalSupply + (totalRewardsAccrued - totalRewardsPaid) + newRate * rewardsDuration;
        if (required > balance) revert RewardTooHigh(required, balance);

        rewardRate = newRate;
        lastUpdateTime = block.timestamp;
        periodFinish = block.timestamp + rewardsDuration;
        if (unallocated > received) emit SurplusRecycled(unallocated - received);
        emit RewardAdded(received, newRate, periodFinish);
    }

    function setRewardsDuration(uint256 newDuration) external onlyOwner {
        if (block.timestamp <= periodFinish) revert PeriodNotFinished();
        if (newDuration == 0 || newDuration > MAX_REWARDS_DURATION) revert InvalidDuration();
        rewardsDuration = newDuration;
        emit RewardsDurationUpdated(newDuration);
    }

    // ─── Owner: safety ────────────────────────────────────────────────────────
    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    /// @notice Recover tokens sent here by mistake. HERO can never be recovered.
    function recoverERC20(address token, uint256 amount) external onlyOwner nonReentrant {
        if (token == address(hero)) revert CannotRecoverStakingToken();
        IERC20(token).safeTransfer(owner(), amount);
        emit Recovered(token, amount);
    }

    /// @dev Renouncing would permanently stop reward funding; transfer to a multisig instead.
    function renounceOwnership() public view override onlyOwner {
        revert RenounceDisabled();
    }

    // ─── Votes (ERC-5805 / ERC-6372) ──────────────────────────────────────────
    function clock() public view override returns (uint48) {
        return uint48(block.timestamp);
    }

    // solhint-disable-next-line func-name-mixedcase
    function CLOCK_MODE() public view override returns (string memory) {
        if (clock() != uint48(block.timestamp)) revert ERC6372InconsistentClock();
        return "mode=timestamp";
    }

    function _getVotingUnits(address account) internal view override returns (uint256) {
        return _balances[account];
    }
}
