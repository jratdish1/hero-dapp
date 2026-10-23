// SPDX-License-Identifier: MIT
// File: @uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router01.sol

pragma solidity >=0.6.2;

interface IUniswapV2Router01 {
    function factory() external pure returns (address);
    function WETH() external pure returns (address);

    function addLiquidity(
        address tokenA,
        address tokenB,
        uint amountADesired,
        uint amountBDesired,
        uint amountAMin,
        uint amountBMin,
        address to,
        uint deadline
    ) external returns (uint amountA, uint amountB, uint liquidity);
    function addLiquidityETH(
        address token,
        uint amountTokenDesired,
        uint amountTokenMin,
        uint amountETHMin,
        address to,
        uint deadline
    ) external payable returns (uint amountToken, uint amountETH, uint liquidity);
    function removeLiquidity(
        address tokenA,
        address tokenB,
        uint liquidity,
        uint amountAMin,
        uint amountBMin,
        address to,
        uint deadline
    ) external returns (uint amountA, uint amountB);
    function removeLiquidityETH(
        address token,
        uint liquidity,
        uint amountTokenMin,
        uint amountETHMin,
        address to,
        uint deadline
    ) external returns (uint amountToken, uint amountETH);
    function removeLiquidityWithPermit(
        address tokenA,
        address tokenB,
        uint liquidity,
        uint amountAMin,
        uint amountBMin,
        address to,
        uint deadline,
        bool approveMax, uint8 v, bytes32 r, bytes32 s
    ) external returns (uint amountA, uint amountB);
    function removeLiquidityETHWithPermit(
        address token,
        uint liquidity,
        uint amountTokenMin,
        uint amountETHMin,
        address to,
        uint deadline,
        bool approveMax, uint8 v, bytes32 r, bytes32 s
    ) external returns (uint amountToken, uint amountETH);
    function swapExactTokensForTokens(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external returns (uint[] memory amounts);
    function swapTokensForExactTokens(
        uint amountOut,
        uint amountInMax,
        address[] calldata path,
        address to,
        uint deadline
    ) external returns (uint[] memory amounts);
    function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline)
        external
        payable
        returns (uint[] memory amounts);
    function swapTokensForExactETH(uint amountOut, uint amountInMax, address[] calldata path, address to, uint deadline)
        external
        returns (uint[] memory amounts);
    function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline)
        external
        returns (uint[] memory amounts);
    function swapETHForExactTokens(uint amountOut, address[] calldata path, address to, uint deadline)
        external
        payable
        returns (uint[] memory amounts);

    function quote(uint amountA, uint reserveA, uint reserveB) external pure returns (uint amountB);
    function getAmountOut(uint amountIn, uint reserveIn, uint reserveOut) external pure returns (uint amountOut);
    function getAmountIn(uint amountOut, uint reserveIn, uint reserveOut) external pure returns (uint amountIn);
    function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts);
    function getAmountsIn(uint amountOut, address[] calldata path) external view returns (uint[] memory amounts);
}

// File: @uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol

pragma solidity >=0.6.2;


interface IUniswapV2Router02 is IUniswapV2Router01 {
    function removeLiquidityETHSupportingFeeOnTransferTokens(
        address token,
        uint liquidity,
        uint amountTokenMin,
        uint amountETHMin,
        address to,
        uint deadline
    ) external returns (uint amountETH);
    function removeLiquidityETHWithPermitSupportingFeeOnTransferTokens(
        address token,
        uint liquidity,
        uint amountTokenMin,
        uint amountETHMin,
        address to,
        uint deadline,
        bool approveMax, uint8 v, bytes32 r, bytes32 s
    ) external returns (uint amountETH);

    function swapExactTokensForTokensSupportingFeeOnTransferTokens(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external;
    function swapExactETHForTokensSupportingFeeOnTransferTokens(
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external payable;
    function swapExactTokensForETHSupportingFeeOnTransferTokens(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external;
}

// File: @uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol

pragma solidity >=0.5.0;

interface IUniswapV2Pair {
    event Approval(address indexed owner, address indexed spender, uint value);
    event Transfer(address indexed from, address indexed to, uint value);

    function name() external pure returns (string memory);
    function symbol() external pure returns (string memory);
    function decimals() external pure returns (uint8);
    function totalSupply() external view returns (uint);
    function balanceOf(address owner) external view returns (uint);
    function allowance(address owner, address spender) external view returns (uint);

    function approve(address spender, uint value) external returns (bool);
    function transfer(address to, uint value) external returns (bool);
    function transferFrom(address from, address to, uint value) external returns (bool);

    function DOMAIN_SEPARATOR() external view returns (bytes32);
    function PERMIT_TYPEHASH() external pure returns (bytes32);
    function nonces(address owner) external view returns (uint);

    function permit(address owner, address spender, uint value, uint deadline, uint8 v, bytes32 r, bytes32 s) external;

    event Mint(address indexed sender, uint amount0, uint amount1);
    event Burn(address indexed sender, uint amount0, uint amount1, address indexed to);
    event Swap(
        address indexed sender,
        uint amount0In,
        uint amount1In,
        uint amount0Out,
        uint amount1Out,
        address indexed to
    );
    event Sync(uint112 reserve0, uint112 reserve1);

    function MINIMUM_LIQUIDITY() external pure returns (uint);
    function factory() external view returns (address);
    function token0() external view returns (address);
    function token1() external view returns (address);
    function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast);
    function price0CumulativeLast() external view returns (uint);
    function price1CumulativeLast() external view returns (uint);
    function kLast() external view returns (uint);

    function mint(address to) external returns (uint liquidity);
    function burn(address to) external returns (uint amount0, uint amount1);
    function swap(uint amount0Out, uint amount1Out, address to, bytes calldata data) external;
    function skim(address to) external;
    function sync() external;

    function initialize(address, address) external;
}

// File: @openzeppelin/contracts/token/ERC20/IERC20.sol


// OpenZeppelin Contracts (last updated v4.9.0) (token/ERC20/IERC20.sol)

pragma solidity ^0.8.0;

/**
 * @dev Interface of the ERC20 standard as defined in the EIP.
 */
interface IERC20 {
    /**
     * @dev Emitted when `value` tokens are moved from one account (`from`) to
     * another (`to`).
     *
     * Note that `value` may be zero.
     */
    event Transfer(address indexed from, address indexed to, uint256 value);

    /**
     * @dev Emitted when the allowance of a `spender` for an `owner` is set by
     * a call to {approve}. `value` is the new allowance.
     */
    event Approval(address indexed owner, address indexed spender, uint256 value);

    /**
     * @dev Returns the amount of tokens in existence.
     */
    function totalSupply() external view returns (uint256);

    /**
     * @dev Returns the amount of tokens owned by `account`.
     */
    function balanceOf(address account) external view returns (uint256);

    /**
     * @dev Moves `amount` tokens from the caller's account to `to`.
     *
     * Returns a boolean value indicating whether the operation succeeded.
     *
     * Emits a {Transfer} event.
     */
    function transfer(address to, uint256 amount) external returns (bool);

    /**
     * @dev Returns the remaining number of tokens that `spender` will be
     * allowed to spend on behalf of `owner` through {transferFrom}. This is
     * zero by default.
     *
     * This value changes when {approve} or {transferFrom} are called.
     */
    function allowance(address owner, address spender) external view returns (uint256);

    /**
     * @dev Sets `amount` as the allowance of `spender` over the caller's tokens.
     *
     * Returns a boolean value indicating whether the operation succeeded.
     *
     * IMPORTANT: Beware that changing an allowance with this method brings the risk
     * that someone may use both the old and the new allowance by unfortunate
     * transaction ordering. One possible solution to mitigate this race
     * condition is to first reduce the spender's allowance to 0 and set the
     * desired value afterwards:
     * https://github.com/ethereum/EIPs/issues/20#issuecomment-263524729
     *
     * Emits an {Approval} event.
     */
    function approve(address spender, uint256 amount) external returns (bool);

    /**
     * @dev Moves `amount` tokens from `from` to `to` using the
     * allowance mechanism. `amount` is then deducted from the caller's
     * allowance.
     *
     * Returns a boolean value indicating whether the operation succeeded.
     *
     * Emits a {Transfer} event.
     */
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

// File: @openzeppelin/contracts/utils/Context.sol


// OpenZeppelin Contracts (last updated v4.9.4) (utils/Context.sol)

pragma solidity ^0.8.0;

/**
 * @dev Provides information about the current execution context, including the
 * sender of the transaction and its data. While these are generally available
 * via msg.sender and msg.data, they should not be accessed in such a direct
 * manner, since when dealing with meta-transactions the account sending and
 * paying for execution may not be the actual sender (as far as an application
 * is concerned).
 *
 * This contract is only required for intermediate, library-like contracts.
 */
abstract contract Context {
    function _msgSender() internal view virtual returns (address) {
        return msg.sender;
    }

    function _msgData() internal view virtual returns (bytes calldata) {
        return msg.data;
    }

    function _contextSuffixLength() internal view virtual returns (uint256) {
        return 0;
    }
}

// File: @openzeppelin/contracts/access/Ownable.sol


// OpenZeppelin Contracts (last updated v4.9.0) (access/Ownable.sol)

pragma solidity ^0.8.0;


/**
 * @dev Contract module which provides a basic access control mechanism, where
 * there is an account (an owner) that can be granted exclusive access to
 * specific functions.
 *
 * By default, the owner account will be the one that deploys the contract. This
 * can later be changed with {transferOwnership}.
 *
 * This module is used through inheritance. It will make available the modifier
 * `onlyOwner`, which can be applied to your functions to restrict their use to
 * the owner.
 */
abstract contract Ownable is Context {
    address private _owner;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    /**
     * @dev Initializes the contract setting the deployer as the initial owner.
     */
    constructor() {
        _transferOwnership(_msgSender());
    }

    /**
     * @dev Throws if called by any account other than the owner.
     */
    modifier onlyOwner() {
        _checkOwner();
        _;
    }

    /**
     * @dev Returns the address of the current owner.
     */
    function owner() public view virtual returns (address) {
        return _owner;
    }

    /**
     * @dev Throws if the sender is not the owner.
     */
    function _checkOwner() internal view virtual {
        require(owner() == _msgSender(), "Ownable: caller is not the owner");
    }

    /**
     * @dev Leaves the contract without owner. It will not be possible to call
     * `onlyOwner` functions. Can only be called by the current owner.
     *
     * NOTE: Renouncing ownership will leave the contract without an owner,
     * thereby disabling any functionality that is only available to the owner.
     */
    function renounceOwnership() public virtual onlyOwner {
        _transferOwnership(address(0));
    }

    /**
     * @dev Transfers ownership of the contract to a new account (`newOwner`).
     * Can only be called by the current owner.
     */
    function transferOwnership(address newOwner) public virtual onlyOwner {
        require(newOwner != address(0), "Ownable: new owner is the zero address");
        _transferOwnership(newOwner);
    }

    /**
     * @dev Transfers ownership of the contract to a new account (`newOwner`).
     * Internal function without access restriction.
     */
    function _transferOwnership(address newOwner) internal virtual {
        address oldOwner = _owner;
        _owner = newOwner;
        emit OwnershipTransferred(oldOwner, newOwner);
    }
}

// File: contracts/Pulsechain/HeroABLE.sol


pragma solidity 0.8.27;






// ---------------------------------------------------------------------------
// HERO V3 (PulseChain). Owner: VETS (jratdish1).
// Recovered from verified source of the old HeroABLE arb executor (0xC24c…e151, PulseChain Blockscout partial match).
// V3 changes (see contracts/v3/PROVENANCE.md): compiler pragma pinned, and every
// old hardcoded wallet/token address replaced by a constructor argument that must be
// non-zero (fail closed). Ownership is transferred to the chain's Owner Safe by the
// deploy script. NOT AUDITED FOR V3. DO NOT DEPLOY without Tier B approval.
// ---------------------------------------------------------------------------
contract HeroABLE is Ownable {
    struct Pair {
        address tokenA;
        address tokenB;
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
    IERC20 public wpls = IERC20(0xA1077a294dDE1B09bB078844df40758a5D0f9a27);
    uint256 public lpAddThreshold = 10000e18;
    uint256 public distributeThreshold = 10000e18;
    uint256 public minGain = 300e18;
    bool public targetedLpMode = false;
    address[] public targetLpPairs;

    uint256 public rewardsPercent = 0;
    uint256 public burnPercent = 25;
    uint256 public lpPercent = 50;
    uint256 public gasCompPercent = 25;

    address private signer;

    uint256 public totalHeroBurn;
    uint256 public totalHeroReward;
    uint256 public totalHeroLp;
    uint256 public totalHeroGasComp;
    uint256 public pendingGainsDistribution;

    IUniswapV2Router02 public pulseRouterV1 = IUniswapV2Router02(0x98bf93ebf5c380C0e6Ae8e192A7e2AE08edAcc02);
    IUniswapV2Router02 public pulseRouterV2 = IUniswapV2Router02(0x165C3410fC91EF562C50559f7d2289fEbed552d9);
    IUniswapV2Router02 public nineinchRouter = IUniswapV2Router02(0xeB45a3c4aedd0F47F345fB4c8A1802BB5740d725);

    modifier onlySigner() {
        require(msg.sender == signer, "Not signer");
        _;
    }

    constructor(address _heroToken) Ownable() {
        // V3: HERO V3 token is a deploy-time input; zero (= TBD) fails closed.
        require(_heroToken != address(0), "V3: heroToken TBD");
        heroToken = _heroToken;
        signer = msg.sender;
        rewardsAddress = address(heroToken);

        IERC20(heroToken).approve(address(pulseRouterV1), type(uint256).max);
        IERC20(heroToken).approve(address(pulseRouterV2), type(uint256).max);
        IERC20(heroToken).approve(address(nineinchRouter), type(uint256).max);
    }

    function addPair(
        address tokenA, 
        address tokenB, 
        address router, 
        address pairAddress
    ) external onlyOwner {
        require(tokenA != address(0) && tokenB != address(0), "Invalid token addresses");
        require(router != address(0), "Invalid router address");
        require(pairAddress != address(0), "Invalid pair address");

        require(
            router == address(pulseRouterV1) || 
            router == address(pulseRouterV2) || 
            router == address(nineinchRouter),
            "Router not supported"
        );

        IERC20(tokenA).approve(address(pulseRouterV1), type(uint256).max);
        IERC20(tokenB).approve(address(pulseRouterV1), type(uint256).max);
        IERC20(tokenA).approve(address(pulseRouterV2), type(uint256).max);
        IERC20(tokenB).approve(address(pulseRouterV2), type(uint256).max);
        IERC20(tokenA).approve(address(nineinchRouter), type(uint256).max);
        IERC20(tokenB).approve(address(nineinchRouter), type(uint256).max);

        pairs.push(Pair(tokenA, tokenB, router, pairAddress, 0, 0));

        emit PairAdded(tokenA, tokenB, router, pairAddress);
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
        address[][] memory swapPaths,
        uint amountIn,
        uint[] memory minAmountsOut
    ) external onlySigner {
        require(swapPaths.length == minAmountsOut.length, "Paths and minAmountsOut mismatch");
        require(swapPaths.length > 1, "At least two swaps required");

        uint256 currentAmount = amountIn;
        uint256[] memory amountsOut = new uint256[](swapPaths.length);
        IUniswapV2Router02[] memory bestRouters = new IUniswapV2Router02[](swapPaths.length);

        address[] memory routers = new address[](3);
        routers[0] = address(pulseRouterV1);
        routers[1] = address(pulseRouterV2);
        routers[2] = address(nineinchRouter);

        for (uint256 i = 0; i < swapPaths.length; i++) {
            require(swapPaths[i].length == 2, "Each swap path must have exactly 2 tokens");

            uint256 bestAmountOut = 0;
            IUniswapV2Router02 bestRouter;

            for (uint256 j = 0; j < routers.length; j++) {
                try IUniswapV2Router02(routers[j]).getAmountsOut(currentAmount, swapPaths[i]) returns (uint[] memory amounts) {
                    uint256 amountOut = amounts[amounts.length - 1];
                    if (amountOut > bestAmountOut) {
                        bestAmountOut = amountOut;
                        bestRouter = IUniswapV2Router02(routers[j]);
                    }
                } catch {
                }
            }

            require(address(bestRouter) != address(0), "No suitable router found for path");

            amountsOut[i] = bestAmountOut;
            bestRouters[i] = bestRouter;
            currentAmount = bestAmountOut;
        }

        require(amountsOut[swapPaths.length - 1] >= amountIn + minGain, "Must gain hero overall.");

        currentAmount = amountIn;
        for (uint256 i = 0; i < swapPaths.length; i++) {
            uint256 tokenBalanceBefore = IERC20(swapPaths[i][swapPaths[i].length - 1]).balanceOf(address(this));

            bestRouters[i].swapExactTokensForTokensSupportingFeeOnTransferTokens(
                currentAmount,
                minAmountsOut[i],
                swapPaths[i],
                address(this),
                block.timestamp
            );

            uint256 tokenBalanceAfter = IERC20(swapPaths[i][swapPaths[i].length - 1]).balanceOf(address(this));
            currentAmount = tokenBalanceAfter - tokenBalanceBefore;
        }
        uint256 finalGain = currentAmount > amountIn ? currentAmount - amountIn : 0;
        heroGained += finalGain;

        _handleLpContributionAndDistribution(finalGain, swapPaths);
    }

    function _handleLpContributionAndDistribution(uint256 finalGain, address[][] memory swapPaths) private {
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
                address finalTokenA = swapPaths[swapPaths.length - 1][0];
                address finalTokenB = swapPaths[swapPaths.length - 1][1];
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
            address[] memory path = new address[](2);
            path[0] = address(heroToken);
            path[1] = address(wpls);
            pulseRouterV2.swapExactTokensForETHSupportingFeeOnTransferTokens(
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

        address router = pair.router;
        address tokenA = pair.tokenA;
        address tokenB = pair.tokenB;

        (, address otherToken) = tokenA == heroToken
            ? (tokenA, tokenB)
            : (tokenB, tokenA);

        uint256 heroBalance = IERC20(heroToken).balanceOf(address(this));

        if (heroAmount > 0 && heroBalance >= heroAmount) {
            uint256 halfHeroAmount = heroAmount / 2;

            address[] memory path = new address[](2);
            path[0] = address(heroToken);
            path[1] = address(otherToken);

            uint256 initialOtherBalance = IERC20(otherToken).balanceOf(address(this));

            IUniswapV2Router02(router).swapExactTokensForTokensSupportingFeeOnTransferTokens(
                halfHeroAmount,
                0,
                path,
                address(this),
                block.timestamp
            );

            uint256 swappedOtherBalance = IERC20(otherToken).balanceOf(address(this)) - initialOtherBalance;

            (uint256 amountA, uint256 amountB, ) = IUniswapV2Router02(router).addLiquidity(
                heroToken,
                otherToken,
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

    function getBestAmountsOut(uint256[] memory amountsIn, address[][] memory paths)
        public
        view
        returns (uint256[] memory bestAmountsOut)
    {
        require(amountsIn.length == paths.length, "Amounts and paths length mismatch");

        uint256 numQueries = amountsIn.length;
        bestAmountsOut = new uint256[](numQueries);

        address[] memory routers = new address[](3);
        routers[0] = address(pulseRouterV1);
        routers[1] = address(pulseRouterV2);
        routers[2] = address(nineinchRouter);

        for (uint256 queryIndex = 0; queryIndex < numQueries; queryIndex++) {
            uint256 amountIn = amountsIn[queryIndex];
            address[] memory path = paths[queryIndex];

            uint256 bestAmountOut = 0;

            for (uint256 i = 0; i < routers.length; i++) {
                try IUniswapV2Router02(routers[i]).getAmountsOut(amountIn, path) returns (uint256[] memory amountsOut) {
                    uint256 amountOut = amountsOut[amountsOut.length - 1];
                    if (amountOut > bestAmountOut) {
                        bestAmountOut = amountOut;
                    }
                } catch {
                    continue;
                }
            }

            bestAmountsOut[queryIndex] = bestAmountOut;
        }
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

            try IUniswapV2Pair(pairAddress).getReserves() returns (
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

    event PairAdded(address tokenA, address tokenB, address router, address pairAddress);
}