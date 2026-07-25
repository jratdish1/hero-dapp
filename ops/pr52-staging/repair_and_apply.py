#!/usr/bin/env python3
from __future__ import annotations

import base64
import binascii
import hashlib
from pathlib import Path

import apply_pr52


def exact_reconstruct(pattern: str, output: Path) -> bytes:
    chunks = sorted(Path("ops/pr52-staging").glob(pattern))
    if not chunks:
        raise RuntimeError(f"No chunks matched {pattern}")
    encoded = "".join(path.read_text().strip() for path in chunks)
    expected = apply_pr52.EXPECTED[output.name]

    try:
        data = base64.b64decode(encoded, validate=True)
    except binascii.Error as original:
        if len(encoded) % 4 != 1:
            raise RuntimeError(f"{pattern}: Base64 is invalid and not a one-extra-character case") from original
        matches: list[tuple[int, str, bytes]] = []
        for index, character in enumerate(encoded):
            candidate = encoded[:index] + encoded[index + 1 :]
            try:
                decoded = base64.b64decode(candidate, validate=True)
            except binascii.Error:
                continue
            if hashlib.sha256(decoded).hexdigest() == expected:
                matches.append((index, character, decoded))
        if len(matches) != 1:
            raise RuntimeError(
                f"{pattern}: expected exactly one SHA-verified one-character repair, found {len(matches)}"
            ) from original
        index, character, data = matches[0]
        print(f"SHA-verified Base64 repair: {pattern}; removed character {character!r} at offset {index}")

    digest = hashlib.sha256(data).hexdigest()
    if digest != expected:
        raise RuntimeError(f"{pattern}: decoded SHA-256 mismatch: {digest}")
    output.write_bytes(data)
    return data


apply_pr52.reconstruct = exact_reconstruct
apply_pr52.DELETE_PATHS.append("ops/pr52-staging/repair_and_apply.py")
apply_pr52.main()
