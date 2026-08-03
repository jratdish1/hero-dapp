-- DAO advisory-boundary policy receipt.
-- Runtime code does not depend on this table; deployment may apply it separately.
-- Binding governance remains disabled until a later audited migration explicitly enables it.

CREATE TABLE IF NOT EXISTS dao_governance_policy (
  id INT NOT NULL PRIMARY KEY,
  governance_mode ENUM('advisory', 'binding') NOT NULL DEFAULT 'advisory',
  snapshot_version INT NOT NULL DEFAULT 1,
  advisory_quorum INT NOT NULL DEFAULT 1,
  binding_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  disabled_reason VARCHAR(512) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT chk_dao_policy_singleton CHECK (id = 1),
  CONSTRAINT chk_dao_binding_receipt CHECK (
    binding_enabled = FALSE
    AND governance_mode = 'advisory'
    AND snapshot_version = 1
    AND advisory_quorum = 1
  )
);

INSERT INTO dao_governance_policy (
  id,
  governance_mode,
  snapshot_version,
  advisory_quorum,
  binding_enabled,
  disabled_reason
) VALUES (
  1,
  'advisory',
  1,
  1,
  FALSE,
  'Binding governance is disabled until verified wallet ownership, finalized historical checkpoints, and an audited execution contract are available.'
)
ON DUPLICATE KEY UPDATE
  governance_mode = VALUES(governance_mode),
  snapshot_version = VALUES(snapshot_version),
  advisory_quorum = VALUES(advisory_quorum),
  binding_enabled = VALUES(binding_enabled),
  disabled_reason = VALUES(disabled_reason);
