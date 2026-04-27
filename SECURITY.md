# Security Policy

## Reporting Vulnerabilities

If you discover a security vulnerability in this project, please report it responsibly:

1. **Do NOT** open a public issue
2. Email security concerns to the maintainer directly
3. Include steps to reproduce the vulnerability

## Security Practices

- All secrets are managed via environment variables (never committed)
- Dependencies are regularly audited via `npm audit` / `pip audit`
- Input validation is enforced on all user-facing endpoints
- Database queries use parameterized statements (ORM/prepared statements)

## Dependency Updates

Dependencies are reviewed and updated on a regular schedule. Critical security patches are applied immediately.

## Maintainer

VIC Foundation
