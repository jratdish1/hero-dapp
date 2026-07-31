-- Rollback for HERO DAO immutable voting snapshot v2
-- Fail closed when any binding proposal exists. The intentionally missing table
-- in the blocked branch forces EXECUTE to stop before destructive column drops.
SET @vets_binding_proposal_count := (
  SELECT COUNT(*) FROM proposals WHERE governanceMode = 'binding'
);
SET @vets_rollback_guard_sql := IF(
  @vets_binding_proposal_count = 0,
  'SELECT 1',
  'SELECT * FROM __VETS_ROLLBACK_BLOCKED_BINDING_PROPOSALS_EXIST__'
);
PREPARE vets_rollback_guard FROM @vets_rollback_guard_sql;
EXECUTE vets_rollback_guard;
DEALLOCATE PREPARE vets_rollback_guard;

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
