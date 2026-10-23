// SPDX-License-Identifier: MIT
// HERO V3 unit tests (HeroABLE, PulseChain). Owner: VETS (jratdish1). Local only.
pragma solidity 0.8.27;

import {MiniTest} from "./utils/MiniTest.sol";
import {MockToken} from "./mocks/MockUniV2.sol";
import {HeroABLE} from "../src/pulsechain/HeroABLE.sol";

contract HeroABLEPlsV3Test is MiniTest {
    function test_RevertWhen_HeroTokenTBD() public {
        vm.expectRevert(bytes("V3: heroToken TBD"));
        new HeroABLE(address(0));
    }

    function test_ConstructorState() public {
        MockToken t = new MockToken();
        HeroABLE a = new HeroABLE(address(t));
        assertEq(a.heroToken(), address(t), "hero token");
        assertEq(a.rewardsAddress(), address(t), "rewards = hero token");
        assertEq(a.owner(), address(this), "owner = deployer until handoff");
        a.transferOwnership(vm.addr(1));
        assertEq(a.owner(), vm.addr(1), "owner = Safe placeholder");
    }
}
