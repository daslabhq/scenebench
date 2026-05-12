"""
One-time exporter: AutomationBench Pydantic schemas → JSON Schema files,
plus all task definitions → JSON files.

Run this whenever AutomationBench updates their schemas/tasks. The output
is checked into scene-bench so users get the typed app schemas without any
Python dependency at runtime.

Set AB_ROOT to point at a clone of https://github.com/zapier/AutomationBench
that has pydantic + the package installed. Defaults to ../../../../../references/AutomationBench
(the Daslab monorepo layout). Run with the AutomationBench venv:

    AB_ROOT=/path/to/AutomationBench \\
      $AB_ROOT/.venv/bin/python scripts/sync-automationbench.py

Outputs (relative to scene-bench/adapters/automationbench/):
  schemas/<app>.json        — one per WorldState field
  schemas/_world.json       — composite (the full WorldState)
  schemas/_index.json       — index { app → file, version, … }
  tasks/<task>.json         — every task
  tasks-manifest.json       — index of all tasks
"""
from __future__ import annotations

import importlib
import inspect
import json
import os
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ADAPTER = HERE.parent  # scene-bench/adapters/automationbench/
AB_ROOT = Path(os.environ.get("AB_ROOT") or (ADAPTER.parent.parent.parent.parent / "references" / "AutomationBench"))
sys.path.insert(0, str(AB_ROOT))

from automationbench.schema.world import WorldState     # noqa: E402
from pydantic import BaseModel                          # noqa: E402

SCHEMAS_OUT = ADAPTER / "schemas"
TASKS_OUT   = ADAPTER / "tasks"

SCHEMAS_OUT.mkdir(parents=True, exist_ok=True)
TASKS_OUT.mkdir(parents=True, exist_ok=True)

# ---------------------------------------------------------------------------
# 1. Per-app JSON schemas (gmail, salesforce, …) + the composite WorldState
# ---------------------------------------------------------------------------

print("Exporting JSON Schemas …")
index: dict[str, dict] = {}
for key, field in WorldState.model_fields.items():
    cls = field.annotation
    if not (inspect.isclass(cls) and issubclass(cls, BaseModel)):
        continue
    schema = cls.model_json_schema()
    out = SCHEMAS_OUT / f"{key}.json"
    out.write_text(json.dumps(schema, indent=2) + "\n")
    index[key] = {"file": f"{key}.json", "class": cls.__name__}
    print(f"  ✓ {key:30s} ({cls.__name__})")

# Composite WorldState — the union schema covering every app
world_schema = WorldState.model_json_schema()
(SCHEMAS_OUT / "_world.json").write_text(json.dumps(world_schema, indent=2) + "\n")
print(f"  ✓ _world.json  ({len(WorldState.model_fields)} apps)")

# Index manifest
(SCHEMAS_OUT / "_index.json").write_text(json.dumps({
    "source":  "https://github.com/zapier/AutomationBench",
    "license": "MIT",
    "apps":    index,
}, indent=2) + "\n")

# ---------------------------------------------------------------------------
# 2. Task definitions — every domain's task list, dumped as JSON
# ---------------------------------------------------------------------------

print("\nExporting tasks …")
DOMAINS = ["sales", "marketing", "operations", "support", "finance", "hr", "simple"]
manifest: list[dict] = []
total = 0
for dom in DOMAINS:
    mod = importlib.import_module(f"automationbench.domains.{dom}.tasks")
    domain_count = 0
    for fn_name, fn in inspect.getmembers(mod, inspect.isfunction):
        if not fn_name.startswith("get_"):
            continue
        # Skip helpers that don't return a task dict
        try:
            task = fn()
        except TypeError:
            continue
        if not isinstance(task, dict) or "task" not in task:
            continue
        slug = task["task"].replace(".", "_")
        out = TASKS_OUT / f"{slug}.json"
        out.write_text(json.dumps(task, indent=2, default=str) + "\n")
        manifest.append({
            "task":     task["task"],
            "domain":   dom,
            "id":       task.get("example_id"),
            "tools":    task.get("info", {}).get("zapier_tools", []),
            "file":     f"tasks/{slug}.json",
        })
        domain_count += 1
        total += 1
    print(f"  ✓ {dom:10s} {domain_count} tasks")

(ADAPTER / "tasks-manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
print(f"\nTotal: {total} tasks, {len(index)} schemas")
print(f"Manifest:    {ADAPTER / 'tasks-manifest.json'}")
