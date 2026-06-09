---
name: deployment-safety
origin: local-ecc-inspired
---

# Deployment Safety

Review deployment scripts and processes.

## Checklist

- Verify no private keys are hardcoded or printed.
- Check that deployment scripts use environment variables for secrets.
- Verify chain ID and network are validated before deployment.
- Check that constructor/initializer arguments are reviewed.
- Verify deployment account permissions are minimal.
- Check that post-deployment verification steps are documented.

