// Hardhat 3 ESM config for V2 local unit testing
// Date: 2026-06-18 17:30 PDT
// Scope: Local compile and unit tests only. No deployment.
import hardhatToolboxMochaEthers from "@nomicfoundation/hardhat-toolbox-mocha-ethers";

const config = {
  plugins: [hardhatToolboxMochaEthers],
  solidity: {
    version: "0.8.26",
    settings: {
      evmVersion: "cancun",
      optimizer: { enabled: true, runs: 200 },
      viaIR: true,
    },
  },
  networks: {
    hardhat: { type: "edr-simulated", chainId: 8453 },
  },
  paths: {
    sources: "./contracts/v2",
    tests: "./test/v2",
    cache: "./cache-v2",
    artifacts: "./artifacts-v2",
  },
};

export default config;
