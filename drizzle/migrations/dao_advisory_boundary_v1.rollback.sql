-- Fail-closed rollback for DAO advisory policy versioning.
-- Run only with the application stopped in the approved single-writer lane.
-- Any advisory/binding proposal blocks rollback so policy history is never
-- stripped from records that were created under the new semantics.

DROP PROCEDURE IF EXISTS rollback_dao_advisory_boundary_v1;

DELIMITER $$
CREATE PROCEDURE rollback_dao_advisory_boundary_v1()
BEGIN
  DECLARE total_receipts INT DEFAULT 0;
  DECLARE unsafe_receipts INT DEFAULT 0;
  DECLARE governed_proposals INT DEFAULT 0;

  SELECT COUNT(*) INTO total_receipts
  FROM dao_governance_policy;

  SELECT COUNT(*) INTO unsafe_receipts
  FROM dao_governance_policy
  WHERE id <> 1
     OR binding_enabled <> FALSE
     OR governance_mode <> 'advisory'
     OR snapshot_version <> 1;

  SELECT COUNT(*) INTO governed_proposals
  FROM proposals
  WHERE governanceMode <> 'legacy'
     OR snapshotVersion <> 0;

  IF total_receipts <> 1 OR unsafe_receipts <> 0 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Refusing rollback: DAO policy receipt is missing or unsafe';
  END IF;

  IF governed_proposals <> 0 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Refusing rollback: advisory/binding proposal records would lose policy history';
  END IF;

  ALTER TABLE proposals
    DROP COLUMN bindingDisabledReason,
    DROP COLUMN snapshotVersion,
    DROP COLUMN governanceMode,
    MODIFY COLUMN status ENUM('pending', 'active', 'passed', 'defeated', 'queued', 'executed', 'cancelled') NOT NULL DEFAULT 'pending',
    MODIFY COLUMN quorum BIGINT NOT NULL DEFAULT 5000000;

  DROP TABLE dao_governance_policy;
END$$
DELIMITER ;

CALL rollback_dao_advisory_boundary_v1();
DROP PROCEDURE rollback_dao_advisory_boundary_v1;
