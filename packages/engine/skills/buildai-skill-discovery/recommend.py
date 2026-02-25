#!/usr/bin/env python3
import argparse
import json
from collections import defaultdict

SKILLS = {
    "buildai-procore": ["procore", "rfi", "submittal", "punchlist", "change order", "daily log"],
    "buildai-unifier": ["unifier", "cost", "budget", "workflow", "capital planning"],
    "buildai-aconex": ["aconex", "document control", "transmittal", "correspondence"],
    "buildai-ebuilder": ["e-builder", "cost", "approval workflow", "owner reporting"],
    "buildai-enablon": ["enablon", "safety", "incident", "esg", "compliance"],
    "buildai-kahua": ["kahua", "project controls", "field workflow"],
    "buildai-primavera-p6": ["p6", "primavera", "schedule", "critical path", "float"],
    "buildai-opc": ["opc", "project controls", "portfolio", "progress"],
    "buildai-monitor": ["alert", "monitor", "watch", "digest"],
}

ROLE_HINTS = {
    "project manager": ["buildai-procore", "buildai-monitor"],
    "construction manager": ["buildai-procore", "buildai-monitor"],
    "scheduler": ["buildai-primavera-p6", "buildai-monitor"],
    "planner": ["buildai-primavera-p6", "buildai-monitor"],
    "auditor": ["buildai-unifier", "buildai-aconex"],
    "architect": ["buildai-aconex", "buildai-procore"],
}


def norm(t: str) -> str:
    return (t or "").strip().lower()


def score(role: str, systems: list[str], pains: list[str]):
    systems_n = [norm(s) for s in systems if s]
    pains_n = [norm(p) for p in pains if p]
    role_n = norm(role)

    points = defaultdict(int)
    reasons = defaultdict(list)

    for skill, keys in SKILLS.items():
        for s in systems_n:
            if any(k in s for k in keys):
                points[skill] += 4
                reasons[skill].append(f"matches system '{s}'")
        for p in pains_n:
            if any(k in p for k in keys):
                points[skill] += 3
                reasons[skill].append(f"addresses pain '{p}'")

    for role_key, role_skills in ROLE_HINTS.items():
        if role_key in role_n:
            for skill in role_skills:
                points[skill] += 2
                reasons[skill].append(f"fits role '{role}'")

    ranked = sorted(points.items(), key=lambda x: x[1], reverse=True)
    top = []
    for skill, pts in ranked[:5]:
        top.append({
            "skill": skill,
            "score": pts,
            "reasons": sorted(set(reasons[skill]))[:3],
        })

    quick = [x["skill"] for x in top[:3]]

    uncovered = []
    for p in pains_n:
        if not any(any(k in p for k in SKILLS[s]) for s in quick):
            uncovered.append(p)

    return {
        "top_recommendations": top,
        "quick_start": quick,
        "coverage_gaps": uncovered,
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--role", default="")
    ap.add_argument("--systems", default="", help="comma-separated")
    ap.add_argument("--pain", action="append", default=[])
    args = ap.parse_args()

    systems = [x.strip() for x in args.systems.split(",") if x.strip()]
    result = score(args.role, systems, args.pain)
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
