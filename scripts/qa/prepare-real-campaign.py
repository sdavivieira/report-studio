from __future__ import annotations

import json
import shutil
from pathlib import Path

from pypdf import PdfReader


ROOT = Path(__file__).resolve().parents[2]
QA_ROOT = ROOT / "tmp/qa/real"
DOWNLOADS = QA_ROOT / "pdf-downloads"
PDF_OUTPUT = QA_ROOT / "pdf"

SELECTED_PDFS = (
    "c01-160F-2019.pdf",
    "c02-ArabicCIDTrueType.pdf",
    "c14-annotation-caret-ink.pdf",
    "c05-PDFJS-7562-reduced.pdf",
    "c06-S2.pdf",
    "c18-annotation-highlight-without-appearance.pdf",
    "c08-Test-plusminus.pdf",
    "c09-ThuluthFeatures.pdf",
    "c10-ZapfDingbats.pdf",
    "c11-alphatrans.pdf",
    "c12-annotation-border-styles.pdf",
    "c13-annotation-button-widget.pdf",
    "c15-annotation-choice-widget.pdf",
    "c16-annotation-fileattachment.pdf",
    "c17-annotation-freetext.pdf",
    "c19-annotation-highlight.pdf",
    "c22-annotation-link-text-popup.pdf",
    "c24-annotation-polyline-polygon.pdf",
    "c26-annotation-square-circle.pdf",
    "c29-annotation-stamp.pdf",
)


def main() -> None:
    workbook_records = json.loads((QA_ROOT / "workbooks.json").read_text(encoding="utf-8"))
    candidate_records = json.loads(
        (QA_ROOT / "downloads/pdfjs-candidates.json").read_text(encoding="utf-8")
    )
    source_urls = {record["name"]: record["download_url"] for record in candidate_records}
    PDF_OUTPUT.mkdir(parents=True, exist_ok=True)

    scenarios = []
    for index, (workbook, pdf_name) in enumerate(
        zip(workbook_records, SELECTED_PDFS, strict=True), start=1
    ):
        source_pdf = DOWNLOADS / pdf_name
        reader = PdfReader(source_pdf, strict=False)
        if reader.is_encrypted:
            raise RuntimeError(f"Encrypted fixture was not selected: {pdf_name}")
        if not 1 <= len(reader.pages) <= 20:
            raise RuntimeError(f"Unsupported page count for {pdf_name}: {len(reader.pages)}")
        page_sizes = []
        for page in reader.pages:
            page_sizes.append(
                [round(float(page.mediabox.width), 2), round(float(page.mediabox.height), 2)]
            )

        original_name = pdf_name.split("-", 1)[1]
        destination = PDF_OUTPUT / f"r{index:02d}-{original_name}"
        shutil.copyfile(source_pdf, destination)
        scenario_id = f"r{index:02d}-{Path(original_name).stem[:48]}"
        scenarios.append(
            {
                "id": scenario_id,
                "title": f"Public fixture {index:02d}",
                "xlsx": workbook["path"],
                "pdf": destination.relative_to(ROOT).as_posix(),
                "pages": len(reader.pages),
                "pageSizes": page_sizes,
                "sourceXlsx": workbook["sourceUrl"],
                "sourceXlsxPath": workbook["sourcePath"],
                "sourcePdf": source_urls.get(original_name),
                "notes": [
                    f"Existing SheetJS workbook: {workbook['sourcePath']}",
                    f"Existing Mozilla PDF.js fixture: {original_name}",
                ],
            }
        )

    (QA_ROOT / "manifest.json").write_text(
        json.dumps(scenarios, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(json.dumps(scenarios, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
