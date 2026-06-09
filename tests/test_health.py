"""Health and security tests for ECC A+ compliance."""
import os
import re
import glob

def test_agents_md_exists():
    assert os.path.exists("AGENTS.md"), "AGENTS.md must exist"

def test_security_md_exists():
    assert os.path.exists("SECURITY.md"), "SECURITY.md must exist"

def test_agentignore_exists():
    assert os.path.exists(".agentignore"), ".agentignore must exist"

def test_no_hardcoded_secrets():
    patterns = [
        r'(?i)(api_key|secret|password|token)\s*=\s*["\'][a-zA-Z0-9]{16,}["\']',
        r'(?i)sk-[a-zA-Z0-9]{20,}',
        r'(?i)0x[a-fA-F0-9]{64}',
    ]
    source_files = glob.glob("**/*.py", recursive=True) + glob.glob("**/*.ts", recursive=True)
    for f in source_files:
        if "node_modules" in f or "test" in f or ".git" in f:
            continue
        try:
            content = open(f).read()
            for pattern in patterns:
                matches = re.findall(pattern, content)
                assert not matches, f"Potential secret in {f}: {matches[:1]}"
        except (UnicodeDecodeError, PermissionError):
            pass

def test_threat_model_exists():
    assert os.path.exists("docs/audit/THREAT_MODEL.md"), "Threat model must exist"

def test_pr_template_exists():
    assert os.path.exists(".github/pull_request_template.md"), "PR template must exist"

if __name__ == "__main__":
    test_agents_md_exists()
    test_security_md_exists()
    test_agentignore_exists()
    test_no_hardcoded_secrets()
    test_threat_model_exists()
    test_pr_template_exists()
    print("All health tests passed!")
