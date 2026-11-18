"""Fail on high or critical npm advisories unless each is an accepted, unfixed, development-only risk.

Usage: check-npm-audit.py <npm-audit.json> <accepted-dependency-risks.json> <package-lock.json>

An accepted advisory fails again when its review date passes, when the package reaches the
runtime dependency tree, or when a release newer than the recorded vulnerable version appears.
"""

import json
import subprocess
import sys
from datetime import date, datetime, timezone

BLOCKING = {"high", "critical"}


def version(text):
    return tuple(int(part) for part in text.split("-")[0].split("."))


def blocking_advisories(audit):
    if "error" in audit or "vulnerabilities" not in audit:
        raise ValueError(f"npm audit did not produce a report: {audit.get('error', audit)}")
    found = {}
    for vulnerability in audit["vulnerabilities"].values():
        for via in vulnerability.get("via", []):
            if isinstance(via, dict) and via.get("severity") in BLOCKING:
                advisory = via["url"].rstrip("/").rsplit("/", 1)[-1]
                found[advisory] = {"package": via["name"], "severity": via["severity"], "title": via["title"]}
    return found


def installed_copies(lock, package):
    return [entry for path, entry in lock.get("packages", {}).items()
            if path == f"node_modules/{package}" or path.endswith(f"/node_modules/{package}")]


def latest_release(package):
    result = subprocess.run(["npm", "view", package, "version"], capture_output=True, text=True, check=True)
    return result.stdout.strip()


def evaluate(audit, accepted, lock, today, latest=latest_release):
    review = date.fromisoformat(accepted["reviewDate"])
    entries = {entry["advisory"]: entry for entry in accepted.get("npm", [])}
    errors, notes = [], []
    for advisory, finding in sorted(blocking_advisories(audit).items()):
        label = f"{advisory} in {finding['package']} ({finding['severity']}): {finding['title']}"
        entry = entries.get(advisory)
        if not entry or entry["package"] != finding["package"]:
            errors.append(f"Unaccepted finding: {label}")
            continue
        if today > review:
            errors.append(f"Accepted risk expired on {review}: {label}")
            continue
        copies = installed_copies(lock, finding["package"])
        if not copies or not all(copy.get("dev") for copy in copies):
            errors.append(f"Accepted only as a development dependency, but package-lock.json installs it for runtime: {label}")
            continue
        newest = latest(finding["package"])
        if version(newest) > version(entry["vulnerableThrough"]):
            errors.append(f"{finding['package']} {newest} is released. Upgrade and remove the accepted risk: {label}")
            continue
        notes.append(f"Accepted until {review}: {label}. No fixed release yet; latest is {newest}.")
    return errors, notes


def main(arguments):
    if len(arguments) != 3:
        print(__doc__.strip().splitlines()[2], file=sys.stderr)
        return 2
    audit, accepted, lock = (json.loads(open(path, encoding="utf-8").read()) for path in arguments)
    try:
        errors, notes = evaluate(audit, accepted, lock, datetime.now(timezone.utc).date())
    except (ValueError, subprocess.CalledProcessError) as error:
        print(f"npm audit check incomplete: {error}", file=sys.stderr)
        return 1
    for note in notes:
        print(note)
    for error in errors:
        print(error, file=sys.stderr)
    if not errors:
        print("No unaccepted high or critical npm advisories.")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
