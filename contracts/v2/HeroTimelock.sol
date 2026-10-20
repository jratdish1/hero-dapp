// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import "@openzeppelin/contracts/governance/TimelockController.sol";

/**
 * @title HeroTimelock
 * @notice Unmodified OpenZeppelin TimelockController, named for deployment and
 *         explorer verification. Holds ownership of HERO protocol contracts
 *         (e.g. HeroSingleSidedStaking) and executes only what HeroGovernor passes,
 *         after `minDelay`. Role setup: docs/governance.md.
 *
 *   NOT DEPLOYED. Deployment requires Codex Grade A at exact SHA and VETS GO.
 */
contract HeroTimelock is TimelockController {
    constructor(uint256 minDelay, address[] memory proposers, address[] memory executors, address admin)
        TimelockController(minDelay, proposers, executors, admin)
    {}
}
