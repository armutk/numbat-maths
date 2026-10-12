#!/usr/bin/env python3
"""Build scoretable.md + WINNER.md from scores.json."""
import json, os
from collections import defaultdict

ROOT = os.path.dirname(os.path.abspath(__file__))
CRITS = ["warmth", "friendliness", "clarity", "consistency", "artefacts"]
scores = json.load(open(f"{ROOT}/scores.json"))

rows = []
for cand, per in sorted(scores.items()):
    per_crit = {c: [] for c in CRITS}
    arisha, numbat = [], []
    for lid, s in per.items():
        if "error" in s or not isinstance(s, dict):
            continue
        for c in CRITS:
            v = s.get(c)
            if isinstance(v, (int, float)):
                per_crit[c].append(v)
        if s.get("arisha_ok") is not None:
            arisha.append(bool(s["arisha_ok"]))
        if s.get("numbat_ok") is not None:
            numbat.append(bool(s["numbat_ok"]))
    if not per_crit["warmth"]:
        continue
    avg = {c: (sum(v) / len(v) if v else None) for c, v in per_crit.items()}
    n = max(len(v) for v in per_crit.values())
    grand = sum(avg[c] for c in CRITS) / len(CRITS)
    rows.append({"cand": cand, "avg": avg, "grand": grand, "n": n,
                 "arisha": f"{sum(arisha)}/{len(arisha)}" if arisha else "-",
                 "numbat": f"{sum(numbat)}/{len(numbat)}" if numbat else "-"})

rows.sort(key=lambda r: (-r["grand"], -(r["avg"]["warmth"] + r["avg"]["friendliness"])))

hdr = "| candidate | warmth | friend | clarity | consist | artefacts | GRAND | Arisha ok | numbat ok | lines |"
sep = "|---|---|---|---|---|---|---|---|---|---|"
table = [hdr, sep]
for r in rows:
    cells = [f"{r['avg'][c]:.1f}" if r["avg"][c] is not None else "-" for c in CRITS]
    table.append(f"| {r['cand']} | " + " | ".join(cells) +
                 f" | **{r['grand']:.2f}** | {r['arisha']} | {r['numbat']} | {r['n']} |")
open(f"{ROOT}/scoretable.md", "w").write(
    "# Voice bake-off scoretable (Gemini judge, gemini-3.8-flash)\n\n"
    "Scores 1-10 per line, averaged. Tie-break: warmth+friendliness, then name pronunciation.\n\n"
    + "\n".join(table) + "\n")

# pronunciation findings
print("\n".join(table))
if rows:
    w = rows[0]
    txt = f"""# WINNER: {w['cand']}

Grand average **{w['grand']:.2f}** across 5 criteria
(warmth {w['avg']['warmth']:.1f}, friendliness {w['avg']['friendliness']:.1f},
clarity {w['avg']['clarity']:.1f}, consistency {w['avg']['consistency']:.1f},
artefacts {w['avg']['artefacts']:.1f}) over {w['n']} judged lines.
Name checks: Arisha {w['arisha']}, numbat {w['numbat']}.

See scoretable.md for the full comparison.
"""
    open(f"{ROOT}/WINNER.md", "w").write(txt)
    print("\nWINNER:", w["cand"], f"grand={w['grand']:.2f}")
