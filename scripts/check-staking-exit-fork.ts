/**
 * Red-team F1 fork check (local anvil only; nothing is sent to Base).
 * Usage: npx tsx scripts/check-staking-exit-fork.ts   (needs `anvil` on PATH and a public Base RPC)
 *
 * Stakes on a local fork of the live Base staking contract, then sends exactly
 * the calldata the app's exit planner produces and asserts the staking
 * treasury gains nothing and the user gets the full principal back. Includes
 * a control showing that a plain locked withdraw would have paid the penalty.
 */
import { spawn } from "node:child_process";
import {
  createPublicClient, createTestClient, createWalletClient, encodeFunctionData, http, parseUnits,
  type Address, type Hex,
} from "viem";
import { base } from "viem/chains";
import { STAKING_ABI } from "../client/src/lib/staking-abi";
import { planPenaltyFreeExit, planUnstake, STAKING_LOCKED_UNSTAKE_ERROR, type StakingExitCall } from "../client/src/lib/stakingExit";

const FORK_RPC = process.env.BASE_FORK_RPC ?? "https://mainnet.base.org";
const PORT = 18547;
const RPC = `http://127.0.0.1:${PORT}`;
const STAKING: Address = "0xAD7991a61e5d5C242839445EAAFE244500EEC722";
const USER: Address = "0x00000000000000000000000000000000f1f1f1f1";
const ERC20 = [
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "a", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "transfer", stateMutability: "nonpayable", inputs: [{ name: "to", type: "address" }, { name: "v", type: "uint256" }], outputs: [{ type: "bool" }] },
  { type: "function", name: "approve", stateMutability: "nonpayable", inputs: [{ name: "s", type: "address" }, { name: "v", type: "uint256" }], outputs: [{ type: "bool" }] },
] as const;

const OWNER_ABI = [
  { type: "function", name: "owner", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "notifyRewardAmount", stateMutability: "nonpayable", inputs: [{ name: "reward", type: "uint256" }], outputs: [] },
] as const;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
function check(name: string, ok: boolean, detail = ""): void {
  console.log(`CHECK ${name}: ${ok ? "OK" : "FAIL"}${detail ? ` (${detail})` : ""}`);
  if (!ok) failures++;
}

async function main(): Promise<void> {
  const anvil = spawn("anvil", ["--fork-url", FORK_RPC, "--port", String(PORT), "--silent"], { stdio: "ignore" });
  try {
    const pub = createPublicClient({ chain: base, transport: http(RPC) });
    for (let i = 0; i < 60; i++) {
      try { await pub.getChainId(); break; } catch { await sleep(500); }
    }
    const version = await pub.request({ method: "web3_clientVersion" as never }) as string;
    if (!String(version).startsWith("anvil")) throw new Error(`refusing: ${RPC} is not anvil`);
    const test = createTestClient({ chain: base, mode: "anvil", transport: http(RPC) });
    const wallet = createWalletClient({ chain: base, transport: http(RPC) });

    const hero = await pub.readContract({ address: STAKING, abi: STAKING_ABI, functionName: "heroToken" });
    const treasury = await pub.readContract({ address: STAKING, abi: STAKING_ABI, functionName: "treasury" });
    const lockPeriod = await pub.readContract({ address: STAKING, abi: STAKING_ABI, functionName: "lockPeriod" });
    const bal = (a: Address) => pub.readContract({ address: hero, abi: ERC20, functionName: "balanceOf", args: [a] });
    const staked = (a: Address) => pub.readContract({ address: STAKING, abi: STAKING_ABI, functionName: "balanceOf", args: [a] });
    const isLocked = (a: Address) => pub.readContract({ address: STAKING, abi: STAKING_ABI, functionName: "isLocked", args: [a] });
    const earned = (a: Address) => pub.readContract({ address: STAKING, abi: STAKING_ABI, functionName: "earned", args: [a] });

    async function send(from: Address, to: Address, data: Hex): Promise<void> {
      const hash = await wallet.sendTransaction({ account: from, to, data, chain: base });
      const r = await pub.waitForTransactionReceipt({ hash });
      if (r.status !== "success") throw new Error(`tx to ${to} reverted`);
    }
    const sendPlan = async (calls: StakingExitCall[]) => {
      for (const c of calls) {
        await send(USER, STAKING, encodeFunctionData({ abi: STAKING_ABI, ...c } as Parameters<typeof encodeFunctionData>[0]));
      }
    };

    // Fund the test user with HERO from the staking contract's own balance (fork-local only).
    for (const a of [USER, STAKING]) {
      await test.setBalance({ address: a, value: 10n ** 20n });
      await test.impersonateAccount({ address: a });
    }
    await send(STAKING, hero, encodeFunctionData({ abi: ERC20, functionName: "transfer", args: [USER, parseUnits("40", 18)] }));
    await send(USER, hero, encodeFunctionData({ abi: ERC20, functionName: "approve", args: [STAKING, 2n ** 255n] }));

    async function stake(amount: bigint): Promise<bigint> {
      const before = await staked(USER);
      await send(USER, STAKING, encodeFunctionData({ abi: STAKING_ABI, functionName: "stake", args: [amount] }));
      return (await staked(USER)) - before;
    }

    // A: locked, penalty-free exit plan -> treasury +0, full principal back.
    const principalA = await stake(parseUnits("10", 18));
    check("A position is locked after stake", await isLocked(USER));
    let t0 = await bal(treasury), u0 = await bal(USER);
    await sendPlan(planPenaltyFreeExit(await earned(USER)));
    check("A treasury unchanged", (await bal(treasury)) === t0, `delta ${(await bal(treasury)) - t0}`);
    check("A full principal returned", (await bal(USER)) - u0 === principalA, `got ${(await bal(USER)) - u0} of ${principalA}`);
    check("A stake cleared", (await staked(USER)) === 0n);

    // B: the planner refuses a plain withdraw while locked (no transaction is built).
    await stake(parseUnits("10", 18));
    let refused = false;
    try { planUnstake(await isLocked(USER), parseUnits("10", 18)); } catch (e) { refused = (e as Error).message === STAKING_LOCKED_UNSTAKE_ERROR; }
    check("B locked plain unstake refused by the planner", refused);

    // C (control): what the old UI did - a raw withdraw while locked pays the penalty.
    const principalC = await staked(USER);
    t0 = await bal(treasury);
    await send(USER, STAKING, encodeFunctionData({ abi: STAKING_ABI, functionName: "withdraw", args: [principalC] }));
    const penaltyC = (await bal(treasury)) - t0;
    check("C control: raw locked withdraw pays the treasury", penaltyC > 0n, `treasury +${penaltyC}`);

    // D: unlocked, planner withdraw -> full principal, treasury +0.
    const principalD = await stake(parseUnits("10", 18));
    await test.increaseTime({ seconds: Number(lockPeriod) + 1 });
    await test.mine({ blocks: 1 });
    check("D position unlocked after lock period", !(await isLocked(USER)));
    t0 = await bal(treasury); u0 = await bal(USER);
    await sendPlan(planUnstake(await isLocked(USER), principalD));
    check("D treasury unchanged", (await bal(treasury)) === t0, `delta ${(await bal(treasury)) - t0}`);
    check("D full principal returned", (await bal(USER)) - u0 === principalD, `got ${(await bal(USER)) - u0} of ${principalD}`);

    // E: locked with DAI owed -> claimReward then emergencyWithdraw; DAI paid, treasury +0, principal back.
    // The owner restarts a small stream on the fork only, so earned() > 0.
    const dai = await pub.readContract({ address: STAKING, abi: STAKING_ABI, functionName: "daiToken" });
    const owner = await pub.readContract({ address: STAKING, abi: OWNER_ABI, functionName: "owner" });
    await test.setBalance({ address: owner, value: 10n ** 20n });
    await test.impersonateAccount({ address: owner });
    const principalE = await stake(parseUnits("10", 18));
    await send(STAKING, dai, encodeFunctionData({ abi: ERC20, functionName: "transfer", args: [owner, parseUnits("1", 18)] }));
    await send(owner, dai, encodeFunctionData({ abi: ERC20, functionName: "approve", args: [STAKING, parseUnits("1", 18)] }));
    await send(owner, STAKING, encodeFunctionData({ abi: OWNER_ABI, functionName: "notifyRewardAmount", args: [parseUnits("1", 18)] }));
    await test.increaseTime({ seconds: 3600 });
    await test.mine({ blocks: 1 });
    const owed = await earned(USER);
    check("E position locked with DAI owed", (await isLocked(USER)) && owed > 0n, `earned ${owed}`);
    const daiBal = (a: Address) => pub.readContract({ address: dai, abi: ERC20, functionName: "balanceOf", args: [a] });
    const plan = planPenaltyFreeExit(owed);
    check("E plan is claimReward then emergencyWithdraw", plan.map((c) => c.functionName).join(",") === "claimReward,emergencyWithdraw");
    t0 = await bal(treasury); u0 = await bal(USER);
    const d0 = await daiBal(USER);
    await sendPlan(plan);
    check("E treasury unchanged", (await bal(treasury)) === t0, `delta ${(await bal(treasury)) - t0}`);
    check("E full principal returned", (await bal(USER)) - u0 === principalE, `got ${(await bal(USER)) - u0} of ${principalE}`);
    check("E owed DAI claimed", (await daiBal(USER)) - d0 >= owed, `claimed ${(await daiBal(USER)) - d0}, earned ${owed}`);
  } finally {
    anvil.kill();
  }
  console.log(`RESULT ${failures === 0 ? "GREEN" : "RED"} (${failures} failed)`);
  process.exitCode = failures === 0 ? 0 : 1;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
