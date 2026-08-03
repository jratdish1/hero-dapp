-- DAO advisory-boundary policy and per-proposal policy versioning.
-- Run once through the approved single-writer database migration lane with the
-- application stopped. Any pre-existing/partial object fails closed for manual
-- reconciliation instead of being silently accepted.

DROP PROCEDURE IF EXISTS install_dao_advisory_boundary_v1;

DELIMITER $$
CREATE PROCEDURE install_dao_advisory_boundary_v1()
BEGIN
  DECLARE policy_tables INT DEFAULT 0;
  DECLARE proposal_policy_columns INT DEFAULT 0;

  SELECT COUNT(*) INTO policy_tables
  FROM information_schema.tables
  WHERE table_schema = DATABASE()
    AND table_name = 'dao_governance_policy';

  SELECT COUNT(*) INTO proposal_policy_columns
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'proposals'
    AND column_name IN ('governanceMode', 'snapshotVersion', 'bindingDisabledReason');

  IF policy_tables <> 0 OR proposal_policy_columns <> 0 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Refusing DAO v1 install: partial or prior governance policy objects require manual reconciliation';
  END IF;

  CREATE TABLE dao_governance_policy (
    id INT NOT NULL PRIMARY KEY,
    governance_mode ENUM('advisory', 'binding') NOT NULL DEFAULT 'advisory',
    snapshot_version INT NOT NULL DEFAULT 1,
    binding_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    disabled_reason VARCHAR(512) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT chk_dao_policy_singleton CHECK (id = 1),
    CONSTRAINT chk_dao_binding_receipt CHECK (
      binding_enabled = FALSE
      AND governance_mode = 'advisory'
      AND snapshot_version = 1
    )
  );

  -- New columns initially default to legacy so every pre-existing row is frozen.
  ALTER TABLE proposals
    ADD COLUMN governanceMode ENUM('legacy', 'advisory', 'binding') NOT NULL DEFAULT 'legacy',
    ADD COLUMN snapshotVersion INT NOT NULL DEFAULT 0,
    ADD COLUMN bindingDisabledReason VARCHAR(512) NOT NULL DEFAULT
      'This legacy proposal is frozen because it predates the advisory policy receipt and may contain token-weighted or on-chain-anchored state.';

  -- Future inserts are explicit advisory-v1 records with a one-vote quorum and
  -- an active voting window; existing rows retain legacy/0 and their old values.
  ALTER TABLE proposals
    MODIFY COLUMN governanceMode ENUM('legacy', 'advisory', 'binding') NOT NULL DEFAULT 'advisory',
    MODIFY COLUMN snapshotVersion INT NOT NULL DEFAULT 1,
    MODIFY COLUMN bindingDisabledReason VARCHAR(512) NOT NULL DEFAULT
      'Binding governance is disabled until verified wallet ownership, finalized historical checkpoints, and an audited execution contract are available.',
    MODIFY COLUMN status ENUM('pending', 'active', 'passed', 'defeated', 'queued', 'executed', 'cancelled') NOT NULL DEFAULT 'active',
    MODIFY COLUMN quorum BIGINT NOT NULL DEFAULT 1;

  INSERT INTO dao_governance_policy (
    id,
    governance_mode,
    snapshot_version,
    binding_enabled,
    disabled_reason
  ) VALUES (
    1,
    'advisory',
    1,
    FALSE,
    'Binding governance is disabled until verified wallet ownership, finalized historical checkpoints, and an audited execution contract are available.'
  );
END$$
DELIMITER ;

CALL install_dao_advisory_boundary_v1();
DROP PROCEDURE install_dao_advisory_boundary_v1;
