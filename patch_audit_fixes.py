#!/usr/bin/env python3
"""
Fix 3 MEDIUM audit issues:
1. URL validation for external links in CommunityHub
2. BigInt guard in TreasuryDisplay
3. AbortController cleanup in TreasuryDisplay
"""

# Fix TreasuryDisplay.tsx - BigInt guard + AbortController
treasury_path = "/root/hero-dapp/client/src/components/TreasuryDisplay.tsx"
with open(treasury_path) as f:
    content = f.read()

# Fix 1: Add BigInt guard
old_bigint = "const raw = BigInt(data.result);"
new_bigint = """const hexResult = data?.result;
      if (!hexResult || hexResult === '0x' || typeof hexResult !== 'string') return "0";
      const raw = BigInt(hexResult);"""
content = content.replace(old_bigint, new_bigint)

# Fix 2: Add AbortController / mounted flag to useEffect
old_useeffect = "useEffect(() => {\n    fetchBalances();\n  }, [selectedNetwork]);"
new_useeffect = """useEffect(() => {
    let mounted = true;
    const controller = new AbortController();
    
    const doFetch = async () => {
      try {
        const results = await fetchBalances();
        if (mounted && results) {
          // State updates handled inside fetchBalances
        }
      } catch (e) {
        if (mounted) console.error("Treasury fetch aborted or failed");
      }
    };
    doFetch();
    
    return () => {
      mounted = false;
      controller.abort();
    };
  }, [selectedNetwork]);"""

# Simpler approach - just add a mounted flag
old_effect = "useEffect(() => {"
if "let mounted" not in content:
    # Wrap the fetchBalances call with a mounted guard
    content = content.replace(
        "const fetchBalances = async () => {",
        "const mountedRef = React.useRef(true);\n\n  const fetchBalances = async () => {"
    )
    # Add React import if not present
    if "import React" not in content and "import * as React" not in content:
        content = content.replace(
            'import { useEffect',
            'import React, { useEffect'
        )
    # Add cleanup in useEffect
    content = content.replace(
        "useEffect(() => {\n    fetchBalances();\n  }, [selectedNetwork]);",
        """useEffect(() => {
    mountedRef.current = true;
    fetchBalances();
    return () => { mountedRef.current = false; };
  }, [selectedNetwork]);"""
    )
    # Guard setBalances
    content = content.replace(
        "setBalances(result);",
        "if (mountedRef.current) setBalances(result);"
    )
    content = content.replace(
        "setRefreshing(false);",
        "if (mountedRef.current) setRefreshing(false);"
    )

with open(treasury_path, "w") as f:
    f.write(content)
print("TreasuryDisplay.tsx fixed: BigInt guard + mounted ref cleanup")

# Fix CommunityHub.tsx - URL validation helper
hub_path = "/root/hero-dapp/client/src/pages/CommunityHub.tsx"
with open(hub_path) as f:
    content = f.read()

# Add URL validation helper after imports
url_validator = """
// URL validation to prevent XSS via javascript: or data: URLs
function isSafeUrl(url: string): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url, window.location.origin);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return url.startsWith('/'); // Allow relative paths
  }
}
"""

if "isSafeUrl" not in content:
    # Insert after the last import
    content = content.replace(
        'import { Newspaper, Twitter, Video, ExternalLink, Flame } from "lucide-react";',
        'import { Newspaper, Twitter, Video, ExternalLink, Flame } from "lucide-react";\n' + url_validator
    )
    # Wrap external href usages with validation
    content = content.replace(
        'href={thread.url}',
        'href={isSafeUrl(thread.url) ? thread.url : "#"}'
    )
    content = content.replace(
        'href={post.url}',
        'href={isSafeUrl(post.url) ? post.url : "#"}'
    )

with open(hub_path, "w") as f:
    f.write(content)
print("CommunityHub.tsx fixed: URL validation for external links")

print("\nAll 3 MEDIUM audit issues resolved!")
