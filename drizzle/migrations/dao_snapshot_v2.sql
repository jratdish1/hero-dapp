-- HERO DAO immutable voting snapshot v2
-- Existing proposals remain advisory version 1. New verified binding proposals
-- explicitly write snapshotVersion = 2 from the application.
ALTER TABLE proposals
  ADD COLUMN governanceMode ENUM('advisory','binding') NOT NULL DEFAULT 'advisory' AFTER endTime,
  ADD COLUMN snapshotVersion INT NOT NULL DEFAULT 1 AFTER governanceMode,
  ADD COLUMN snapshotConfirmations INT NULL AFTER snapshotVersion,
  ADD COLUMN snapshotBaseBlock BIGINT NULL AFTER snapshotConfirmations,
  ADD COLUMN snapshotPulsechainBlock BIGINT NULL AFTER snapshotBaseBlock,
  ADD COLUMN snapshotBaseTotalSupply VARCHAR(78) NULL AFTER snapshotPulsechainBlock,
  ADD COLUMN snapshotPulsechainTotalSupply VARCHAR(78) NULL AFTER snapshotBaseTotalSupply,
  ADD COLUMN snapshotVerifiedAt TIMESTAMP NULL AFTER snapshotPulsechainTotalSupply,
  ADD COLUMN bindingDisabledReason VARCHAR(512) NULL AFTER snapshotVerifiedAt;

UPDATE proposals
SET governanceMode = 'advisory',
    snapshotVersion = 1,
    bindingDisabledReason = COALESCE(bindingDisabledReason, 'Legacy proposal without a verified historical snapshot')
WHERE snapshotBaseBlock IS NULL AND snapshotPulsechainBlock IS NULL;
