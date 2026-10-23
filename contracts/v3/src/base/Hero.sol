// SPDX-License-Identifier: MIT

pragma solidity 0.8.26;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import { IUniswapV2Router02 } from "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";
import { IUniswapV2Factory } from "@uniswap/v2-core/contracts/interfaces/IUniswapV2Factory.sol";
import { HeroBuyAndBurn } from "./HeroBuyAndBurn.sol";

/**
 * Standard SafeMath, stripped down to just add/sub/mul/div
 */
library SafeMath {
    function add(uint256 a, uint256 b) internal pure returns (uint256) {
        uint256 c = a + b;
        require(c >= a, "SafeMath: addition overflow");

        return c;
    }

    function sub(uint256 a, uint256 b) internal pure returns (uint256) {
        return sub(a, b, "SafeMath: subtraction overflow");
    }

    function sub(
        uint256 a,
        uint256 b,
        string memory errorMessage
    ) internal pure returns (uint256) {
        require(b <= a, errorMessage);
        uint256 c = a - b;

        return c;
    }

    function mul(uint256 a, uint256 b) internal pure returns (uint256) {
        if (a == 0) {
            return 0;
        }

        uint256 c = a * b;
        require(c / a == b, "SafeMath: multiplication overflow");

        return c;
    }

    function div(uint256 a, uint256 b) internal pure returns (uint256) {
        return div(a, b, "SafeMath: division by zero");
    }

    function div(
        uint256 a,
        uint256 b,
        string memory errorMessage
    ) internal pure returns (uint256) {
        require(b > 0, errorMessage);
        uint256 c = a / b;
        return c;
    }
}

// Minimal Chainlink Aggregator interface
interface AggregatorV3Interface {
    function decimals() external view returns (uint8);
    function latestRoundData()
        external
        view
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        );
}

interface IERC721Minimal {
    function balanceOf(address owner) external view returns (uint256);
}

struct FeeStructure {
    uint256 heroBurnFee;
    uint256 heroAutoLpFee;
    uint256 donationFee;
    uint256 buyAndBurnFee;
    uint256 stakeRewardsFee;
}


// ---------------------------------------------------------------------------
// HERO V3 (Base). Owner: VETS (jratdish1).
// Recovered from verified source of the old HERO token (0x00Fa…b5f8, Sourcify exact match).
// V3 changes (see contracts/v3/PROVENANCE.md): compiler pragma pinned, and every
// old hardcoded wallet/token address replaced by a constructor argument that must be
// non-zero (fail closed). Ownership is transferred to the chain's Owner Safe by the
// deploy script. NOT AUDITED FOR V3. DO NOT DEPLOY without Tier B approval.
// ---------------------------------------------------------------------------
contract Hero is ERC20, ERC20Permit, ERC20Votes, Ownable {
    using SafeMath for uint256;

    address public immutable WETH = 0x4200000000000000000000000000000000000006;
    address public immutable USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
    HeroBuyAndBurn public buyAndBurn;

    AggregatorV3Interface public priceFeed = AggregatorV3Interface(0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70);
    uint8 public priceFeedDecimals = 8;

    uint8 public constant DECIMALS = 18;
    uint256 public constant INITIAL_SUPPLY = 100_000_000e18;
    uint256 public constant feeDenominator = 10000;

    uint256 public maxTxAmount;
    uint256 public feeDecayTime = 90 days;
    uint256 public baseSellFee = 1200;
    uint256 public minSellFee = 600;
    uint256 public heroBurnFee = 0;
    uint256 public donationFee = 5000;
    uint256 public heroAutoLpFee = 4000;
    uint256 public buyAndBurnFee = 1000;
    uint256 public stakeRewardsFee = 0;
    uint256 public constant FEE_DENOM = 10000;
    mapping(address user => uint256 startTime) public holderStartTime;

    address public feeDiscountNft;
    bool public feeDiscountEnabled = false;
    uint256 public nftFeeDiscountBps;

    address public autoLiquidityReceiver;
    address public donationReceiver;
    address public stakeRewardsReceiver;

    IUniswapV2Router02 public immutable uniswapRouter;
    address public uniswapPair;
    address[] public pairs;

    uint256 public launchedAt;
    bool public swapEnabled = true;
    uint256 public swapThreshold;
    bool private inSwap;

    uint256 public totalHeroBurned;
    uint256 public totalEthHeroLpAdded;
    uint256 public totalUsdHeroLpAdded;
    uint256 public totalEthDonated;
    uint256 public totalUsdDonated;
    uint256 public totalEthBuyAndBurn;
    uint256 public totalEthStakingRewards;

    modifier swapping() {
        inSwap = true;
        _;
        inSwap = false;
    }

    mapping(address => bool) public isFeeExempt;
    mapping(address => bool) public isTxLimitExempt;
    mapping(address => bool) public isPair;

    event AutoLiquify(uint256 amountWETH, uint256 amountHero);
    event Launched(uint256 blockNumber, uint256 timestamp);
    event ParameterUpdated();
    event SwapBackSuccess(uint256 amount);
    event SwapBackFailed(string message);
    event PriceFeedUpdated(address indexed priceFeed, uint8 decimals);
    event FeeDiscountSettingsUpdated(address indexed nft, bool enabled, uint256 discountBps);

    constructor(
        uint32 _startTimestamp,
        address _autoLiquidityReceiver,
        address _donationReceiver,
        address _stakeRewardsReceiver
    )
        ERC20("HERO Token for Veterans", "HERO")
        ERC20Permit("HERO Token for Veterans")
        Ownable()
    {
        // V3: receivers are deploy-time inputs; zero (= TBD) fails closed.
        require(
            _autoLiquidityReceiver != address(0) &&
                _donationReceiver != address(0) &&
                _stakeRewardsReceiver != address(0),
            "V3: receiver TBD"
        );
        autoLiquidityReceiver = _autoLiquidityReceiver;
        donationReceiver = _donationReceiver;
        uniswapRouter = IUniswapV2Router02(
            0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24
        );
        uniswapPair = IUniswapV2Factory(uniswapRouter.factory()).createPair(
            WETH,
            address(this)
        );
        pairs.push(uniswapPair);
        isPair[uniswapPair] = true;

        _approve(address(this), address(uniswapRouter), type(uint256).max);
        _mint(msg.sender, INITIAL_SUPPLY);
        buyAndBurn = new HeroBuyAndBurn(
            msg.sender,
            _startTimestamp,
            address(this),
            WETH
        );

        maxTxAmount = INITIAL_SUPPLY;
        swapThreshold = INITIAL_SUPPLY / 1000;

        isFeeExempt[msg.sender] = true;
        isTxLimitExempt[msg.sender] = true;
        isFeeExempt[address(this)] = true;
        isTxLimitExempt[address(this)] = true;
        isFeeExempt[address(buyAndBurn)] = true;
        isTxLimitExempt[address(buyAndBurn)] = true;

        stakeRewardsReceiver = _stakeRewardsReceiver;

        emit Transfer(address(0), msg.sender, INITIAL_SUPPLY);
    }

    function _transfer(
        address sender,
        address recipient,
        uint256 amount
    ) internal override {
        require(
            launchedAt > 0 || tx.origin == owner(),
            "The contract is not launched yet"
        );

        if (inSwap) {
            super._transfer(sender, recipient, amount);
            return;
        }

        _checkTxLimit(sender, recipient, amount);

        if (_shouldSwapBack()) {
            swapBack();
        }

        if (holderStartTime[recipient] == 0) {
            holderStartTime[recipient] = block.timestamp;
        }

        uint256 amountReceived = _shouldTakeFee(sender, recipient)
            ? _takeFee(sender, recipient, amount)
            : amount;

        super._transfer(sender, recipient, amountReceived);
    }

    function _checkTxLimit(
        address sender,
        address recipient,
        uint256 amount
    ) internal view {
        require(
            amount <= maxTxAmount ||
                isTxLimitExempt[sender] ||
                isTxLimitExempt[recipient],
            "TX Limit Exceeded"
        );
    }

    function _shouldTakeFee(address sender, address recipient)
        internal
        view
        returns (bool)
    {
        if (isFeeExempt[sender] || isFeeExempt[recipient] || launchedAt == 0)
            return false;
        for (uint256 i; i < pairs.length; i++) {
            if (sender == pairs[i] || recipient == pairs[i]) return true;
        }
        return false;
    }

    function getTotalFee(
        address user
    ) public view returns (uint256) {
        uint256 lastTime = holderStartTime[user];
        uint256 timeElapsed = block.timestamp > lastTime
            ? block.timestamp - lastTime
            : 0;

        uint256 fee;
        if (timeElapsed >= feeDecayTime) {
            fee = minSellFee;
        } else {
            uint256 discount = baseSellFee.sub(minSellFee).mul(timeElapsed).div(
                feeDecayTime
            );
            fee = baseSellFee.sub(discount);
        }

        if (feeDiscountEnabled && feeDiscountNft != address(0) && nftFeeDiscountBps > 0) {
            try IERC721Minimal(feeDiscountNft).balanceOf(user) returns (uint256 bal) {
                if (bal > 0) {
                    uint256 feeReduction = fee.mul(nftFeeDiscountBps).div(FEE_DENOM);
                    fee = fee.sub(feeReduction);
                }
            } catch {}
        }
        return fee;
    }


    function _takeFee(
        address sender,
        address recipient,
        uint256 amount
    ) internal returns (uint256) {
        bool selling = false;
        for (uint256 i; i < pairs.length; i++) {
            if (recipient == pairs[i]) {
                selling = true;
                break;
            }
        }
        uint256 feeRate = getTotalFee(sender);
        uint256 feeAmount = amount.mul(feeRate).div(FEE_DENOM);
        super._transfer(sender, address(this), feeAmount);
        return amount.sub(feeAmount);
    }

    function _shouldSwapBack() internal view returns (bool) {
        return
            !isPair[msg.sender] &&
            !inSwap &&
            swapEnabled &&
            balanceOf(address(this)) >= swapThreshold;
    }

    function swapBack() internal swapping {
        uint256 amountHeroBurn = swapThreshold.mul(heroBurnFee).div(feeDenominator);
        uint256 amountHeroLp = swapThreshold.mul(heroAutoLpFee.div(2)).div(feeDenominator);

        if (amountHeroBurn > 0) {
            super._burn(address(this), amountHeroBurn);
            totalHeroBurned = totalHeroBurned.add(amountHeroBurn);
        }

        uint256 amountHeroSwap = swapThreshold
            .sub(amountHeroBurn)
            .sub(amountHeroLp);

        uint256 balanceBefore = address(this).balance;

        address[] memory path = new address[](2);
        path[0] = address(this);
        path[1] = address(WETH);

        try uniswapRouter.swapExactTokensForETHSupportingFeeOnTransferTokens(
            amountHeroSwap,
            0,
            path,
            address(this),
            block.timestamp
        ) {
            uint256 amountEth = address(this).balance.sub(balanceBefore);
            uint256 distDenom = feeDenominator.sub(heroBurnFee).sub(heroAutoLpFee.div(2));
            
            uint256 ethPrice = 0; // 1e18-scaled USD per ETH if available
            if (address(priceFeed) != address(0)) {
                // Use try/catch with unnamed placeholders except the one we need (answer)
                try priceFeed.latestRoundData() returns (uint80, int256 answer, uint256, uint256, uint80) {
                    if (answer > 0) {
                        uint8 dec = priceFeedDecimals;
                        if (dec <= 18) {
                            ethPrice = uint256(answer) * (10 ** (18 - dec));
                        } else {
                            ethPrice = uint256(answer) / (10 ** (dec - 18));
                        }
                    }
                } catch {}
            }
            
            {
                uint256 amountEthHeroLiquidity = amountEth.mul(heroAutoLpFee.div(2)).div(distDenom);
                if (amountEthHeroLiquidity > 0) {
                    try uniswapRouter.addLiquidityETH{value: amountEthHeroLiquidity.div(2)}(
                        address(this),
                        amountHeroLp,
                        0,
                        0,
                        autoLiquidityReceiver,
                        block.timestamp
                    ) {
                    emit AutoLiquify(amountHeroLp, amountEthHeroLiquidity.div(2));
                    totalEthHeroLpAdded = totalEthHeroLpAdded.add(amountEthHeroLiquidity.mul(2));
                    if (ethPrice > 0) {
                        totalUsdHeroLpAdded = totalUsdHeroLpAdded.add(amountEthHeroLpAddedPart(amountEthHeroLiquidity, ethPrice));
                    }
                } catch {
                    emit AutoLiquify(0, 0);
                }
                }

                uint256 amountEthBuyAndBurn = amountEth.mul(buyAndBurnFee).div(distDenom);
                if (amountEthBuyAndBurn > 0) {
                    if (amountEthBuyAndBurn > address(this).balance) {
                        amountEthBuyAndBurn = address(this).balance;
                    }
                    buyAndBurn.distributeETHForBurning{value: amountEthBuyAndBurn}();
                    totalEthBuyAndBurn = totalEthBuyAndBurn.add(amountEthBuyAndBurn);
                }

                uint256 amountEthDonation = amountEth.mul(donationFee).div(distDenom);
                if (amountEthDonation > 0) {
                    if (amountEthDonation > address(this).balance) {
                        amountEthDonation = address(this).balance;
                    }

                    address[] memory dpath = new address[](2);
                    dpath[0] = address(WETH);
                    dpath[1] = USDC;

                    uint256 usdcBefore = IERC20(USDC).balanceOf(address(this));
                    bool swapped = false;
                    try uniswapRouter.swapExactETHForTokens{value: amountEthDonation}(
                        0,
                        dpath,
                        address(this),
                        block.timestamp
                    ) {
                        swapped = true;
                    } catch {}

                    if (swapped) {
                        uint256 usdcAfter = IERC20(USDC).balanceOf(address(this));
                        uint256 usdcReceived = usdcAfter.sub(usdcBefore);
                        if (usdcReceived > 0) {
                            IERC20(USDC).transfer(donationReceiver, usdcReceived);
                            totalUsdDonated = totalUsdDonated.add(usdcReceived);
                        }
                    } else {
                        (bool success, ) = payable(donationReceiver).call{value: amountEthDonation, gas: 30000}("");
                        success;
                    }

                    totalEthDonated = totalEthDonated.add(amountEthDonation);
                }

                uint256 amountEthStakeRewards = amountEth.mul(stakeRewardsFee).div(distDenom);
                if (amountEthStakeRewards > 0) {
                    if (amountEthStakeRewards > address(this).balance) {
                        amountEthStakeRewards = address(this).balance;
                    }
                    (bool success2, ) = payable(stakeRewardsReceiver).call{value: amountEthStakeRewards, gas: 30000}("");
                    success2;
                    totalEthStakingRewards = totalEthStakingRewards.add(amountEthStakeRewards);
                }
            }

            if (address(this).balance > 0) {
                (bool success, ) = payable(owner()).call{value: address(this).balance, gas: 30000}("");
                success;
            }

            emit SwapBackSuccess(amountHeroSwap);
        } catch Error(string memory e) {
            emit SwapBackFailed(string(abi.encodePacked("SwapBack failed with error ", e)));
        } catch {
            emit SwapBackFailed("SwapBack failed without an error message from UniSwap");
        }
    }

    // Helper to compute USD from ETH liquidity part, maintaining 1e18 USD scale
    function amountEthHeroLpAddedPart(uint256 amountEthHalf, uint256 price1e18) internal pure returns (uint256) {
        // amountEthHalf*2 already accounted before; this helper just multiplies ETH by USD price and scales back to 1e18
        // For clarity, we accept one side (amountEthHeroLiquidity) and multiply by 2 externally where needed
        return amountEthHalf.mul(2).mul(price1e18).div(1e18);
    }

    function launch() external onlyOwner {
        require(launchedAt == 0, "Already launched");
        launchedAt = block.timestamp;
        emit Launched(block.number, block.timestamp);
    }

    function setPriceFeed(address _feed) external onlyOwner {
        require(_feed != address(0), "Zero address");
        priceFeed = AggregatorV3Interface(_feed);
        uint8 dec = priceFeed.decimals();
        priceFeedDecimals = dec;
        emit PriceFeedUpdated(_feed, dec);
    }

    function setAutoLiquidityReceiver(address addr) external onlyOwner {
        require(addr != address(0), "Zero address");
        autoLiquidityReceiver = addr;
        emit ParameterUpdated();
    }
    
    function setDonationReceiver(address addr) external onlyOwner {
        require(addr != address(0), "Zero address");
        donationReceiver = addr;
        emit ParameterUpdated();
    }

    function setStakeRewardsReceiver(address addr) external onlyOwner {
        require(addr != address(0), "Zero address");
        stakeRewardsReceiver = addr;
        emit ParameterUpdated();
    }

    function setBuyAndBurnAddress(address addr) external onlyOwner {
        require(addr != address(0), "Zero address");
        buyAndBurn = HeroBuyAndBurn(payable(addr));
        isFeeExempt[addr] = true;
        isTxLimitExempt[addr] = true;
        emit ParameterUpdated();
    }

    function setTxLimit(uint256 amount) external onlyOwner {
        require(amount >= totalSupply() / 2000, "Too low");
        maxTxAmount = amount;
        emit ParameterUpdated();
    }

    function setFeeExempt(address addr, bool ex) external onlyOwner {
        isFeeExempt[addr] = ex;
        emit ParameterUpdated();
    }

    function setTxLimitExempt(address addr, bool ex) external onlyOwner {
        isTxLimitExempt[addr] = ex;
        emit ParameterUpdated();
    }

    function setFeeSettings(
        uint256 _feeDecayTime,
        uint256 _baseSellFee,
        uint256 _minSellFee
    ) external onlyOwner {
        require(_minSellFee <= _baseSellFee, "Min fee must be <= base fee");
        require(_baseSellFee <= 1500, "Base fee must be <= 15%");
        feeDecayTime = _feeDecayTime;
        baseSellFee = _baseSellFee;
        minSellFee = _minSellFee;
        emit ParameterUpdated();
    }

    function setFeeDiscountNft(address nft, uint256 discountBps, bool enabled) external onlyOwner {
        feeDiscountNft = nft;
        nftFeeDiscountBps = discountBps;
        feeDiscountEnabled = enabled;
        require(nftFeeDiscountBps <= FEE_DENOM, "Discount too high");
        emit FeeDiscountSettingsUpdated(feeDiscountNft, feeDiscountEnabled, nftFeeDiscountBps);
    }

    function isEligibleForNftDiscount(address user) external view returns (bool) {
        if (!feeDiscountEnabled || feeDiscountNft == address(0)) return false;
        try IERC721Minimal(feeDiscountNft).balanceOf(user) returns (uint256 bal) {
            return bal > 0;
        } catch {
            return false;
        }
    }

    function setFees(FeeStructure calldata fees) external onlyOwner {
        heroBurnFee = fees.heroBurnFee;
        heroAutoLpFee = fees.heroAutoLpFee;
        donationFee = fees.donationFee;
        buyAndBurnFee = fees.buyAndBurnFee;
        stakeRewardsFee = fees.stakeRewardsFee;
        require(
            fees.heroBurnFee
                .add(fees.heroAutoLpFee)
                .add(fees.donationFee)
                .add(fees.buyAndBurnFee)
                .add(fees.stakeRewardsFee) == FEE_DENOM,
            "Fees must add up to 100%"
        );
        emit ParameterUpdated();
    }

    function setSwapBackSettings(bool en, uint256 amt) external onlyOwner {
        swapEnabled = en;
        swapThreshold = amt;
        emit ParameterUpdated();
    }

    function addPair(address pair) external onlyOwner {
        require(!isPair[pair], "Exists");
        pairs.push(pair);
        isPair[pair] = true;
        emit ParameterUpdated();
    }

    function removePair(address pair) external onlyOwner {
        require(isPair[pair], "Pair does not exist");
        
        uint256 indexToRemove;
        bool found = false;
        for (uint256 i = 0; i < pairs.length; i++) {
            if (pairs[i] == pair) {
                indexToRemove = i;
                found = true;
                break;
            }
        }
        require(found, "Pair not found in array");
        
        pairs[indexToRemove] = pairs[pairs.length - 1];
        pairs.pop();
        isPair[pair] = false;
        
        emit ParameterUpdated();
    }

    function withdraw() external onlyOwner {
        payable(msg.sender).transfer(address(this).balance);
    }

    function withdrawTokens(address tok, uint256 amt) external onlyOwner {
        require(tok != address(this) && tok != address(0), "Invalid");
        IERC20(tok).transfer(msg.sender, amt);
    }

    function _afterTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal override(ERC20, ERC20Votes) {
        super._afterTokenTransfer(from, to, amount);
    }

    function _mint(address to, uint256 amount)
        internal override(ERC20, ERC20Votes)
    {
        super._mint(to, amount);
    }

    function _burn(address account, uint256 amount)
        internal override(ERC20, ERC20Votes)
    {
        super._burn(account, amount);
    }

    function nonces(address owner)
        public view override(ERC20Permit) returns (uint256)
    {
        return super.nonces(owner);
    }

    function clock() public view override returns (uint48) {
        return uint48(block.number);
    }

    function CLOCK_MODE() public pure override returns (string memory) {
        return "mode=blocknumber&from=default";
    }

    receive() external payable {}
}