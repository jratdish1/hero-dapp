-- Rollback for HERO DAO immutable voting snapshot v2
-- Run only after confirming no binding proposals exist.
ALTER TABLE proposals
  DROP COLUMN bindingDisabledReason,
  DROP COLUMN snapshotVerifiedAt,
  DROP COLUMN snapshotPulsechainTotalSupply,
  DROP COLUMN snapshotBaseTotalSupply,
  DROP COLUMN snapshotPulsechainBlock,
  DROP COLUMN snapshotBaseBlock,
  DROP COLUMN snapshotConfirmations,
  DROP COLUMN snapshotVersion,
  DROP COLUMN governanceMode;
