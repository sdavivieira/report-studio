from __future__ import annotations

import json
import subprocess
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFont, ImageStat
from pypdf import PdfReader


ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "output/qa"
RENDER_ROOT = OUTPUT / "renders"
PDFTOPPM = Path(
    r"C:\Users\Micro\.cache\codex-runtimes\codex-primary-runtime\dependencies"
    r"\native\poppler\Library\bin\pdftoppm.exe"
)


def render(pdf: Path, destination: Path, page: int) -> Path:
    destination.parent.mkdir(parents=True, exist_ok=True)
    rendered = destination.with_suffix(".png")
    if rendered.exists():
        return rendered
    subprocess.run(
        [
            str(PDFTOPPM),
            "-png",
            "-r",
            "90",
            "-f",
            str(page),
            "-l",
            str(page),
            "-singlefile",
            str(pdf),
            str(destination),
        ],
        check=True,
        capture_output=True,
    )
    return rendered


def pixel_metrics(source: Image.Image, generated: Image.Image) -> dict[str, float]:
    source = source.convert("RGB")
    generated = generated.convert("RGB")
    if source.size != generated.size:
        generated = generated.resize(source.size)
    difference = ImageChops.difference(source, generated)
    mean = sum(ImageStat.Stat(difference).mean) / 3
    grayscale = generated.convert("L")
    histogram = grayscale.histogram()
    pixels = generated.width * generated.height
    white_ratio = sum(histogram[248:]) / pixels
    edge_width = max(1, min(generated.size) // 100)
    edges = Image.new("L", generated.size, 255)
    edges.paste(0, (edge_width, edge_width, generated.width - edge_width, generated.height - edge_width))
    dark = grayscale.point(lambda value: 255 if value < 245 else 0)
    edge_dark = ImageChops.multiply(dark, edges)
    edge_ratio = sum(ImageStat.Stat(edge_dark).mean) / 255 / pixels
    return {
        "meanPixelDifference": round(mean, 4),
        "whitePixelRatio": round(white_ratio, 6),
        "darkEdgeRatio": round(edge_ratio, 8),
    }


def contact_sheet(records: list[dict], suite: str) -> Path:
    thumb_size = (290, 360)
    label_height = 54
    columns = 4
    rows = (len(records) + columns - 1) // columns
    sheet = Image.new("RGB", (columns * 320, rows * 430), "#e7e5e4")
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default()
    for index, record in enumerate(records):
        image = Image.open(record["generatedFirstPage"]).convert("RGB")
        image.thumbnail(thumb_size)
        cell_x = (index % columns) * 320
        cell_y = (index // columns) * 430
        x = cell_x + (320 - image.width) // 2
        y = cell_y + 12
        sheet.paste(image, (x, y))
        draw.rectangle(
            (cell_x + 8, cell_y + 378, cell_x + 312, cell_y + 420), fill="white"
        )
        draw.text(
            (cell_x + 14, cell_y + 387), record["id"][:43], fill="black", font=font
        )
        draw.text(
            (cell_x + 14, cell_y + 402),
            f"pages={record['pageCount']} diff={record['maxMeanPixelDifference']:.2f}",
            fill="#44403c",
            font=font,
        )
    destination = OUTPUT / f"contact-sheet-{suite}.png"
    sheet.save(destination)
    return destination


def page_contact_sheets(records: list[dict], suite: str) -> list[Path]:
    pages = []
    for record in records:
        for page in record["pages"]:
            pages.append(
                {
                    "id": f"{record['id']} · página {page['page']}",
                    "path": RENDER_ROOT
                    / suite
                    / record["id"]
                    / f"generated-{page['page']}.png",
                }
            )
    destinations = []
    for batch_index in range(0, len(pages), 20):
        batch = pages[batch_index : batch_index + 20]
        columns = 4
        rows = (len(batch) + columns - 1) // columns
        sheet = Image.new("RGB", (columns * 320, rows * 430), "#e7e5e4")
        draw = ImageDraw.Draw(sheet)
        font = ImageFont.load_default()
        for index, item in enumerate(batch):
            image = Image.open(item["path"]).convert("RGB")
            image.thumbnail((290, 360))
            cell_x = (index % columns) * 320
            cell_y = (index // columns) * 430
            x = cell_x + (320 - image.width) // 2
            sheet.paste(image, (x, cell_y + 12))
            draw.rectangle(
                (cell_x + 8, cell_y + 378, cell_x + 312, cell_y + 420), fill="white"
            )
            draw.text((cell_x + 14, cell_y + 390), item["id"][:48], fill="black", font=font)
        number = batch_index // 20 + 1
        destination = OUTPUT / f"all-pages-{suite}-{number}.png"
        sheet.save(destination)
        destinations.append(destination)
    return destinations


def audit_suite(suite: str) -> list[dict]:
    qa_root = ROOT / "tmp/qa" / suite
    scenarios = json.loads((qa_root / "manifest.json").read_text(encoding="utf-8"))
    records = []
    for scenario in scenarios:
        source = (
            ROOT / scenario["pdf"]
            if scenario.get("pdf")
            else qa_root / "pdf" / f"{scenario['id']}.pdf"
        )
        generated = qa_root / "generated" / f"{scenario['id']}.pdf"
        source_reader = PdfReader(source, strict=False)
        generated_reader = PdfReader(generated, strict=False)
        if len(source_reader.pages) != len(generated_reader.pages):
            raise RuntimeError(f"Page count changed for {scenario['id']}")
        page_metrics = []
        first_generated = None
        for page_number in range(1, len(source_reader.pages) + 1):
            source_png = render(
                source,
                RENDER_ROOT / suite / scenario["id"] / f"source-{page_number}",
                page_number,
            )
            generated_png = render(
                generated,
                RENDER_ROOT / suite / scenario["id"] / f"generated-{page_number}",
                page_number,
            )
            if first_generated is None:
                first_generated = generated_png
            with Image.open(source_png) as source_image, Image.open(generated_png) as generated_image:
                metrics = pixel_metrics(source_image, generated_image)
                metrics["page"] = page_number
                metrics["width"] = generated_image.width
                metrics["height"] = generated_image.height
                page_metrics.append(metrics)
        records.append(
            {
                "id": scenario["id"],
                "pageCount": len(generated_reader.pages),
                "generatedFirstPage": str(first_generated),
                "maxMeanPixelDifference": max(
                    metric["meanPixelDifference"] for metric in page_metrics
                ),
                "maxWhitePixelRatio": max(metric["whitePixelRatio"] for metric in page_metrics),
                "maxDarkEdgeRatio": max(metric["darkEdgeRatio"] for metric in page_metrics),
                "pages": page_metrics,
            }
        )
    return records


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    audit = {}
    for suite in ("synthetic", "real"):
        records = audit_suite(suite)
        audit[suite] = records
        contact_sheet(records, suite)
        page_contact_sheets(records, suite)
    (OUTPUT / "visual-audit.json").write_text(
        json.dumps(audit, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(json.dumps({key: len(value) for key, value in audit.items()}))


if __name__ == "__main__":
    main()
