#!/usr/bin/env python3
"""
Update data/characters.ts Descriptions from 50 random samples of nvidia/Nemotron-Personas.

Usage:
  - Dry run (print schema and sample):
      python scripts/update_personas.py --inspect
  - Write changes to data/characters.ts:
      python scripts/update_personas.py --write

Respects user rule: use conda environment when invoking from shell.
"""
from __future__ import annotations

import argparse
import json
import os
import random
import re
import sys
from typing import Any, Dict, List, Tuple

try:
    from datasets import load_dataset  # type: ignore
except Exception as e:  # pragma: no cover
    print("ERROR: Failed to import datasets. Install with: pip install datasets", file=sys.stderr)
    raise


REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), os.pardir))
CHARACTERS_TS_PATH = os.path.join(REPO_ROOT, "data", "characters.ts")


def load_random_personas(count: int = 50, seed: int = 42) -> List[Dict[str, Any]]:
    ds = load_dataset("nvidia/Nemotron-Personas", split="train")
    # Shuffle deterministically, then take first N
    ds = ds.shuffle(seed=seed)
    subset = ds.select(range(min(count, len(ds))))
    return [dict(item) for item in subset]


def _extract_name_from_text(text: str) -> str | None:
    if not text:
        return None
    # Patterns focused on leading name before a comma
    m = re.match(r"^([A-Z][a-z]+(?: [A-Z][a-z]+){0,2}),\b", text)
    if m:
        name = m.group(1)
        if name not in {"They", "A", "An"}:
            return name
    # Fallback: take any text before the first comma
    m = re.match(r"^([^,]+),", text)
    if m:
        name = m.group(1).strip()
        return name
    return None


def guess_name(p: Dict[str, Any]) -> str:
    # Direct fields first
    for key in ("name", "full_name", "fullname"):
        if key in p and isinstance(p[key], str) and p[key].strip():
            return p[key].strip()
    first = p.get("first_name") or p.get("firstname") or p.get("given_name")
    last = p.get("last_name") or p.get("lastname") or p.get("family_name")
    if isinstance(first, str) and isinstance(last, str):
        cand = f"{first} {last}".strip()
        if cand:
            return cand
    # Try to infer from narrative fields (persona first, then professional)
    persona_text = p.get("persona")
    if isinstance(persona_text, str):
        name = _extract_name_from_text(persona_text)
        if name:
            return name
    professional_text = p.get("professional_persona")
    if isinstance(professional_text, str):
        name = _extract_name_from_text(professional_text)
        if name:
            return name
    # Fallback to an identifier-like name
    if "id" in p and isinstance(p["id"], (str, int)):
        return f"Persona {p['id']}"
    return "Unnamed Persona"


def guess_plan(p: Dict[str, Any]) -> str:
    # Per requirement: prefer exact career_goals_and_ambitions content as plan
    val = p.get("career_goals_and_ambitions")
    if isinstance(val, str) and val.strip():
        return val.strip()
    # Fallbacks
    candidate_keys = [
        "goals_and_aspirations",
        "long_term_goals_and_aspirations",
        "life_goals",
        "personal_goals",
        "short_term_goals",
        "goals",
        "motivations",
        "purpose",
    ]
    for key in candidate_keys:
        v = p.get(key)
        if isinstance(v, str) and v.strip():
            return v.strip()
    return ""


def to_ts_string_literal(s: str) -> str:
    # Prefer single-quoted TS string; escape backslashes and single quotes
    return "'" + s.replace("\\", "\\\\").replace("'", "\\'") + "'"


def build_descriptions_ts(personas: List[Dict[str, Any]]) -> str:
    # Round-robin assign sprite character names f1..f8
    sprite_names = [f"f{i}" for i in range(1, 9)]
    entries: List[str] = []
    for idx, p in enumerate(personas):
        name = guess_name(p)
        character = sprite_names[idx % len(sprite_names)]
        identity_json = json.dumps(p, ensure_ascii=False)
        plan = guess_plan(p)
        entry = (
            "  {\n"
            f"    name: {to_ts_string_literal(name)},\n"
            f"    character: {to_ts_string_literal(character)},\n"
            f"    identity: {to_ts_string_literal(identity_json)},\n"
            f"    plan: {to_ts_string_literal(plan)},\n"
            "  },"
        )
        entries.append(entry)
    return "\n".join(entries)


def replace_descriptions_block(ts_source: str, new_block: str) -> Tuple[str, bool]:
    # Replace content within export const Descriptions = [ ... ];
    pattern = re.compile(
        r"(export\s+const\s+Descriptions\s*=\s*\[)([\s\S]*?)(\];)", re.MULTILINE
    )
    m = pattern.search(ts_source)
    if not m:
        return ts_source, False
    before, _, after = m.group(1), m.group(2), m.group(3)
    replacement = before + "\n" + new_block + "\n" + after
    return ts_source[: m.start()] + replacement + ts_source[m.end() :], True


def write_characters_ts(personas: List[Dict[str, Any]]) -> None:
    with open(CHARACTERS_TS_PATH, "r", encoding="utf-8") as f:
        src = f.read()
    new_entries = build_descriptions_ts(personas)
    new_src, ok = replace_descriptions_block(src, new_entries)
    if not ok:
        raise RuntimeError("Failed to locate Descriptions array in data/characters.ts")
    with open(CHARACTERS_TS_PATH, "w", encoding="utf-8") as f:
        f.write(new_src)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--write", action="store_true", help="Write updates to data/characters.ts")
    parser.add_argument("--inspect", action="store_true", help="Print dataset schema and a sample")
    parser.add_argument("--count", type=int, default=50, help="Number of personas to sample")
    parser.add_argument("--seed", type=int, default=42, help="Shuffle seed for reproducibility")
    args = parser.parse_args()

    personas = load_random_personas(count=args.count, seed=args.seed)

    if args.inspect:
        # Print schema keys intersection across a small subset
        sample = personas[:3]
        print("Fields in first sample:")
        if sample:
            print(sorted(sample[0].keys()))
        print("\nName/Plan guesses:")
        for i, p in enumerate(sample):
            print(f"#{i+1} name=", guess_name(p))
            print(f"   plan=", guess_plan(p))
        return

    if args.write:
        write_characters_ts(personas)
        print(f"Wrote {len(personas)} personas into data/characters.ts Descriptions")
    else:
        # Default to write to be useful in CI-less local runs
        write_characters_ts(personas)
        print(f"Wrote {len(personas)} personas into data/characters.ts Descriptions")


if __name__ == "__main__":
    main()


