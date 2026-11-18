import importlib.util
import unittest
from datetime import date
from pathlib import Path

spec = importlib.util.spec_from_file_location("check_npm_audit", Path(__file__).with_name("check-npm-audit.py"))
policy = importlib.util.module_from_spec(spec)
spec.loader.exec_module(policy)

TODAY = date(2026, 11, 18)
AUDIT = {"vulnerabilities": {
    "picomatch": {"via": [{"name": "picomatch", "severity": "high", "title": "ReDoS",
                           "url": "https://github.com/advisories/GHSA-TEST"}]},
    "vite": {"via": ["picomatch"]},
}}
ACCEPTED = {"reviewDate": "2026-12-02", "npm": [{"advisory": "GHSA-TEST", "package": "picomatch", "vulnerableThrough": "4.0.7"}]}
DEV_LOCK = {"packages": {"node_modules/picomatch": {"version": "4.0.7", "dev": True}}}


def evaluate(audit=AUDIT, accepted=ACCEPTED, lock=DEV_LOCK, today=TODAY, latest="4.0.7"):
    return policy.evaluate(audit, accepted, lock, today, lambda _package: latest)


class NpmAuditPolicyTests(unittest.TestCase):
    def test_accepted_unfixed_dev_finding_passes_with_a_note(self):
        errors, notes = evaluate()
        self.assertEqual(errors, [])
        self.assertIn("Accepted until 2026-12-02", notes[0])

    def test_unaccepted_finding_fails(self):
        errors, _ = evaluate(accepted={"reviewDate": "2026-12-02", "npm": []})
        self.assertIn("Unaccepted finding: GHSA-TEST", errors[0])

    def test_expired_review_date_fails(self):
        errors, _ = evaluate(today=date(2026, 12, 3))
        self.assertIn("expired on 2026-12-02", errors[0])

    def test_runtime_copy_fails(self):
        lock = {"packages": {"node_modules/picomatch": {"dev": True}, "node_modules/x/node_modules/picomatch": {}}}
        errors, _ = evaluate(lock=lock)
        self.assertIn("installs it for runtime", errors[0])

    def test_fixed_release_fails(self):
        errors, _ = evaluate(latest="4.0.8")
        self.assertIn("picomatch 4.0.8 is released", errors[0])

    def test_moderate_findings_do_not_block(self):
        audit = {"vulnerabilities": {"x": {"via": [{"name": "x", "severity": "moderate", "title": "t", "url": "u/GHSA-M"}]}}}
        self.assertEqual(evaluate(audit=audit), ([], []))

    def test_missing_report_is_incomplete(self):
        with self.assertRaises(ValueError):
            evaluate(audit={"error": {"code": "ENOTFOUND"}})


if __name__ == "__main__":
    unittest.main()
