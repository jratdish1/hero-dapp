// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {TimelockController} from "@openzeppelin/contracts/governance/TimelockController.sol";

/**
 * @title  HeroTimelock (BUILD 2)
 * @notice Executes passed HeroGovernor proposals after a fixed delay.
 *
 *         Roles are fixed in the constructor. There is NO external admin and no
 *         grant/renounce step to forget:
 *           PROPOSER  = HeroGovernor only (it also receives CANCELLER from OZ).
 *           CANCELLER = HeroGovernor + guardian multisig (veto a queued op only).
 *           EXECUTOR  = anyone (address(0)) once the delay has passed.
 *           ADMIN     = this timelock itself. Role changes need a passed proposal.
 *
 *         The guardian multisig cannot propose, schedule, execute, or move funds.
 *         It can only cancel a queued operation during the delay.
 *
 *         Deploy order: predict the HeroGovernor address (deployer nonce + 1),
 *         deploy this timelock with it, then deploy HeroGovernor. If the
 *         prediction is wrong the timelock has no live proposer and is inert:
 *         discard and redeploy. It fails safe.
 */
contract HeroTimelock is TimelockController {
    error ZeroAddress();
    error DelayOutOfRange(uint256 minDelay);

    uint256 public constant MIN_DELAY_FLOOR = 1 hours;
    uint256 public constant MIN_DELAY_CEILING = 30 days;

    constructor(uint256 minDelay, address governor, address guardianMultisig)
        TimelockController(minDelay, _single(governor), _single(address(0)), address(0))
    {
        if (governor == address(0) || guardianMultisig == address(0)) revert ZeroAddress();
        if (minDelay < MIN_DELAY_FLOOR || minDelay > MIN_DELAY_CEILING) revert DelayOutOfRange(minDelay);
        _grantRole(CANCELLER_ROLE, guardianMultisig);
    }

    function _single(address a) private pure returns (address[] memory arr) {
        arr = new address[](1);
        arr[0] = a;
    }
}
