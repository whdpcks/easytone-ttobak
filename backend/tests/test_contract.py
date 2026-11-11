import json
import unittest
from pathlib import Path


CONTRACTS = Path(__file__).resolve().parents[2] / "contracts"


class ContractTests(unittest.TestCase):
    def test_example_results_have_exact_public_keys(self):
        schema = json.loads((CONTRACTS / "document-result.schema.json").read_text(encoding="utf-8"))
        required = set(schema["required"])
        self.assertEqual(required, set(schema["properties"]))

        for path in (CONTRACTS / "examples").glob("*.json"):
            with self.subTest(path=path.name):
                example = json.loads(path.read_text(encoding="utf-8"))
                self.assertEqual(set(example), required)
                self.assertEqual(example["status"], "completed")
                self.assertIn(example["category"], schema["properties"]["category"]["enum"])
                self.assertLessEqual(len(example["summary"]), 3)
                self.assertNotIn("evidence", example)

    def test_status_schema_matches_simplified_contract(self):
        schema = json.loads((CONTRACTS / "document-status.schema.json").read_text(encoding="utf-8"))
        self.assertEqual(set(schema["properties"]), set(schema["required"]))
        self.assertEqual(schema["properties"]["status"]["enum"], ["processing", "completed", "failed"])


if __name__ == "__main__":
    unittest.main()
