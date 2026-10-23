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
 * @notice This contract receives PLS from a charging contract, and at regular intervals,
 * uses an allocated portion of the PLS to buy HERO tokens and immediately burn them.
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
    mapping(uint256 => Interval) public plsIntervalsBurn;

    // --- Constants & Immutable ---
    IUniswapV2Router02 public immutable pulseXRouterV1 = IUniswapV2Router02(0x98bf93ebf5c380C0e6Ae8e192A7e2AE08edAcc02);
    IUniswapV2Router02 public immutable pulseXRouterV2 = IUniswapV2Router02(0x165C3410fC91EF562C50559f7d2289fEbed552d9);
    IUniswapV2Router02 public immutable nineinchRouter = IUniswapV2Router02(0xeB45a3c4aedd0F47F345fB4c8A1802BB5740d725);

    address public immutable WPLS;
    address public immutable HERO;
    address private constant DEAD = 0x000000000000000000000000000000000000dEaD;
    
    uint256 public constant incentiveFeeBps = 150;
    uint256 public constant intervalTime = 30 minutes;

    // --- Configurable Settings ---
    uint256 public dailyAllocationBps;

    // --- Balances and Totals ---
    uint256 public totalPlsForBurning;
    uint256 public totalHeroBurned;

    /* ================================================================
                                     EVENTS
    ================================================================ */

    event PlsReceived(address indexed from, uint256 amount);
    event BuyAndBurn(
        uint256 plsUsedForSwap,
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
        _syncTotalPlsForBurning();
        _intervalUpdatePlsForBurning();
        _;
    }

    /* ================================================================
                                  CONSTRUCTOR
    ================================================================ */

    constructor(
        address _initialOwner,
        uint32 _startTimestamp,
        address _heroAddress,
        address _wplsAddress
    ) Ownable() {
        require(_heroAddress != address(0) && _wplsAddress != address(0), "Invalid token address");

        startTimeStamp = _startTimestamp;
        HERO = _heroAddress;
        WPLS = _wplsAddress;

        dailyAllocationBps = 100;
        lastBurnIntervalStartTimestamp = _startTimestamp;

        _transferOwnership(_initialOwner);
    }


    /* ================================================================
                                 CORE LOGIC
    ================================================================ */

    receive() external payable {
        _syncTotalPlsForBurning();
        emit PlsReceived(msg.sender, msg.value);
    }

    function distributePLSForBurning() external payable {
        if (msg.value == 0) revert InvalidInput();

        _syncTotalPlsForBurning();
        emit PlsReceived(msg.sender, msg.value);
    }

    function buyAndBurn(uint256 _deadline) external nonReentrant intervalUpdate {
        Interval storage currentInterval = plsIntervalsBurn[lastBurnIntervalNumber];
        if (currentInterval.amountProcessed != 0) revert IntervalAlreadyProcessed();

        uint256 plsToProcess = currentInterval.amountAllocated;
        if (plsToProcess == 0) revert NoAllocationAvailable();
    
        currentInterval.amountProcessed = currentInterval.amountAllocated;

        uint256 incentiveAmount = (plsToProcess * incentiveFeeBps) / 10_000;
        uint256 plsToSwap = plsToProcess - incentiveAmount;

        uint256 heroBought = _swapPlsForHero(plsToSwap, _deadline);
        if (heroBought == 0) revert SwapFailed();
        _burnHero(heroBought);

        totalPlsForBurning -= plsToProcess;
        totalHeroBurned += heroBought;

        if (incentiveAmount > 0) {
            (bool success, ) = msg.sender.call{value: incentiveAmount}("");
            require(success, "Incentive payment failed");
        }

        emit BuyAndBurn(plsToSwap, heroBought, incentiveAmount, msg.sender);
    }
    
    /* ================================================================
                              INTERNAL FUNCTIONS
    ================================================================ */

    function _intervalUpdatePlsForBurning() internal {
        if (block.timestamp < startTimeStamp) revert NotStartedYet();

        uint256 timeElapsed = block.timestamp - lastBurnIntervalStartTimestamp;
        if (timeElapsed < intervalTime) return;

        uint256 intervals_per_day = (24 hours) / intervalTime;
        
        uint256 missedIntervals = (timeElapsed / intervalTime) - 1;

        uint256 dailyAllocation = (totalPlsForBurning * dailyAllocationBps) / 10_000;
        uint256 amountPerInterval = dailyAllocation / intervals_per_day;
        
        uint256 totalAmountForInterval = amountPerInterval * (missedIntervals + 1);

        if (totalAmountForInterval > totalPlsForBurning) {
            totalAmountForInterval = uint256(totalPlsForBurning);
        }

        uint256 newIntervalNumber = lastBurnIntervalNumber + missedIntervals + 1;
        
        plsIntervalsBurn[newIntervalNumber] = Interval({
            amountAllocated: totalAmountForInterval,
            amountProcessed: 0
        });

        lastBurnIntervalNumber = newIntervalNumber;
        lastBurnIntervalStartTimestamp = lastBurnIntervalStartTimestamp + ((missedIntervals + 1) * uint32(intervalTime));
    }

    function _syncTotalPlsForBurning() internal {
        totalPlsForBurning = address(this).balance;
    }

    function _swapPlsForHero(uint256 _plsAmount, uint256 _deadline) internal returns (uint256) {
        if (_plsAmount == 0) return 0;

        address[] memory path = new address[](2);
        path[0] = WPLS;
        path[1] = HERO;

        address bestRouter = getBestRouter(_plsAmount, path);
        if (bestRouter == address(0)) revert SwapFailed();

        uint256 balanceBefore = IERC20(HERO).balanceOf(address(this));
        IUniswapV2Router02(bestRouter).swapExactETHForTokensSupportingFeeOnTransferTokens{value: _plsAmount}(
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

    /* ================================================================
                                VIEW FUNCTIONS
    ================================================================ */

    function getBestRouter(
        uint256 amountIn,
        address[] memory path
    ) public view returns (address bestRouter) {
        address[] memory routers = new address[](3);
        routers[0] = address(pulseXRouterV1);
        routers[1] = address(pulseXRouterV2);
        routers[2] = address(nineinchRouter);

        uint256 bestAmountOut = 0;

        for (uint256 i = 0; i < routers.length; i++) {
            try
                IUniswapV2Router02(routers[i]).getAmountsOut(amountIn, path)
            returns (uint256[] memory amountsOut) {
                uint256 amountOut = amountsOut[amountsOut.length - 1];
                if (amountOut > bestAmountOut) {
                    bestAmountOut = amountOut;
                    bestRouter = routers[i];
                }
            } catch {
                continue;
            }
        }
    }
}