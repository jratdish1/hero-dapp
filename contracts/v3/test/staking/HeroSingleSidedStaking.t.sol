// SPDX-License-Identifier: MIT
// HERO V3 single-sided staking tests (Foundry port of the hero-dapp #119 hardhat suite,
// plus V3 integration with the recovered Hero token). Owner: VETS (jratdish1).
// Local only: no fork, no RPC, no keys. Actors are vm.addr(n) of test-only keys.
pragma solidity 0.8.26;

import {MiniTest} from "../utils/MiniTest.sol";
import {MockERC20} from "./StakingMocks.sol";
import {HeroSingleSidedStaking} from "../../src/staking/HeroSingleSidedStaking.sol";

contract HeroSingleSidedStakingTest is MiniTest {
    uint256 internal constant DAY = 1 days;
    uint256 internal constant DURATION = 7 days;
    MockERC20 internal hero;
    HeroSingleSidedStaking internal staking;
    address internal SAFE;
    address internal ALICE;
    address internal BOB;
    address internal EVE;

    function setUp() public {
        SAFE = vm.addr(11);
        ALICE = vm.addr(12);
        BOB = vm.addr(13);
        EVE = vm.addr(14);
        vm.warp(1_800_000_000);
        hero = new MockERC20(0);
        staking = new HeroSingleSidedStaking(SAFE, address(hero), DURATION);
        hero.mint(ALICE, 1_000_000e18);
        hero.mint(BOB, 1_000_000e18);
        hero.mint(SAFE, 10_000_000e18);
        vm.prank(ALICE);
        hero.approve(address(staking), type(uint256).max);
        vm.prank(BOB);
        hero.approve(address(staking), type(uint256).max);
        vm.prank(SAFE);
        hero.approve(address(staking), type(uint256).max);
    }

    function _stake(address who, uint256 amt) internal {
        vm.prank(who);
        staking.stake(amt);
    }

    function _fund(uint256 amt) internal {
        vm.prank(SAFE);
        staking.notifyRewardAmount(amt);
    }

    function _approxEq(uint256 a, uint256 b, uint256 tol, string memory m) internal pure {
        require(a > b ? a - b <= tol : b - a <= tol, m);
    }

    // ─── Deployment ─────────────────────────────────────────────────────────
    function test_Deployment() public view {
        assertEq(staking.stakingToken(), address(hero), "stake token");
        assertEq(staking.rewardsToken(), address(hero), "reward token");
        assertEq(staking.owner(), SAFE, "owner = Safe placeholder");
        assertEq(staking.rewardsDuration(), DURATION, "duration");
        assertEq(uint256(staking.clock()), block.timestamp, "timestamp clock");
        assertTrue(keccak256(bytes(staking.CLOCK_MODE())) == keccak256("mode=timestamp"), "clock mode");
    }

    function test_RevertWhen_ZeroToken() public {
        vm.expectRevert(abi.encodeWithSelector(HeroSingleSidedStaking.ZeroAddress.selector));
        new HeroSingleSidedStaking(SAFE, address(0), DURATION);
    }

    function test_RevertWhen_ZeroOwner() public {
        // OZ 5 Ownable rejects a zero initial owner (OwnableInvalidOwner(address(0))).
        vm.expectRevert(abi.encodeWithSignature("OwnableInvalidOwner(address)", address(0)));
        new HeroSingleSidedStaking(address(0), address(hero), DURATION);
    }

    function test_RevertWhen_BadDuration() public {
        vm.expectRevert(abi.encodeWithSelector(HeroSingleSidedStaking.InvalidDuration.selector));
        new HeroSingleSidedStaking(SAFE, address(hero), 0);
        vm.expectRevert(abi.encodeWithSelector(HeroSingleSidedStaking.InvalidDuration.selector));
        new HeroSingleSidedStaking(SAFE, address(hero), 366 days);
    }

    // ─── Stake / withdraw ───────────────────────────────────────────────────
    function test_StakeWithdrawExactPrincipal() public {
        _stake(ALICE, 200e18);
        assertEq(staking.balanceOf(ALICE), 200e18, "bal");
        assertEq(staking.totalSupply(), 200e18, "supply");
        uint256 before = hero.balanceOf(ALICE);
        vm.prank(ALICE);
        staking.withdraw(200e18);
        assertEq(hero.balanceOf(ALICE) - before, 200e18, "exact principal back");
        assertEq(staking.totalSupply(), 0, "supply 0");
    }

    function test_RevertWhen_ZeroOrExcess() public {
        vm.prank(ALICE);
        vm.expectRevert(abi.encodeWithSelector(HeroSingleSidedStaking.ZeroAmount.selector));
        staking.stake(0);
        _stake(ALICE, 10e18);
        vm.prank(ALICE);
        vm.expectRevert(abi.encodeWithSelector(HeroSingleSidedStaking.InsufficientBalance.selector));
        staking.withdraw(11e18);
        vm.prank(ALICE);
        vm.expectRevert(abi.encodeWithSelector(HeroSingleSidedStaking.ZeroAmount.selector));
        staking.withdraw(0);
    }

    function test_FeeOnTransferCreditsReceived() public {
        MockERC20 fot = new MockERC20(100); // 1% transfer fee
        HeroSingleSidedStaking s = new HeroSingleSidedStaking(SAFE, address(fot), DURATION);
        fot.mint(ALICE, 1000e18);
        vm.startPrank(ALICE);
        fot.approve(address(s), type(uint256).max);
        s.stake(100e18);
        vm.stopPrank();
        assertEq(s.balanceOf(ALICE), 99e18, "credited received, not requested");
    }

    // ─── Rewards ────────────────────────────────────────────────────────────
    function test_OnlyOwnerFunds() public {
        vm.prank(ALICE);
        vm.expectRevert(abi.encodeWithSignature("OwnableUnauthorizedAccount(address)", ALICE));
        staking.notifyRewardAmount(1e18);
    }

    function test_SingleStakerEarnsFullReward() public {
        _stake(ALICE, 1000e18);
        _fund(7000e18);
        vm.warp(block.timestamp + DURATION + 1);
        _approxEq(staking.earned(ALICE), 7000e18, 1e12, "~full reward");
        uint256 before = hero.balanceOf(ALICE);
        vm.prank(ALICE);
        staking.exit();
        _approxEq(hero.balanceOf(ALICE) - before, 8000e18, 1e12, "principal + reward");
    }

    function test_ProRataSplit() public {
        _stake(ALICE, 100e18);
        _stake(BOB, 300e18);
        _fund(4000e18);
        vm.warp(block.timestamp + DURATION);
        _approxEq(staking.earned(ALICE), 1000e18, 1e12, "alice 1/4");
        _approxEq(staking.earned(BOB), 3000e18, 1e12, "bob 3/4");
    }

    function test_LeftoverRollsIntoNewNotify() public {
        _stake(ALICE, 100e18);
        _fund(7000e18);
        vm.warp(block.timestamp + DURATION / 2);
        _fund(7000e18);
        vm.warp(block.timestamp + DURATION);
        _approxEq(staking.earned(ALICE), 14000e18, 1e13, "both fundings streamed");
    }

    function test_SetRewardsDurationOnlyAfterPeriod() public {
        _stake(ALICE, 1e18);
        _fund(7000e18);
        vm.prank(SAFE);
        vm.expectRevert(abi.encodeWithSelector(HeroSingleSidedStaking.PeriodNotFinished.selector));
        staking.setRewardsDuration(DAY);
        vm.warp(block.timestamp + DURATION + 1);
        vm.prank(SAFE);
        staking.setRewardsDuration(DAY);
        assertEq(staking.rewardsDuration(), DAY, "updated");
    }

    // ─── Principal is never reward funding ──────────────────────────────────
    function test_PrincipalNeverRecycled() public {
        _stake(ALICE, 500e18);
        vm.prank(SAFE);
        vm.expectRevert(abi.encodeWithSelector(HeroSingleSidedStaking.ZeroAmount.selector));
        staking.notifyRewardAmount(0);
        (, uint256 principal,,, uint256 unallocated) = staking.rewardReserveStatus();
        assertEq(principal, 500e18, "principal");
        assertEq(unallocated, 0, "principal not unallocated");
    }

    function test_DonatedHeroRecycledToStakers() public {
        _stake(ALICE, 100e18);
        vm.prank(BOB);
        hero.transfer(address(staking), 350e18);
        _fund(0);
        vm.warp(block.timestamp + DURATION);
        _approxEq(staking.earned(ALICE), 350e18, 1e12, "donation streamed to staker");
    }

    function test_ZeroStakerPeriodRecycled() public {
        _fund(700e18);
        vm.warp(block.timestamp + DURATION + 1); // nobody staked: nothing owed
        _stake(ALICE, 1e18);
        _fund(0);
        vm.warp(block.timestamp + DURATION + 1);
        _approxEq(staking.earned(ALICE), 700e18, 1e12, "stranded rewards recycled");
    }

    function test_FormerStakerRewardStaysReserved() public {
        _stake(ALICE, 100e18);
        _fund(700e18);
        vm.warp(block.timestamp + DURATION + 1);
        vm.prank(ALICE);
        staking.withdraw(100e18); // leaves rewards unclaimed
        uint256 owed = staking.rewards(ALICE);
        vm.prank(SAFE);
        try staking.notifyRewardAmount(0) {} catch {}
        uint256 before = hero.balanceOf(ALICE);
        vm.prank(ALICE);
        staking.getReward();
        assertEq(hero.balanceOf(ALICE) - before, owed, "former staker paid in full");
    }

    // ─── Pause ──────────────────────────────────────────────────────────────
    function test_PauseBlocksStakeOnly() public {
        _stake(ALICE, 400e18);
        _stake(BOB, 100e18);
        _fund(700e18);
        vm.warp(block.timestamp + DAY);
        vm.prank(SAFE);
        staking.pause();
        vm.prank(ALICE);
        vm.expectRevert(abi.encodeWithSignature("EnforcedPause()"));
        staking.stake(1e18);
        vm.startPrank(ALICE);
        staking.withdraw(400e18);
        staking.getReward();
        vm.stopPrank();
        vm.prank(BOB);
        staking.exit();
        assertEq(staking.totalSupply(), 0, "everyone out while paused");
    }

    function test_OnlyOwnerPauses() public {
        vm.prank(EVE);
        vm.expectRevert(abi.encodeWithSignature("OwnableUnauthorizedAccount(address)", EVE));
        staking.pause();
    }

    // ─── Owner powers bounded ───────────────────────────────────────────────
    function test_RecoverRejectsHero() public {
        vm.prank(SAFE);
        vm.expectRevert(abi.encodeWithSelector(HeroSingleSidedStaking.CannotRecoverStakingToken.selector));
        staking.recoverERC20(address(hero), 1);
    }

    function test_RecoverOtherToken() public {
        MockERC20 other = new MockERC20(0);
        other.mint(address(staking), 5e18);
        vm.prank(SAFE);
        staking.recoverERC20(address(other), 5e18);
        assertEq(other.balanceOf(SAFE), 5e18, "sent to owner");
    }

    function test_RenounceDisabledAndTwoStepTransfer() public {
        vm.prank(SAFE);
        vm.expectRevert(abi.encodeWithSelector(HeroSingleSidedStaking.RenounceDisabled.selector));
        staking.renounceOwnership();
        address next = vm.addr(15);
        vm.prank(SAFE);
        staking.transferOwnership(next);
        assertEq(staking.owner(), SAFE, "owner unchanged until accept");
        assertEq(staking.pendingOwner(), next, "pending");
        vm.prank(next);
        staking.acceptOwnership();
        assertEq(staking.owner(), next, "accepted");
    }

    // ─── Votes ──────────────────────────────────────────────────────────────
    function test_VotesFollowStake() public {
        _stake(ALICE, 100e18);
        assertEq(staking.getVotes(ALICE), 100e18, "auto self-delegated");
        uint256 t = block.timestamp;
        vm.warp(t + 10);
        vm.prank(ALICE);
        staking.withdraw(40e18);
        assertEq(staking.getVotes(ALICE), 60e18, "votes drop on withdraw");
        assertEq(staking.getPastVotes(ALICE, t), 100e18, "checkpoint at t");
        assertEq(staking.getPastTotalSupply(t), 100e18, "past total");
    }

    // ─── Solvency fuzz ──────────────────────────────────────────────────────
    function testFuzz_Solvency(uint96 a, uint96 b, uint96 r1, uint96 r2, uint32 t1, uint32 t2, uint32 t3) public {
        uint256 sa = bound(a, 1, 1_000_000e18);
        uint256 sb = bound(b, 1, 1_000_000e18);
        uint256 f1 = bound(r1, DURATION, 1_000_000e18);
        uint256 f2 = bound(r2, DURATION, 1_000_000e18);
        _stake(ALICE, sa);
        _fund(f1);
        vm.warp(block.timestamp + bound(t1, 0, 30 days));
        _stake(BOB, sb);
        _fund(f2);
        vm.warp(block.timestamp + bound(t2, 0, 30 days));
        vm.prank(ALICE);
        staking.exit();
        _checkSolvent();
        vm.warp(block.timestamp + bound(t3, 0, 30 days));
        vm.prank(BOB);
        staking.exit();
        _checkSolvent();
        assertEq(staking.totalSupply(), 0, "all out");
    }

    function _checkSolvent() internal view {
        (uint256 held, uint256 principal, uint256 accrued, uint256 scheduled,) = staking.rewardReserveStatus();
        assertTrue(held >= principal + accrued + scheduled, "solvent");
    }

    function bound(uint256 x, uint256 lo, uint256 hi) internal pure returns (uint256) {
        return lo + (x % (hi - lo + 1));
    }
}
