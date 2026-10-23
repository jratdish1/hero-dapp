// SPDX-License-Identifier: MIT
// HERO V3: staking port x recovered Hero (Base) integration. Owner: VETS (jratdish1).
// Local only: mock DEX router etched at the public router address, no fork, no keys.
pragma solidity 0.8.26;

import {MiniTest} from "../utils/MiniTest.sol";
import {MockFactory, MockRouter} from "../mocks/MockUniV2.sol";
import {Hero} from "../../src/base/Hero.sol";
import {HeroSingleSidedStaking} from "../../src/staking/HeroSingleSidedStaking.sol";

contract HeroStakingIntegrationTest is MiniTest {
    // Public DEX router (infrastructure, not a HERO wallet).
    address internal constant ROUTER = 0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24;
    Hero internal hero;
    HeroSingleSidedStaking internal staking;
    address internal SAFE;
    address internal ALICE;

    function setUp() public {
        SAFE = vm.addr(21);
        ALICE = vm.addr(22);
        vm.etch(ROUTER, address(new MockRouter(address(new MockFactory()))).code);
        hero = new Hero(uint32(block.timestamp), vm.addr(23), vm.addr(24), vm.addr(25));
        staking = new HeroSingleSidedStaking(SAFE, address(hero), 7 days);
        hero.launch();
        hero.transfer(ALICE, 1_000_000e18);
        hero.transfer(SAFE, 1_000_000e18);
        vm.prank(ALICE);
        hero.approve(address(staking), type(uint256).max);
        vm.prank(SAFE);
        hero.approve(address(staking), type(uint256).max);
    }

    function test_StakeEarnExitWithRealHero() public {
        vm.prank(ALICE);
        staking.stake(500_000e18);
        assertEq(staking.balanceOf(ALICE), 500_000e18, "no fee on non-pair transfer");
        vm.prank(SAFE);
        staking.notifyRewardAmount(70_000e18);
        vm.warp(block.timestamp + 7 days + 1);
        uint256 before = hero.balanceOf(ALICE);
        vm.prank(ALICE);
        staking.exit();
        uint256 got = hero.balanceOf(ALICE) - before;
        require(got <= 570_000e18 && got >= 570_000e18 - 1e12, "principal + ~reward");
    }

    /// Documents a V3 config dependency: if Hero.maxTxAmount is lowered and the staking contract is
    /// not tx-limit-exempt, withdrawals above maxTx revert (principal stuck until the owner acts).
    function test_LoweredMaxTxBlocksLargeWithdrawUnlessExempt() public {
        vm.prank(ALICE);
        staking.stake(500_000e18);
        hero.setTxLimit(hero.totalSupply() / 2000); // 50,000 HERO
        vm.prank(ALICE);
        vm.expectRevert(bytes("TX Limit Exceeded"));
        staking.withdraw(500_000e18);
        hero.setTxLimitExempt(address(staking), true);
        vm.prank(ALICE);
        staking.withdraw(500_000e18);
        assertEq(staking.totalSupply(), 0, "withdrawn once exempt");
    }
}
