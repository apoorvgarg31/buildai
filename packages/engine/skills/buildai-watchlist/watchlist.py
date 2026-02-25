#!/usr/bin/env python3
import argparse
import json
from pathlib import Path
from datetime import datetime, timezone

START = "<!-- WATCHLIST:START -->"
END = "<!-- WATCHLIST:END -->"


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def workspace_root() -> Path:
    # skill runs from workspace root context in engine
    return Path.cwd()


def watchlist_path() -> Path:
    return workspace_root() / "watchlist.json"


def heartbeat_path() -> Path:
    return workspace_root() / "HEARTBEAT.md"


def load_items():
    p = watchlist_path()
    if not p.exists():
        return []
    try:
        return json.loads(p.read_text())
    except Exception:
        return []


def save_items(items):
    watchlist_path().write_text(json.dumps(items, indent=2))


def watch_id(system: str, typ: str, entity_id: str) -> str:
    return f"{system}:{typ}:{entity_id}".lower().replace(" ", "-")


def sync_heartbeat(items):
    hb = heartbeat_path()
    current = hb.read_text() if hb.exists() else "# HEARTBEAT.md\n\n"

    lines = [
        START,
        "## Watchlist (auto-generated)",
        "Check these user-tracked entities every heartbeat and alert only on meaningful changes.",
    ]
    for i, it in enumerate(items, 1):
        lines.append(f"{i}. [{it['system']}] {it['entityType']} {it['entityId']} — {it['label']}")
    lines.append(END)
    block = "\n".join(lines) + "\n"

    if START in current and END in current:
        import re
        current = re.sub(f"{START}[\\s\\S]*?{END}\\n?", block, current, flags=re.M)
        hb.write_text(current)
    else:
        hb.write_text(current.rstrip() + "\n\n" + block)


def cmd_list(_args):
    items = load_items()
    print(json.dumps({"items": items}, indent=2))


def cmd_add(args):
    items = load_items()
    wid = watch_id(args.system, args.type, args.id)
    if any(it.get("id") == wid for it in items):
        print(json.dumps({"ok": True, "duplicate": True, "id": wid, "items": items}, indent=2))
        return

    item = {
        "id": wid,
        "system": args.system,
        "entityType": args.type,
        "entityId": args.id,
        "label": args.label or f"{args.type} {args.id}",
        "notify": "change",
        "createdAt": now_iso(),
    }
    items = [item] + items
    save_items(items)
    sync_heartbeat(items)
    print(json.dumps({"ok": True, "item": item, "items": items}, indent=2))


def cmd_remove(args):
    items = load_items()
    updated = [i for i in items if i.get("id") != args.watch_id]
    save_items(updated)
    sync_heartbeat(updated)
    print(json.dumps({"ok": True, "removed": len(updated) != len(items), "items": updated}, indent=2))


def main():
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)

    p_list = sub.add_parser("list")
    p_list.set_defaults(func=cmd_list)

    p_add = sub.add_parser("add")
    p_add.add_argument("--system", required=True)
    p_add.add_argument("--type", required=True)
    p_add.add_argument("--id", required=True)
    p_add.add_argument("--label", default="")
    p_add.set_defaults(func=cmd_add)

    p_rm = sub.add_parser("remove")
    p_rm.add_argument("--watch-id", required=True)
    p_rm.set_defaults(func=cmd_remove)

    args = ap.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
