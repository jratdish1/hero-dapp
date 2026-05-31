/**
 * HERO Cards NFT — Deployment Script
 * 
 * Deploys to BASE mainnet (or testnet) with:
 * - BaseURI pointing to IPFS metadata folder
 * - 5% royalties to deployer
 * - Mint phase starts CLOSED (owner activates later)
 * 
 * Usage:
 *   npx hardhat run scripts/deploy.js --network base
 *   npx hardhat run scripts/deploy.js --network baseSepolia
 */

const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("═══════════════════════════════════════════════════════");
  console.log("HERO Cards NFT — Deployment");
  console.log("═══════════════════════════════════════════════════════");
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Network:  ${hre.network.name} (chainId: ${(await ethers.provider.getNetwork()).chainId})`);
  console.log(`Balance:  ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} ETH`);
  console.log("───────────────────────────────────────────────────────");

  // Configuration
  const BASE_URI = "ipfs://QmXTty8QaqP6ToahspVS3oRztpjiTkrAiAmv5ixjbPynDE/";
  const CONTRACT_URI = "ipfs://QmXTty8QaqP6ToahspVS3oRztpjiTkrAiAmv5ixjbPynDE/collection.json";
  const ROYALTY_RECEIVER = deployer.address;

  console.log(`BaseURI:          ${BASE_URI}`);
  console.log(`ContractURI:      ${CONTRACT_URI}`);
  console.log(`Royalty Receiver: ${ROYALTY_RECEIVER}`);
  console.log("───────────────────────────────────────────────────────");

  // Deploy
  console.log("\nDeploying HeroCards...");
  const HeroCards = await ethers.getContractFactory("HeroCards");
  const heroCards = await HeroCards.deploy(BASE_URI, CONTRACT_URI, ROYALTY_RECEIVER);
  await heroCards.waitForDeployment();

  const contractAddress = await heroCards.getAddress();
  console.log(`\n✓ HeroCards deployed to: ${contractAddress}`);

  // Verify deployment
  console.log("\n── Post-Deployment Verification ──");
  console.log(`Name:       ${await heroCards.name()}`);
  console.log(`Symbol:     ${await heroCards.symbol()}`);
  console.log(`Max Supply: ${await heroCards.MAX_SUPPLY()}`);
  console.log(`Mint Phase: ${await heroCards.mintPhase()} (0=CLOSED)`);
  console.log(`Mint Price: ${ethers.formatEther(await heroCards.mintPrice())} ETH`);
  console.log(`WL Price:   ${ethers.formatEther(await heroCards.whitelistPrice())} ETH`);
  console.log(`Fee Disc:   ${await heroCards.feeDiscountBps()} bps (2%)`);
  console.log(`Owner:      ${await heroCards.owner()}`);

  // Save deployment info
  const deploymentInfo = {
    network: hre.network.name,
    chainId: Number((await ethers.provider.getNetwork()).chainId),
    contractAddress,
    deployer: deployer.address,
    baseURI: BASE_URI,
    contractURI: CONTRACT_URI,
    royaltyReceiver: ROYALTY_RECEIVER,
    royaltyBps: 500,
    mintPrice: "0.005",
    whitelistPrice: "0.003",
    feeDiscountBps: 200,
    maxSupply: 1500,
    maxPerWallet: 20,
    reservedForTeam: 50,
    timestamp: new Date().toISOString(),
    txHash: heroCards.deploymentTransaction()?.hash,
  };

  const fs = require("fs");
  const path = require("path");
  const deploymentsDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(deploymentsDir)) fs.mkdirSync(deploymentsDir);
  
  const filename = `${hre.network.name}-${Date.now()}.json`;
  fs.writeFileSync(
    path.join(deploymentsDir, filename),
    JSON.stringify(deploymentInfo, null, 2)
  );
  console.log(`\n✓ Deployment info saved to deployments/${filename}`);

  // Verification instructions
  console.log("\n═══════════════════════════════════════════════════════");
  console.log("NEXT STEPS:");
  console.log("═══════════════════════════════════════════════════════");
  console.log(`1. Verify on Basescan:`);
  console.log(`   npx hardhat verify --network ${hre.network.name} ${contractAddress} "${BASE_URI}" "${CONTRACT_URI}" "${ROYALTY_RECEIVER}"`);
  console.log(`2. Set provenance hash:`);
  console.log(`   await contract.setProvenanceHash("<sha256-of-all-images>")`);
  console.log(`3. Request random seed:`);
  console.log(`   await contract.requestRandomSeed()`);
  console.log(`4. Finalize random index (next block):`);
  console.log(`   await contract.finalizeRandomStartIndex()`);
  console.log(`5. Set Merkle root for whitelist:`);
  console.log(`   await contract.setMerkleRoot("<root>")`);
  console.log(`6. Open whitelist mint:`);
  console.log(`   await contract.setMintPhase(1)`);
  console.log(`7. Open public mint:`);
  console.log(`   await contract.setMintPhase(2)`);
  console.log("═══════════════════════════════════════════════════════");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
