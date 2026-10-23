// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/* === OZ === */
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/* === UNISWAP V2 === */
import {IUniswapV2Router02} from "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";


/**
 * @title HeroBuyAndBurn Contract
 * @author BuildTheTech.com
 * @notice This contract receives ETH from a charging contract, and at regular intervals,
 * uses an allocated portion of the ETH to buy HERO tokens and immediately burn them.
 * The process is triggered by any external user, who receives an incentive for doing so.
 */
contract HeroBuyAndBurn is ReentrancyGuard, Ownable {
    
    /* ================================================================
                         STATE VARIABLES & CONSTANTS
    ================================================================ */  
    // --- Interval Mechanics ---
    struct Interval {
        uint256 amountAllocated;
        uint256 amountProcessed;
    }
    uint256 public startTimeStamp;
    uint256 public lastBurnIntervalNumber;
    uint256 public lastBurnIntervalStartTimestamp;
    mapping(uint256 => Interval) public ethIntervalsBurn;

    // --- Constants & Immutable ---
    IUniswapV2Router02 public immutable uniswapRouter = IUniswapV2Router02(0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24);

    address public immutable WETH;
    address public immutable HERO;
    address private constant DEAD = 0x000000000000000000000000000000000000dEaD;
    
    uint256 public constant incentiveFeeBps = 150;
    uint256 public constant intervalTime = 30 minutes;

    // --- Configurable Settings ---
    uint256 public dailyAllocationBps;

    // --- Balances and Totals ---
    uint256 public totalEthForBurning;
    uint256 public totalHeroBurned;

    /* ================================================================
                                     EVENTS
    ================================================================ */

    event EthReceived(address indexed from, uint256 amount);
    event BuyAndBurn(
        uint256 ethUsedForSwap,
        uint256 heroBurned,
        uint256 incentivePaid,
        address indexed caller
    );
    event SettingsUpdated(string setting, uint256 newValue);


    /* ================================================================
                                     ERRORS
    ================================================================ */

    error NotStartedYet();
    error IntervalAlreadyProcessed();
    error InvalidSetting();
    error NoAllocationAvailable();
    error InvalidInput();
    error SwapFailed();

    /* ================================================================
                                   MODIFIERS
    ================================================================ */

    modifier intervalUpdate() {
        _syncTotalEthForBurning();
        _intervalUpdateEthForBurning();
        _;
    }

    /* ================================================================
                                  CONSTRUCTOR
    ================================================================ */

    constructor(
        address _initialOwner,
        uint32 _startTimestamp,
        address _heroAddress,
        address _wethAddress
    ) Ownable() {
        require(_heroAddress != address(0) && _wethAddress != address(0), "Invalid token address");

        startTimeStamp = _startTimestamp;
        HERO = _heroAddress;
        WETH = _wethAddress;

        dailyAllocationBps = 100;
        lastBurnIntervalStartTimestamp = _startTimestamp;

        _transferOwnership(_initialOwner);
    }


    /* ================================================================
                                 CORE LOGIC
    ================================================================ */

    receive() external payable {
        _syncTotalEthForBurning();
        emit EthReceived(msg.sender, msg.value);
    }

    function distributeETHForBurning() external payable {
        if (msg.value == 0) revert InvalidInput();

        _syncTotalEthForBurning();
        emit EthReceived(msg.sender, msg.value);
    }

    function buyAndBurn(uint256 _deadline) external nonReentrant intervalUpdate {
        Interval storage currentInterval = ethIntervalsBurn[lastBurnIntervalNumber];
        if (currentInterval.amountProcessed != 0) revert IntervalAlreadyProcessed();

        uint256 ethToProcess = currentInterval.amountAllocated;
        if (ethToProcess == 0) revert NoAllocationAvailable();
    
        currentInterval.amountProcessed = currentInterval.amountAllocated;

        uint256 incentiveAmount = (ethToProcess * incentiveFeeBps) / 10_000;
        uint256 ethToSwap = ethToProcess - incentiveAmount;

        uint256 heroBought = _swapEthForHero(ethToSwap, _deadline);
        if (heroBought == 0) revert SwapFailed();
        _burnHero(heroBought);

        totalEthForBurning -= ethToProcess;
        totalHeroBurned += heroBought;

        if (incentiveAmount > 0) {
            (bool success, ) = msg.sender.call{value: incentiveAmount}("");
            require(success, "Incentive payment failed");
        }

        emit BuyAndBurn(ethToSwap, heroBought, incentiveAmount, msg.sender);
    }
    
    /* ================================================================
                              INTERNAL FUNCTIONS
    ================================================================ */

    function _intervalUpdateEthForBurning() internal {
        if (block.timestamp < startTimeStamp) revert NotStartedYet();

        uint256 timeElapsed = block.timestamp - lastBurnIntervalStartTimestamp;
        if (timeElapsed < intervalTime) return;

        uint256 intervals_per_day = (24 hours) / intervalTime;
        
        uint256 missedIntervals = (timeElapsed / intervalTime) - 1;

        uint256 dailyAllocation = (totalEthForBurning * dailyAllocationBps) / 10_000;
        uint256 amountPerInterval = dailyAllocation / intervals_per_day;
        
        uint256 totalAmountForInterval = amountPerInterval * (missedIntervals + 1);

        if (totalAmountForInterval > totalEthForBurning) {
            totalAmountForInterval = uint256(totalEthForBurning);
        }

        uint256 newIntervalNumber = lastBurnIntervalNumber + missedIntervals + 1;
        
        ethIntervalsBurn[newIntervalNumber] = Interval({
            amountAllocated: totalAmountForInterval,
            amountProcessed: 0
        });

        lastBurnIntervalNumber = newIntervalNumber;
        lastBurnIntervalStartTimestamp = lastBurnIntervalStartTimestamp + ((missedIntervals + 1) * uint32(intervalTime));
    }

    function _syncTotalEthForBurning() internal {
        totalEthForBurning = address(this).balance;
    }

    function _swapEthForHero(uint256 _ethAmount, uint256 _deadline) internal returns (uint256) {
        if (_ethAmount == 0) return 0;

        address[] memory path = new address[](2);
        path[0] = WETH;
        path[1] = HERO;

        uint256 balanceBefore = IERC20(HERO).balanceOf(address(this));
        uniswapRouter.swapExactETHForTokensSupportingFeeOnTransferTokens{value: _ethAmount}(
            0,
            path,
            address(this),
            _deadline
        );
        uint256 balanceAfter = IERC20(HERO).balanceOf(address(this));
        return balanceAfter - balanceBefore;
    }

    function _burnHero(uint256 _heroAmount) internal {
        IERC20(HERO).transfer(DEAD, _heroAmount);
    }
    
    /* ================================================================
                             OWNER FUNCTIONS
    ================================================================ */
    
    function setDailyAllocationBps(uint256 _newAllocationBps) external onlyOwner {
        if (_newAllocationBps > 2_500) revert InvalidSetting();
        dailyAllocationBps = _newAllocationBps;
        emit SettingsUpdated("DailyAllocationBps", _newAllocationBps);
    }

    function withdrawTokens(address _token, address _to) external onlyOwner {
        uint256 balance = IERC20(_token).balanceOf(address(this));
        require(balance > 0, "No tokens to withdraw");
        IERC20(_token).transfer(_to, balance);
    }
}