-- Fail-closed rollback for the DAO advisory-boundary policy receipt.
-- Hold the table lock across verification and destructive DDL so the receipt
-- cannot be enabled or changed between the guard and drop.

LOCK TABLES dao_governance_policy WRITE;

DELIMITER $$
CREATE PROCEDURE rollback_dao_advisory_boundary_v1()
BEGIN
  DECLARE unsafe_rows INT DEFAULT 0;
  SELECT COUNT(*) INTO unsafe_rows
  FROM dao_governance_policy
  WHERE binding_enabled <> FALSE
     OR governance_mode <> 'advisory'
     OR snapshot_version <> 1;

  IF unsafe_rows <> 0 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Refusing rollback: DAO binding policy is not safely disabled';
  END IF;

  DROP TABLE dao_governance_policy;
END$$
DELIMITER ;

CALL rollback_dao_advisory_boundary_v1();
DROP PROCEDURE rollback_dao_advisory_boundary_v1;
UNLOCK TABLES;
