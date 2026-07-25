#!/usr/bin/env python3
from __future__ import annotations

import importlib.util
from pathlib import Path

MODULE_PATH = Path("ops/pr56-finalize.py")
WRAPPER_PATH = "ops/pr56-finalize-v2.py"

spec = importlib.util.spec_from_file_location("pr56_finalize_base", MODULE_PATH)
if spec is None or spec.loader is None:
    raise RuntimeError("Unable to load PR56 base finalizer")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def patch_docs(source: str) -> str:
    source = module.once(
        source,
        """- GitHub API calls use bounded connection/overall timeouts and bounded retries where retrying is safe.
- Correlation-consumption POST is a single fail-closed request to avoid duplicate non-idempotent authorization records.
""",
        """- GitHub API calls use bounded connection/overall timeouts and bounded retries where retrying is safe.
- Issue #43 comments are paginated to exhaustion; reaching the bounded safety ceiling fails closed instead of silently truncating correlation evidence.
- Authorization-marker creation reconciles an accepted-but-response-lost POST from exact bot-authored Issue evidence before any bounded retry, and requires exactly one matching marker.
- Deploy and rollback correlations remain single-use and fail closed on duplicate exact authorization markers.
""",
        "docs pagination and idempotency",
    )
    source = module.once(
        source,
        """- exact target `push` CI and repository-safety workflow/job success;
- ancestor relationship for intentional rollback.
""",
        """- exact target `push` CI and repository-safety workflow/job success;
- preservation of the exact selected CI and Security workflow run IDs in the authorization marker, immutable result, and final receipt;
- ancestor relationship for intentional rollback.
""",
        "docs authorization run IDs",
    )
    source = module.once(
        source,
        """The immutable artifact is controlling evidence. It records whether the final Issue receipt posted successfully; a transient comment-API failure does not roll back an otherwise exact-SHA-verified application release.
""",
        """The immutable artifact is controlling evidence. It records whether the final Issue receipt posted successfully; a transient comment-API failure does not roll back an otherwise exact-SHA-verified application release, but the workflow remains incomplete until the final receipt is durably posted.
""",
        "docs receipt enforcement",
    )
    source = module.once(
        source,
        """- receipt-posted boolean and receipt step outcome;
- final verified boolean.
""",
        """- receipt-posted boolean and receipt step outcome;
- exact CI and Security authorization workflow run IDs;
- final verified boolean.
""",
        "docs immutable authorization evidence",
    )
    source = module.once(
        source,
        """A transient Issue-comment failure does not trigger application rollback and does not erase exact production truth; it is recorded as `receipt_posted: false` in the mandatory artifact.
""",
        """A transient Issue-comment failure does not trigger application rollback and does not erase exact production truth; it is recorded as `receipt_posted: false` in the mandatory artifact, and final workflow enforcement remains incomplete until receipt delivery succeeds.
""",
        "docs receipt truth",
    )
    return source


original_api = module.api


def api_with_wrapper_cleanup(method: str, path: str, payload=None):
    if method == "POST" and path == "/git/trees" and isinstance(payload, dict):
        entries = list(payload.get("tree", []))
        entries.append({
            "path": WRAPPER_PATH,
            "mode": "100644",
            "type": "blob",
            "sha": None,
        })
        payload = dict(payload)
        payload["tree"] = entries
    return original_api(method, path, payload)


module.patch_docs = patch_docs
module.api = api_with_wrapper_cleanup
module.main()
