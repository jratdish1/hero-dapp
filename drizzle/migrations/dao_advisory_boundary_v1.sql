-- DAO advisory-boundary policy, per-proposal policy versioning, and permanent
-- one-account-per-wallet binding. Run once through the approved single-writer
-- database migration lane with the application stopped. Any pre-existing or
-- partial policy object, drifted index, or duplicate wallet binding fails closed
-- for manual reconciliation instead of being silently accepted.
--
-- Database defaults intentionally remain legacy-safe. New advisory-v1 records
-- set every policy/status/quorum field explicitly in application code. If the
-- application is rolled back while the additive columns remain, older code can
-- only create legacy/0 proposals rather than silently creating advisory records
-- under token-weighted semantics.

DROP PROCEDURE IF EXISTS install_dao_advisory_boundary_v1;

DELIMITER $$
CREATE PROCEDURE install_dao_advisory_boundary_v1()
BEGIN
  DECLARE policy_tables INT DEFAULT 0;
  DECLARE proposal_policy_columns INT DEFAULT 0;
  DECLARE wallet_index_rows INT DEFAULT 0;
  DECLARE duplicate_wallet_groups INT DEFAULT 0;

  SELECT COUNT(*) INTO policy_tables
  FROM information_schema.tables
  WHERE table_schema = DATABASE()
    AND table_name = 'dao_governance_policy';

  SELECT COUNT(*) INTO proposal_policy_columns
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'proposals'
    AND column_name IN ('governanceMode', 'snapshotVersion', 'bindingDisabledReason');

  SELECT COUNT(*) INTO wallet_index_rows
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'users'
    AND index_name = 'ux_users_wallet_address';

  SELECT COUNT(*) INTO duplicate_wallet_groups
  FROM (
    SELECT LOWER(walletAddress) AS normalized_wallet
    FROM users
    WHERE walletAddress IS NOT NULL
    GROUP BY LOWER(walletAddress)
    HAVING COUNT(*) > 1
  ) AS duplicate_wallets;

  IF policy_tables <> 0 OR proposal_policy_columns <> 0 OR wallet_index_rows <> 0 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Refusing DAO v1 install: partial or prior governance policy objects require manual reconciliation';
  END IF;

  IF duplicate_wallet_groups <> 0 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Refusing DAO v1 install: duplicate bound wallets require manual reconciliation';
  END IF;

  UPDATE users
  SET walletAddress = LOWER(walletAddress)
  WHERE walletAddress IS NOT NULL;

  ALTER TABLE users
    ADD UNIQUE INDEX ux_users_wallet_address (walletAddress);

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

  ALTER TABLE proposals
    ADD COLUMN governanceMode ENUM('legacy', 'advisory', 'binding') NOT NULL DEFAULT 'legacy',
    ADD COLUMN snapshotVersion INT NOT NULL DEFAULT 0,
    ADD COLUMN bindingDisabledReason VARCHAR(512) NOT NULL DEFAULT
      'This legacy proposal is frozen because it predates the advisory policy receipt and may contain token-weighted or on-chain-anchored state.';

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
