-- Fail-closed rollback for DAO advisory policy versioning.
-- Run only with the application stopped in the approved single-writer lane.
-- Any advisory/binding proposal blocks rollback so policy history is never
-- stripped from records that were created under the new semantics. The unique
-- normalized wallet index is deliberately retained because permanent account
-- identity must not become ambiguous after an application rollback.

DROP PROCEDURE IF EXISTS rollback_dao_advisory_boundary_v1;

DELIMITER $$
CREATE PROCEDURE rollback_dao_advisory_boundary_v1()
BEGIN
  DECLARE total_receipts INT DEFAULT 0;
  DECLARE unsafe_receipts INT DEFAULT 0;
  DECLARE governed_proposals INT DEFAULT 0;
  DECLARE wallet_index_rows INT DEFAULT 0;
  DECLARE duplicate_wallet_groups INT DEFAULT 0;

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

  SELECT COUNT(*) INTO wallet_index_rows
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'users'
    AND index_name = 'ux_users_wallet_address'
    AND column_name = 'walletAddress'
    AND seq_in_index = 1
    AND non_unique = 0;

  SELECT COUNT(*) INTO duplicate_wallet_groups
  FROM (
    SELECT LOWER(walletAddress) AS normalized_wallet
    FROM users
    WHERE walletAddress IS NOT NULL
    GROUP BY LOWER(walletAddress)
    HAVING COUNT(*) > 1
  ) AS duplicate_wallets;

  IF total_receipts <> 1 OR unsafe_receipts <> 0 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Refusing rollback: DAO policy receipt is missing or unsafe';
  END IF;

  IF governed_proposals <> 0 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Refusing rollback: advisory/binding proposal records would lose policy history';
  END IF;

  IF wallet_index_rows <> 1 OR duplicate_wallet_groups <> 0 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Refusing rollback: permanent wallet binding invariant is missing or unsafe';
  END IF;

  ALTER TABLE proposals
    DROP COLUMN bindingDisabledReason,
    DROP COLUMN snapshotVersion,
    DROP COLUMN governanceMode;

  DROP TABLE dao_governance_policy;
END$$
DELIMITER ;

CALL rollback_dao_advisory_boundary_v1();
DROP PROCEDURE rollback_dao_advisory_boundary_v1;
