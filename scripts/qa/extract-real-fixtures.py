from __future__ import annotations

import base64
import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
FIXTURES = ROOT / "tmp/qa/real/downloads/fixtures.js"
OUTPUT = ROOT / "tmp/qa/real/xlsx"

SELECTED_SOURCE_PATHS = (
    "AutoFilter.xlsx",
    "cell_style_simple.xlsx",
    "DataTypesFormats.xlsx",
    "comments_stress_test.xlsx",
    "column_width.xlsx",
    "number_format_entities.xlsx",
    "LONumbers.xlsx",
    "xlsx-stream-d-date-cell.xlsx",
    "formula_stress_test.xlsx",
    "hyperlink_stress_test_2011.xlsx",
    "merge_cells.xlsx",
    "outline.xlsx",
    "RkNumber.xlsx",
    "pivot_table_named_range.xlsx",
    "rich_text_stress.xlsx",
    "row_height.xlsx",
    "sheet_visibility.xlsx",
    "formulae_test_simple.xlsx",
    "text_and_numbers.xlsx",
    "named_ranges_2011.xlsx",
)


def safe_name(value: str) -> str:
    value = re.sub(r"[^A-Za-z0-9._-]+", "-", value).strip("-.")
    return value[:96] or "workbook"


def score(path: str, payload_size: int) -> tuple[int, int, str]:
    """Prefer varied, meaningful fixtures over tiny parser-only samples."""
    lower = path.lower()
    keywords = (
        "date",
        "formula",
        "format",
        "number",
        "unicode",
        "merge",
        "sheet",
        "chart",
        "blank",
        "hidden",
        "style",
        "table",
        "string",
        "issue",
    )
    keyword_hits = sum(word in lower for word in keywords)
    useful_size = 1 if 2_000 <= payload_size <= 2_000_000 else 0
    return (-keyword_hits, -useful_size, path)


def main() -> None:
    source = FIXTURES.read_text(encoding="utf-8", errors="replace")
    pattern = re.compile(
        r"fs\['\./test_files/(.+?\.(?:xlsx|xls))'\]\s*=\s*'([^']+)';",
        re.IGNORECASE,
    )
    matches = []
    for path, encoded in pattern.findall(source):
        try:
            raw = base64.b64decode(encoded, validate=True)
        except ValueError:
            continue
        if not (512 <= len(raw) <= 20 * 1024 * 1024):
            continue
        matches.append((path, raw))

    by_path = {path: raw for path, raw in matches}
    selected = [(path, by_path[path]) for path in SELECTED_SOURCE_PATHS if path in by_path]

    if len(selected) < 20:
        missing = [path for path in SELECTED_SOURCE_PATHS if path not in by_path]
        raise RuntimeError(
            f"Only {len(selected)} usable workbook fixtures were found; missing: {missing}"
        )

    OUTPUT.mkdir(parents=True, exist_ok=True)
    records = []
    for index, (source_path, raw) in enumerate(selected, start=1):
        destination = OUTPUT / f"r{index:02d}-{safe_name(Path(source_path).name)}"
        destination.write_bytes(raw)
        records.append(
            {
                "index": index,
                "path": destination.relative_to(ROOT).as_posix(),
                "sourcePath": source_path,
                "sourceUrl": "https://oss.sheetjs.com/test_files/" + source_path,
                "size": len(raw),
            }
        )

    manifest_path = ROOT / "tmp/qa/real/workbooks.json"
    manifest_path.write_text(json.dumps(records, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(records, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
