-- Fail-closed rollback for the DAO advisory-boundary policy receipt.
-- Hold an exclusive table lock while validating the singleton receipt before
-- removing it. Run only through the approved database migration lane.

LOCK TABLES dao_governance_policy WRITE;

DELIMITER $$
CREATE PROCEDURE rollback_dao_advisory_boundary_v1()
BEGIN
  DECLARE total_rows INT DEFAULT 0;
  DECLARE unsafe_rows INT DEFAULT 0;

  SELECT COUNT(*) INTO total_rows
  FROM dao_governance_policy;

  SELECT COUNT(*) INTO unsafe_rows
  FROM dao_governance_policy
  WHERE id <> 1
     OR binding_enabled <> FALSE
     OR governance_mode <> 'advisory'
     OR snapshot_version <> 1;

  IF total_rows <> 1 OR unsafe_rows <> 0 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Refusing rollback: DAO advisory policy receipt is missing or unsafe';
  END IF;

  DROP TABLE dao_governance_policy;
END$$
DELIMITER ;

CALL rollback_dao_advisory_boundary_v1();
DROP PROCEDURE rollback_dao_advisory_boundary_v1;
UNLOCK TABLES;
