#!/usr/bin/env bash
# HERO V3 LOCAL fork dry run. Owner: VETS (jratdish1).
# Usage: script/dryrun/run_fork_dryrun.sh base|pulsechain   (run from contracts/v3)
# - Forks a PUBLIC RPC into a local anvil (127.0.0.1). Transactions go ONLY to that local anvil.
# - No private keys anywhere: senders are anvil-impersonated throwaway addresses derived from
#   public labels (keccak256("herobot.v3.dryrun.<NAME>")); no key exists for them.
# - Role addresses are placeholders, NOT Safes. Nothing is sent to Base or PulseChain.
set -euo pipefail
export PATH="$HOME/.foundry/bin:$PATH"
CHAIN="${1:?base|pulsechain}"
case "$CHAIN" in
  base)       FORK_RPC=https://mainnet.base.org;     CHAINID=8453; PORT=18545; HF=auto;     SIM_EVM=cancun;   LIQ=10ether;      BUY=0.5ether ;;
  pulsechain) FORK_RPC=https://rpc.pulsechain.com;   CHAINID=369;  PORT=18546; HF=shanghai; SIM_EVM=shanghai; LIQ=1000000ether; BUY=50000ether ;;
  *) echo "unknown chain"; exit 2 ;;
esac
# PulseChain rejects MCOPY/TSTORE (Cancun) on mainnet, so its fork runs as shanghai to match.
LOCAL="http://127.0.0.1:${PORT}"
PASS=0; FAIL=0; SKIP=0
ok()   { echo "CHECK $CHAIN $1: OK";   PASS=$((PASS+1)); }
bad()  { echo "CHECK $CHAIN $1: FAIL"; FAIL=$((FAIL+1)); }
skip() { echo "CHECK $CHAIN $1: SKIP ($2)"; SKIP=$((SKIP+1)); }
check(){ if [ "$2" = "$3" ]; then ok "$1"; else bad "$1 (got $2 want $3)"; fi; }
lbl()  { cast to-check-sum-address "0x$(cast keccak "herobot.v3.dryrun.$1" | cut -c27-66)"; }
lc()   { echo "$1" | tr 'A-F' 'a-f'; }

HFARG=(); [ "$HF" != auto ] && HFARG=(--hardfork "$HF")
anvil --fork-url "$FORK_RPC" --port "$PORT" "${HFARG[@]}" --silent >/tmp/anvil_$CHAIN.log 2>&1 &
ANVIL=$!; trap 'kill $ANVIL 2>/dev/null || true' EXIT
for _ in $(seq 1 60); do cast chain-id --rpc-url "$LOCAL" >/dev/null 2>&1 && break; sleep 0.5; done

# ---- fail-closed guards: local anvil only ----
CV=$(cast rpc --rpc-url "$LOCAL" web3_clientVersion | tr -d '"')
case "$CV" in anvil*) ok "rpc is local anvil ($CV)";; *) echo "refusing: not anvil"; exit 3;; esac
check "fork chainid" "$(cast chain-id --rpc-url "$LOCAL")" "$CHAINID"
echo "fork block: $(cast block-number --rpc-url "$LOCAL") hardfork=$HF"

D1=$(lbl D1); OS=$(lbl OS); USER=$(lbl USER)
echo "D1=$D1 OS=$OS USER=$USER (throwaway labels, no keys)"
# D1 must be fresh on the REAL chain (read-only queries).
check "D1 real-chain nonce" "$(cast nonce "$D1" --rpc-url "$FORK_RPC")" "0"
check "D1 real-chain code" "$(cast code "$D1" --rpc-url "$FORK_RPC")" "0x"
for a in "$D1" "$OS" "$USER"; do
  cast rpc --rpc-url "$LOCAL" anvil_setBalance "$a" 0x33b2e3c9fd0803ce8000000 >/dev/null   # 1e27 wei, local only
  cast rpc --rpc-url "$LOCAL" anvil_impersonateAccount "$a" >/dev/null
done

# ---- snapshot the default-profile artifacts that get deployed ----
# forge's script simulator runs at --evm-version, which would also recompile out/.
# So the default build (the bytecode the repo ships) is frozen into out-dryrun/ first,
# and the script reads only from there. PulseX factory uses PUSH0, so the simulator must
# be >= shanghai on PulseChain (paris simulation fails with NotActivated in createPair).
forge build -q
rm -rf out-dryrun && mkdir -p out-dryrun/pulsechain
for f in Hero.sol/Hero.json HeroABLE.sol/HeroABLE.json HeroSingleSidedStaking.sol/HeroSingleSidedStaking.json \
         pulsechain/Hero.sol/Hero.json pulsechain/HeroABLE.sol/HeroABLE.json; do
  mkdir -p "out-dryrun/$(dirname "$f")"; cp "out/$f" "out-dryrun/$f"
  echo "  artifact $f initcode-sha256=$(python3 -c "import json,hashlib;print(hashlib.sha256(bytes.fromhex(json.load(open('out-dryrun/$f'))['bytecode']['object'][2:])).hexdigest())")"
done

# ---- deploy (to the local anvil only) ----
DRYRUN_CHAIN=$CHAIN forge script script/dryrun/DryRunV3.s.sol:DryRunV3 --rpc-url "$LOCAL" \
  --broadcast --unlocked --sender "$D1" --slow -q --evm-version "$SIM_EVM" > /tmp/dryrun_$CHAIN.forge.log 2>&1 \
  && ok "forge script deploy (local anvil)" || { bad "forge script deploy"; tail -20 /tmp/dryrun_$CHAIN.forge.log; exit 1; }

HERO=$(cast compute-address "$D1" --nonce 0 | awk '{print $NF}')
ABLE=$(cast compute-address "$D1" --nonce 1 | awk '{print $NF}')
BB=$(cast compute-address "$HERO" --nonce 1 | awk '{print $NF}')
echo "HERO=$HERO B&B=$BB HeroABLE=$ABLE"
check "HERO at D1 nonce 0" "$(lc "$(cast call "$HERO" 'buyAndBurn()(address)' --rpc-url "$LOCAL")")" "$(lc "$BB")"
check "HeroABLE at D1 nonce 1 wired to HERO" "$(lc "$(cast call "$ABLE" 'heroToken()(address)' --rpc-url "$LOCAL")")" "$(lc "$HERO")"
check "HERO owner = OS placeholder" "$(lc "$(cast call "$HERO" 'owner()(address)' --rpc-url "$LOCAL")")" "$(lc "$OS")"
check "B&B owner = OS placeholder" "$(lc "$(cast call "$BB" 'owner()(address)' --rpc-url "$LOCAL")")" "$(lc "$OS")"
check "HeroABLE owner = OS placeholder" "$(lc "$(cast call "$ABLE" 'owner()(address)' --rpc-url "$LOCAL")")" "$(lc "$OS")"
check "D1 holds full supply" "$(cast call "$HERO" 'balanceOf(address)(uint256)' "$D1" --rpc-url "$LOCAL" | awk '{print $1}')" "100000000000000000000000000"
SCAN="$HERO $BB $ABLE"
if [ "$CHAIN" = base ]; then
  STK=$(cast compute-address "$D1" --nonce 2 | awk '{print $NF}'); SCAN="$SCAN $STK"
  echo "STAKING=$STK"
  check "staking owner = OS placeholder" "$(lc "$(cast call "$STK" 'owner()(address)' --rpc-url "$LOCAL")")" "$(lc "$OS")"
  check "staking token = HERO" "$(lc "$(cast call "$STK" 'stakingToken()(address)' --rpc-url "$LOCAL")")" "$(lc "$HERO")"
  check "D1 final nonce" "$(cast nonce "$D1" --rpc-url "$LOCAL")" "6"
else
  skip "staking deploy" "OZ 5.6.1 build needs Cancun; PulseChain is Shanghai-level. Tier B"
  check "D1 final nonce" "$(cast nonce "$D1" --rpc-url "$LOCAL")" "5"
fi
python3 script/dryrun/scan_bytecode.py "$LOCAL" $SCAN && ok "deployed bytecode has no #776/#792 address" || bad "bytecode old-address scan"

# ---- exercise against the real forked DEX router ----
if [ "$CHAIN" = base ]; then RG='uniswapRouter()(address)'; PG='uniswapPair()(address)'; else RG='pulseRouterV2()(address)'; PG='pulseV2Pair()(address)'; fi
ROUTER=$(cast call "$HERO" "$RG" --rpc-url "$LOCAL")
WNATIVE=$(cast call "$ROUTER" 'WETH()(address)' --rpc-url "$LOCAL" 2>/dev/null || cast call "$ROUTER" 'WPLS()(address)' --rpc-url "$LOCAL")
PAIR=$(cast call "$HERO" "$PG" --rpc-url "$LOCAL")
DL=$(( $(cast block --rpc-url "$LOCAL" -f timestamp) + 3600 ))
send() { local from=$1; shift; cast send --rpc-url "$LOCAL" --unlocked --from "$from" "$@" >/dev/null; }
send "$OS" "$HERO" 'launch()' && ok "OS launch()" || bad "OS launch()"
send "$D1" "$HERO" 'approve(address,uint256)' "$ROUTER" "$(cast max-uint)"
send "$D1" "$ROUTER" 'addLiquidityETH(address,uint256,uint256,uint256,address,uint256)' "$HERO" 1000000ether 0 0 "$D1" "$DL" --value "$LIQ" \
  && ok "addLiquidityETH on real router" || bad "addLiquidityETH"
R=$(cast call "$PAIR" 'getReserves()(uint112,uint112,uint32)' --rpc-url "$LOCAL" | head -2 | awk '{print $1}' | paste -sd, -)
echo "pair reserves: $R"
B0=$(cast call "$HERO" 'balanceOf(address)(uint256)' "$USER" --rpc-url "$LOCAL" | awk '{print $1}')
send "$USER" "$ROUTER" 'swapExactETHForTokensSupportingFeeOnTransferTokens(uint256,address[],address,uint256)' 0 "[$WNATIVE,$HERO]" "$USER" "$DL" --value "$BUY" \
  && ok "buy via real router" || bad "buy"
B1=$(cast call "$HERO" 'balanceOf(address)(uint256)' "$USER" --rpc-url "$LOCAL" | awk '{print $1}')
FEES=$(cast call "$HERO" 'balanceOf(address)(uint256)' "$HERO" --rpc-url "$LOCAL" | awk '{print $1}')
echo "USER bought (wei HERO): $(python3 -c "print($B1-$B0)")  fees held by HERO: $FEES"
[ "$(python3 -c "print(int($B1>$B0))")" = 1 ] && ok "user received HERO" || bad "user received HERO"
if [ "$CHAIN" = base ]; then
  send "$OS" "$HERO" 'setTxLimitExempt(address,bool)' "$STK" true && ok "OS setTxLimitExempt(staking)" || bad "setTxLimitExempt"
  send "$D1" "$HERO" 'transfer(address,uint256)' "$OS" 70000ether
  send "$OS" "$HERO" 'approve(address,uint256)' "$STK" "$(cast max-uint)"
  send "$USER" "$HERO" 'approve(address,uint256)' "$STK" "$(cast max-uint)"
  HALF=$(python3 -c "print(($B1-$B0)//2)")
  send "$USER" "$STK" 'stake(uint256)' "$HALF" && ok "USER stake" || bad "USER stake"
  check "staked balance" "$(cast call "$STK" 'balanceOf(address)(uint256)' "$USER" --rpc-url "$LOCAL" | awk '{print $1}')" "$HALF"
  send "$OS" "$STK" 'notifyRewardAmount(uint256)' 70000ether && ok "OS notifyRewardAmount" || bad "notifyRewardAmount"
  cast rpc --rpc-url "$LOCAL" evm_increaseTime 604801 >/dev/null; cast rpc --rpc-url "$LOCAL" evm_mine >/dev/null
  S0=$(cast call "$HERO" 'balanceOf(address)(uint256)' "$USER" --rpc-url "$LOCAL" | awk '{print $1}')
  send "$USER" "$STK" 'exit()' && ok "USER exit (principal + rewards)" || bad "USER exit"
  S1=$(cast call "$HERO" 'balanceOf(address)(uint256)' "$USER" --rpc-url "$LOCAL" | awk '{print $1}')
  GOT=$(python3 -c "print($S1-$S0)"); echo "exit returned: $GOT (principal $HALF + ~70000e18 reward)"
  python3 -c "import sys; sys.exit(0 if abs($GOT-($HALF+70000*10**18))<=10**13 else 1)" && ok "exit amount = principal + reward" || bad "exit amount"
fi
send "$USER" "$HERO" 'approve(address,uint256)' "$ROUTER" "$(cast max-uint)"
DL=$(( $(cast block --rpc-url "$LOCAL" -f timestamp) + 3600 ))
F0=$(cast call "$HERO" 'balanceOf(address)(uint256)' "$HERO" --rpc-url "$LOCAL" | awk '{print $1}')
SELL=$(python3 -c "print(int(\"$(cast call "$HERO" 'balanceOf(address)(uint256)' "$USER" --rpc-url "$LOCAL" | awk '{print $1}')\")//4)")
send "$USER" "$ROUTER" 'swapExactTokensForETHSupportingFeeOnTransferTokens(uint256,uint256,address[],address,uint256)' "$SELL" 0 "[$HERO,$WNATIVE]" "$USER" "$DL" \
  && ok "sell via real router" || bad "sell"
F1=$(cast call "$HERO" 'balanceOf(address)(uint256)' "$HERO" --rpc-url "$LOCAL" | awk '{print $1}')
echo "HERO-held fees before/after sell: $F0 / $F1"
echo "D1 local nonce after exercise: $(cast nonce "$D1" --rpc-url "$LOCAL")"
echo "RESULT $CHAIN pass=$PASS fail=$FAIL skip=$SKIP -> $([ $FAIL -eq 0 ] && echo GREEN || echo RED)"
[ $FAIL -eq 0 ]
