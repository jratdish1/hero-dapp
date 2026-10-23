// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

struct Route {
    address from;
    address to;
    bool stable;
    address factory;
}

interface IAerodromeRouter {
    function getAmountsOut(uint256 amountIn, Route[] calldata routes) external view returns (uint256[] memory amounts);

    function swapExactTokensForTokensSupportingFeeOnTransferTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        Route[] calldata routes,
        address to,
        uint256 deadline
    ) external;

    function swapExactTokensForETHSupportingFeeOnTransferTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        Route[] calldata routes,
        address to,
        uint256 deadline
    ) external;

    function addLiquidity(
        address tokenA,
        address tokenB,
        bool stable,
        uint256 amountADesired,
        uint256 amountBDesired,
        uint256 amountAMin,
        uint256 amountBMin,
        address to,
        uint256 deadline
    ) external returns (uint amountA, uint amountB, uint liquidity);
}

interface IAerodromePair {
    function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast);
}


// ---------------------------------------------------------------------------
// HERO V3 (Base). Owner: VETS (jratdish1).
// Recovered from verified source of the old HeroABLE arb executor (0xaE55…5423, Sourcify exact match).
// V3 changes (see contracts/v3/PROVENANCE.md): compiler pragma pinned, and every
// old hardcoded wallet/token address replaced by a constructor argument that must be
// non-zero (fail closed). Ownership is transferred to the chain's Owner Safe by the
// deploy script. NOT AUDITED FOR V3. DO NOT DEPLOY without Tier B approval.
// ---------------------------------------------------------------------------
contract HeroABLE is Ownable {
    struct Pair {
        address tokenA;
        address tokenB;
        bool stable;
        address router;
        address pairAddress;
        uint256 heroForLp;
        uint256 totalHeroLpAdded;
    }

    Pair[] public pairs;

    uint256 public heroGained;
    address public rewardsAddress;
    address public burnAddress = 0x0000000000000000000000000000000000000000;
    address public heroToken;
    IERC20 public weth = IERC20(0x4200000000000000000000000000000000000006);
    uint256 public lpAddThreshold = 10000e18;
    uint256 public distributeThreshold = 10000e18;
    uint256 public minGain = 100e18;
    bool public targetedLpMode = false;
    address[] public targetLpPairs;

    uint256 public rewardsPercent = 50;
    uint256 public burnPercent = 0;
    uint256 public lpPercent = 0;
    uint256 public gasCompPercent = 50;

    address private signer;

    uint256 public totalHeroBurn;
    uint256 public totalHeroReward;
    uint256 public totalHeroLp;
    uint256 public totalHeroGasComp;
    uint256 public pendingGainsDistribution;

    IAerodromeRouter public aerodromeRouter = IAerodromeRouter(0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43);
    address public aerodromeFactory = 0x420DD381b31aEf6683db6B902084cB0FFECe40Da;

    modifier onlySigner() {
        require(msg.sender == signer, "Not signer");
        _;
    }

    constructor(address _heroToken) Ownable(msg.sender) {
        // V3: HERO V3 token is a deploy-time input; zero (= TBD) fails closed.
        require(_heroToken != address(0), "V3: heroToken TBD");
        heroToken = _heroToken;
        signer = msg.sender;
        rewardsAddress = address(heroToken);
        // aerodromeFactory = aerodromeRouter.factory();

        IERC20(heroToken).approve(address(aerodromeRouter), type(uint256).max);
    }

    function addPair(
        address tokenA, 
        address tokenB, 
        bool stable,
        address router, 
        address pairAddress
    ) external onlyOwner {
        require(tokenA != address(0) && tokenB != address(0), "Invalid token addresses");
        require(router != address(0), "Invalid router address");
        require(pairAddress != address(0), "Invalid pair address");

        require(
            router == address(aerodromeRouter),
            "Router not supported"
        );

        IERC20(tokenA).approve(address(aerodromeRouter), type(uint256).max);
        IERC20(tokenB).approve(address(aerodromeRouter), type(uint256).max);

        pairs.push(Pair(tokenA, tokenB, stable, router, pairAddress, 0, 0));

        emit PairAdded(tokenA, tokenB, stable, router, pairAddress);
    }

    function getPairs() external view returns (Pair[] memory) {
        uint256 pairCount = pairs.length;
        Pair[] memory result = new Pair[](pairCount);

        for (uint256 i = 0; i < pairCount; i++) {
            result[i] = pairs[i];
        }

        return result;
    }

    function getLpAddedForPair(address pairAddress) public view returns (uint256) {
        require(pairAddress != address(0), "Invalid pair address");

        for (uint256 i = 0; i < pairs.length; i++) {
            if (pairs[i].pairAddress == pairAddress) {
                return pairs[i].totalHeroLpAdded;
            }
        }

        revert("Pair not found");
    }

    function setRewardsAddress(address _rewardsAddress) external onlyOwner {
        rewardsAddress = _rewardsAddress;
    }

    function setLpAddThreshold(uint256 _newThreshold) external onlyOwner {
        lpAddThreshold = _newThreshold;
    }

    function setTargetLpPairs(address[] calldata lpPairs, bool enabled) external onlyOwner {
        require(lpPairs.length <= 4, "Cannot set more than 4 LP target pairs");
        for (uint256 i = 0; i < lpPairs.length; i++) {
            require(lpPairs[i] != address(0), "Invalid LP target address");
        }
        targetLpPairs = lpPairs;
        targetedLpMode = enabled;

        if (targetedLpMode == true) {
            require(lpPairs.length > 0, "Cannot set more than 4 LP target pairs");
        }
    }

    function setMinGain(uint256 _newMinGain) external onlyOwner {
        minGain = _newMinGain;
    }

    function setSigner(address _signer) external onlyOwner {
        signer = _signer;
    }

    function setDistributionSettings(
        uint256 _rewardsPercent,
        uint256 _burnPercent,
        uint256 _lpPercent,
        uint256 _gasCompPercent,
        uint256 _distributeThreshold
    ) external onlyOwner {
        rewardsPercent = _rewardsPercent;
        burnPercent = _burnPercent;
        lpPercent = _lpPercent;
        gasCompPercent = _gasCompPercent;
        distributeThreshold = _distributeThreshold;
        require(rewardsPercent + burnPercent + lpPercent + gasCompPercent == 100, "Invalid percentages");
        require(gasCompPercent <= 50, "Max 50 percent allowed to gas compensation.");
    }

    function multiSwap(
        Route[][] memory swapPaths,
        uint amountIn,
        uint[] memory minAmountsOut
    ) external onlySigner {
        require(swapPaths.length == minAmountsOut.length, "Paths and minAmountsOut mismatch");
        require(swapPaths.length > 1, "At least two swaps required");

        uint256 currentAmount = amountIn;
        uint256[] memory amountsOut = new uint256[](swapPaths.length);

        for (uint256 i = 0; i < swapPaths.length; i++) {
            require(swapPaths[i].length >= 1, "Invalid path length");

            uint256 bestAmountOut = 0;
            
            try aerodromeRouter.getAmountsOut(currentAmount, swapPaths[i]) returns (uint[] memory amounts) {
                bestAmountOut = amounts[amounts.length - 1];
            } catch {
                revert("Get amounts out failed");
            }

            amountsOut[i] = bestAmountOut;
            currentAmount = bestAmountOut;
        }

        require(amountsOut[swapPaths.length - 1] >= amountIn + minGain, "Must gain hero overall.");

        currentAmount = amountIn;
        for (uint256 i = 0; i < swapPaths.length; i++) {
            address tokenOut = swapPaths[i][swapPaths[i].length - 1].to;
            uint256 tokenBalanceBefore = IERC20(tokenOut).balanceOf(address(this));

            aerodromeRouter.swapExactTokensForTokensSupportingFeeOnTransferTokens(
                currentAmount,
                minAmountsOut[i],
                swapPaths[i],
                address(this),
                block.timestamp
            );

            uint256 tokenBalanceAfter = IERC20(tokenOut).balanceOf(address(this));
            currentAmount = tokenBalanceAfter - tokenBalanceBefore;
        }
        uint256 finalGain = currentAmount > amountIn ? currentAmount - amountIn : 0;
        heroGained += finalGain;

        _handleLpContributionAndDistribution(finalGain, swapPaths);
    }

    function _handleLpContributionAndDistribution(uint256 finalGain, Route[][] memory swapPaths) private {
        uint256 lpContribution;

        if (lpPercent > 0) {
            lpContribution = (finalGain * lpPercent) / 100;
            totalHeroLp += lpContribution;

            if (targetedLpMode && targetLpPairs.length > 0) {
                uint256 lpPerTarget = lpContribution / targetLpPairs.length;
                for (uint256 i = 0; i < targetLpPairs.length; i++) {
                    bool targetFound = false;
                    for (uint256 j = 0; j < pairs.length; j++) {
                        if (pairs[j].pairAddress == targetLpPairs[i]) {
                            pairs[j].heroForLp += lpPerTarget;
                            if (pairs[j].heroForLp >= lpAddThreshold) {
                                _addLiquidity(pairs[j]);
                            }
                            targetFound = true;
                            break;
                        }
                    }
                    require(targetFound, "Target LP pair not found in pairs array");
                }
            } else {
                Route[] memory lastPath = swapPaths[swapPaths.length - 1];
                Route memory lastRoute = lastPath[lastPath.length - 1];
                address finalTokenA = lastRoute.from;
                address finalTokenB = lastRoute.to;

                for (uint256 i = 0; i < pairs.length; i++) {
                    if (
                        (pairs[i].tokenA == finalTokenA && pairs[i].tokenB == finalTokenB) ||
                        (pairs[i].tokenA == finalTokenB && pairs[i].tokenB == finalTokenA)
                    ) {
                        pairs[i].heroForLp += lpContribution;
                        if (pairs[i].heroForLp >= lpAddThreshold) {
                            _addLiquidity(pairs[i]);
                        }
                        break;
                    }
                }
            }
        }

        pendingGainsDistribution += (finalGain - lpContribution);
        if (pendingGainsDistribution >= distributeThreshold) {
            _distributeGains();
        }
    }

    function _distributeGains() internal {
        uint256 rewardsAmount = (pendingGainsDistribution * rewardsPercent) / (100 - lpPercent);
        uint256 burnAmount = (pendingGainsDistribution * burnPercent) / (100 - lpPercent);
        uint256 gasCompAmount = (pendingGainsDistribution * gasCompPercent) / (100 - lpPercent);

        if (rewardsAmount > 0) {
            IERC20(heroToken).transfer(rewardsAddress, rewardsAmount);
            totalHeroReward += rewardsAmount;
        }

        if (burnAmount > 0) {
            IERC20(heroToken).transfer(burnAddress, burnAmount);
            totalHeroBurn += burnAmount;
        }

        if (gasCompAmount > 0) { 
            Route[] memory path = new Route[](1);
            path[0] = Route({
                from: address(heroToken),
                to: address(weth),
                stable: false,
                factory: aerodromeFactory
            });

            aerodromeRouter.swapExactTokensForETHSupportingFeeOnTransferTokens(
                gasCompAmount,
                0,
                path,
                signer,
                block.timestamp
            );
            
            totalHeroGasComp += gasCompAmount;
        }

        pendingGainsDistribution = 0;
    }

    function _addLiquidity(Pair storage pair) internal {
        uint256 heroAmount = pair.heroForLp;
        pair.heroForLp = 0;
        pair.totalHeroLpAdded += heroAmount;

        address tokenA = pair.tokenA;
        address tokenB = pair.tokenB;

        (, address otherToken) = tokenA == heroToken
            ? (tokenA, tokenB)
            : (tokenB, tokenA);

        uint256 heroBalance = IERC20(heroToken).balanceOf(address(this));

        if (heroAmount > 0 && heroBalance >= heroAmount) {
            uint256 halfHeroAmount = heroAmount / 2;

            Route[] memory path = new Route[](1);
            path[0] = Route({
                from: address(heroToken),
                to: otherToken,
                stable: pair.stable,
                factory: aerodromeFactory
            });

            uint256 initialOtherBalance = IERC20(otherToken).balanceOf(address(this));

            aerodromeRouter.swapExactTokensForTokensSupportingFeeOnTransferTokens(
                halfHeroAmount,
                0,
                path,
                address(this),
                block.timestamp
            );

            uint256 swappedOtherBalance = IERC20(otherToken).balanceOf(address(this)) - initialOtherBalance;

            (uint256 amountA, uint256 amountB, ) = aerodromeRouter.addLiquidity(
                heroToken,
                otherToken,
                pair.stable,
                halfHeroAmount,
                swappedOtherBalance,
                0,
                0,
                owner(),
                block.timestamp
            );

            if (halfHeroAmount > amountA) {
                uint256 excessHero = halfHeroAmount - amountA;
                pair.heroForLp += excessHero;
            }

            if (swappedOtherBalance > amountB) {
                uint256 excessOtherToken = swappedOtherBalance - amountB;
                IERC20(otherToken).transfer(owner(), excessOtherToken);
            }
        }
    }

    function withdrawToken(address tokenAddress, uint256 amount) external onlyOwner {
        IERC20(tokenAddress).transfer(owner(), amount);
    }

    function withdrawETH(uint256 amount) external onlyOwner {
        payable(owner()).transfer(amount);
    }

    function getTargetLpPairs() external view returns (address[] memory) {
        return targetLpPairs;
    }

    function getReservesForPairs(address[] memory pairAddresses)
        external
        view
        returns (uint256[] memory reserve0s, uint256[] memory reserve1s)
    {
        uint256 pairCount = pairAddresses.length;
        reserve0s = new uint256[](pairCount);
        reserve1s = new uint256[](pairCount);

        for (uint256 i = 0; i < pairCount; i++) {
            address pairAddress = pairAddresses[i];
            require(pairAddress != address(0), "Invalid pair address");

            try IAerodromePair(pairAddress).getReserves() returns (
                uint112 _reserve0,
                uint112 _reserve1,
                uint32
            ) {
                reserve0s[i] = _reserve0;
                reserve1s[i] = _reserve1;
            } catch {
                reserve0s[i] = 0;
                reserve1s[i] = 0;
            }
        }
    }

    receive() external payable {}

    event PairAdded(address tokenA, address tokenB, bool stable, address router, address pairAddress);
}