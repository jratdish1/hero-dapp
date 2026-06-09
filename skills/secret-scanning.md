---
name: secret-scanning
origin: local-ecc-inspired
---

# Secret Scanning

Scan repository for accidentally committed secrets.

## Patterns to Check

- Private key blocks (PEM format)
- API keys (generic assignment patterns)
- Ethereum private keys (0x + 64 hex chars)
- GitHub tokens (ghp_, gho_, ghu_, ghs_, ghr_)
- OpenAI keys (sk-)
- AWS access keys (AKIA)
- Mnemonic phrases (12/24 word sequences)

## Prevention

- Use `.gitignore` to exclude sensitive files.
- Use `.agentignore` to prevent AI agents from reading secrets.
- Enable GitHub secret scanning on the repository.
- Use environment variables, not hardcoded values.

