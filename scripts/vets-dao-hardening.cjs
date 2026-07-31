const fs = require("node:fs");

function replaceOnce(text, oldValue, newValue, label) {
  const count = text.split(oldValue).length - 1;
  if (count !== 1) {
    throw new Error(`${label}: expected exactly one match, found ${count}`);
  }
  return text.replace(oldValue, newValue);
}

const schemaPath = "drizzle/schema.ts";
let schema = fs.readFileSync(schemaPath, "utf8");
schema = replaceOnce(
  schema,
  '  snapshotVersion: int("snapshotVersion").default(2).notNull(),',
  '  snapshotVersion: int("snapshotVersion").default(1).notNull(),',
  "legacy snapshot schema default",
);
fs.writeFileSync(schemaPath, schema);

const routerPath = "server/routers.ts";
let router = fs.readFileSync(routerPath, "utf8");

router = replaceOnce(
  router,
  "  parseFinalityBlocks,\n  resolveBindingVoteChain,",
  "  parseFinalityBlocks,\n  requireBindingVotingEnabled,\n  resolveBindingVoteChain,",
  "policy import",
);
router = replaceOnce(
  router,
  'const DAO_BINDING_VOTING_ENABLED = process.env.DAO_BINDING_VOTING_ENABLED === "true";\n',
  "",
  "boot-time feature flag",
);
router = replaceOnce(
  router,
  "async function captureBindingSnapshot(chain: VoteChain) {",
  "async function captureBindingSnapshot(chain: VoteChain, proposerAddress: string) {",
  "snapshot capability signature",
);
router = replaceOnce(
  router,
  `  const totalSupply = await withRpcTimeout(chain, client.readContract({
    address: HERO_TOKENS[chain],
    abi: HISTORICAL_VOTES_ABI,
    functionName: "getPastTotalSupply",
    args: [block],
  }));`,
  `  const [totalSupply] = await Promise.all([
    withRpcTimeout(chain, client.readContract({
      address: HERO_TOKENS[chain],
      abi: HISTORICAL_VOTES_ABI,
      functionName: "getPastTotalSupply",
      args: [block],
    })),
    withRpcTimeout(chain, client.readContract({
      address: HERO_TOKENS[chain],
      abi: HISTORICAL_VOTES_ABI,
      functionName: "getPastVotes",
      args: [proposerAddress as \`0x\${string}\`, block],
    })),
  ]);`,
  "historical token capability probe",
);
router = replaceOnce(
  router,
  `            if (!DAO_BINDING_VOTING_ENABLED) {
              createStandardError("PRECONDITION_FAILED", "Binding DAO voting is feature-fenced until snapshot capability is enabled");
            }`,
  `            try {
              requireBindingVotingEnabled(process.env.DAO_BINDING_VOTING_ENABLED);
            } catch (error) {
              createStandardError("PRECONDITION_FAILED", error instanceof Error ? error.message : "Binding DAO voting is disabled");
            }`,
  "proposal creation feature gate",
);
router = replaceOnce(
  router,
  "              const snapshot = await captureBindingSnapshot(proposalChain);",
  "              const snapshot = await captureBindingSnapshot(proposalChain, input.walletAddress);",
  "snapshot capability call",
);
router = replaceOnce(
  router,
  `        .mutation(async ({ ctx, input }) => {
          // AUDIT FIX 1.4: Verify wallet address belongs to authenticated user`,
  `        .mutation(async ({ ctx, input }) => {
          const proposal = await getProposalById(input.proposalId);
          if (!proposal) createStandardError("NOT_FOUND", "Proposal not found");
          if (proposal.id !== input.proposalDbId) {
            createStandardError("BAD_REQUEST", "Proposal database and public identifiers do not match");
          }

          // AUDIT FIX 1.4: Verify wallet address belongs to authenticated user`,
  "proposal validation before wallet binding",
);
router = replaceOnce(
  router,
  `          const proposal = await getProposalById(input.proposalId);
          if (!proposal) createStandardError("NOT_FOUND", "Proposal not found");
          if (proposal.id !== input.proposalDbId) {
            createStandardError("BAD_REQUEST", "Proposal database and public identifiers do not match");
          }
          const existing = await getUserVote(input.proposalDbId, ctx.user.id);`,
  "          const existing = await getUserVote(input.proposalDbId, ctx.user.id);",
  "remove duplicate proposal lookup",
);
router = replaceOnce(
  router,
  `          if (proposal.governanceMode === "binding") {
            let boundChain: VoteChain;`,
  `          if (proposal.governanceMode === "binding") {
            try {
              requireBindingVotingEnabled(process.env.DAO_BINDING_VOTING_ENABLED);
            } catch (error) {
              createStandardError("PRECONDITION_FAILED", error instanceof Error ? error.message : "Binding DAO voting is disabled");
            }
            let boundChain: VoteChain;`,
  "vote-time feature gate",
);

fs.writeFileSync(routerPath, router);
console.log("DAO_TRUST_HARDENING_APPLIED");
