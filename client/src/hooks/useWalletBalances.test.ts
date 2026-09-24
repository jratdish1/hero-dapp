import { describe, expect, it } from "vitest";
import { custom, encodeFunctionResult, erc20Abi, multicall3Abi } from "viem";
import { createChainClient } from "./useWalletBalances";

const HOLDER = "0x00000000000000000000000000000000000000a1" as const;
const TOKEN = "0x00000000000000000000000000000000000000b2" as const;
const MULTICALL3 = "0xca11bde05977b3631167028862be2a173976ca11";

/** Transport that answers Multicall3.aggregate3 with one successful balanceOf = 1234. */
function fakeMulticallTransport(seen: string[]) {
  return custom({
    async request({ method, params }: { method: string; params?: unknown }) {
      if (method !== "eth_call") throw new Error(`unexpected RPC ${method}`);
      const [call] = params as [{ to: string }];
      seen.push(call.to.toLowerCase());
      const balance = encodeFunctionResult({ abi: erc20Abi, functionName: "balanceOf", result: 1234n });
      return encodeFunctionResult({
        abi: multicall3Abi,
        functionName: "aggregate3",
        result: [{ success: true, returnData: balance }],
      });
    },
  });
}

describe("createChainClient (token scanning regression, 2026-09-24)", () => {
  it.each([8453, 369] as const)("chain %i client knows its chain and the Multicall3 address", (chainId) => {
    const client = createChainClient(chainId, fakeMulticallTransport([]));
    expect(client.chain?.id).toBe(chainId);
    expect(client.chain?.contracts?.multicall3?.address?.toLowerCase()).toBe(MULTICALL3);
  });

  it.each([8453, 369] as const)("chain %i multicall reads an ERC-20 balance instead of throwing", async (chainId) => {
    const seen: string[] = [];
    const client = createChainClient(chainId, fakeMulticallTransport(seen));
    const [res] = await client.multicall({
      contracts: [{ address: TOKEN, abi: erc20Abi, functionName: "balanceOf", args: [HOLDER] }],
    });
    expect(res.status).toBe("success");
    expect(res.result).toBe(1234n);
    expect(seen).toEqual([MULTICALL3]);
  });
});
