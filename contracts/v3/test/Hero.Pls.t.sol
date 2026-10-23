// SPDX-License-Identifier: MIT
// HERO V3 unit tests (Pls). Owner: VETS (jratdish1). Local only, no fork, no keys.
pragma solidity 0.8.26;

import {MiniTest} from "./utils/MiniTest.sol";
import {MockFactory, MockRouter, MockToken} from "./mocks/MockUniV2.sol";
import {Hero} from "../src/pulsechain/Hero.sol";
import {HeroBuyAndBurn} from "../src/pulsechain/HeroBuyAndBurn.sol";

contract HeroV3PlsTest is MiniTest {
    // Public DEX router (infrastructure, not a HERO wallet).
    address internal constant ROUTER = 0x165C3410fC91EF562C50559f7d2289fEbed552d9;
    // Throwaway placeholders derived from test-only private keys 1..4. Never real addresses.
    address internal SAFE;
    address internal R_LP;
    address internal R_DON;
    address internal R_STK;
    Hero internal hero;

    function setUp() public {
        SAFE = vm.addr(1);
        R_LP = vm.addr(2);
        R_DON = vm.addr(3);
        R_STK = vm.addr(4);
        vm.etch(ROUTER, address(new MockRouter(address(new MockFactory()))).code);
        vm.etch(0x4013abBf94A745EfA7cc848989Ee83424A770060, address(new MockToken()).code); // VETS token (infra)
        hero = new Hero(uint32(block.timestamp), R_LP, R_DON, R_STK);
    }

    function test_RevertWhen_AutoLpReceiverTBD() public {
        vm.expectRevert(bytes("V3: receiver TBD"));
        new Hero(uint32(block.timestamp), address(0), R_DON, R_STK);
    }

    function test_RevertWhen_DonationReceiverTBD() public {
        vm.expectRevert(bytes("V3: receiver TBD"));
        new Hero(uint32(block.timestamp), R_LP, address(0), R_STK);
    }

    function test_RevertWhen_StakeReceiverTBD() public {
        vm.expectRevert(bytes("V3: receiver TBD"));
        new Hero(uint32(block.timestamp), R_LP, R_DON, address(0));
    }

    function test_ConstructorState() public view {
        assertEq(hero.totalSupply(), 100_000_000e18, "supply");
        assertEq(hero.balanceOf(address(this)), 100_000_000e18, "deployer holds supply");
        assertEq(hero.owner(), address(this), "owner = deployer until handoff");
        assertEq(hero.autoLiquidityReceiver(), R_LP, "lp receiver");
        assertEq(hero.donationReceiver(), R_DON, "donation receiver");
        assertEq(hero.stakeRewardsReceiver(), R_STK, "stake receiver");
        assertTrue(hero.isPair(hero.pulseV2Pair()), "pair registered");
        HeroBuyAndBurn bb = hero.buyAndBurn();
        assertEq(bb.owner(), address(this), "B&B owner = deployer until handoff");
        assertEq(bb.HERO(), address(hero), "B&B wired to HERO");
    }

    function test_OwnershipHandoffToSafe() public {
        hero.transferOwnership(SAFE);
        hero.buyAndBurn().transferOwnership(SAFE);
        assertEq(hero.owner(), SAFE, "HERO owner = Safe");
        assertEq(hero.buyAndBurn().owner(), SAFE, "B&B owner = Safe");
        vm.expectRevert(bytes("Ownable: caller is not the owner"));
        hero.setDonationReceiver(R_LP);
        vm.prank(SAFE);
        hero.setDonationReceiver(R_LP);
        assertEq(hero.donationReceiver(), R_LP, "safe can admin");
    }

    function test_RevertWhen_StrangerAdmins() public {
        vm.prank(vm.addr(99));
        vm.expectRevert(bytes("Ownable: caller is not the owner"));
        hero.launch();
    }

    function test_RevertWhen_SetReceiverZero() public {
        vm.expectRevert(bytes("Zero address"));
        hero.setDonationReceiver(address(0));
    }
}
