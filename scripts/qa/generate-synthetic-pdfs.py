from __future__ import annotations

import json
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A3, A4, A5, LEGAL, landscape, portrait
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph, Table, TableStyle
from reportlab.pdfgen import canvas

ROOT = Path.cwd()
QA_ROOT = ROOT / "tmp" / "qa" / "synthetic"
PDF_DIR = QA_ROOT / "pdf"
PDF_DIR.mkdir(parents=True, exist_ok=True)
FONT_DIR = ROOT / "src" / "assets" / "fonts"
regular = next(FONT_DIR.glob("*Regular*.ttf"), None)
bold = next(FONT_DIR.glob("*Bold*.ttf"), None)
if regular and bold:
    pdfmetrics.registerFont(TTFont("QA", str(regular)))
    pdfmetrics.registerFont(TTFont("QA-Bold", str(bold)))
else:
    regular_name, bold_name = "Helvetica", "Helvetica-Bold"
regular_name = "QA" if regular else "Helvetica"
bold_name = "QA-Bold" if bold else "Helvetica-Bold"

PAGE_SIZES = {"A3": A3, "A4": A4, "A5": A5, "Legal": LEGAL}
PALETTES = [
    ("#123c69", "#d9e8f5"), ("#3b2f2f", "#f4ebe4"), ("#174d44", "#e5f2ef"),
    ("#5b2c6f", "#f2e8f5"), ("#7a3e00", "#fff0df"), ("#263238", "#eceff1"),
]

def format_value(value):
    if value is None or value == "":
        return "—"
    if isinstance(value, bool):
        return "Sim" if value else "Não"
    if isinstance(value, float):
        return f"{value:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    if isinstance(value, str) and "T00:00:00" in value:
        year, month, day = value[:10].split("-")
        return f"{day}/{month}/{year}"
    return str(value)


def draw_content(pdf, width, height, scenario, page_index, primary, pale):
    top = height - (43 * mm if scenario["orientation"] == "portrait" else 38 * mm)
    rows = scenario["rows"]
    sample = rows[page_index * 6 : page_index * 6 + 6] or rows[:3]
    first = sample[0] if sample else []
    card_count = min(4, len(first))
    gap = 4 * mm
    card_width = (width - 28 * mm - gap * (card_count - 1)) / max(card_count, 1)
    for card in range(card_count):
        x = 14 * mm + card * (card_width + gap)
        pdf.setFillColor(colors.white)
        pdf.roundRect(x, top - 23 * mm, card_width, 20 * mm, 3 * mm, fill=1, stroke=0)
        pdf.setFillColor(colors.HexColor("#6b7280"))
        pdf.setFont(regular_name, 6.5)
        pdf.drawString(x + 3 * mm, top - 9 * mm, str(scenario["headers"][card])[:34])
        pdf.setFillColor(colors.HexColor("#1f2937"))
        pdf.setFont(bold_name, 10)
        text = format_value(first[card])[:34]
        pdf.drawString(x + 3 * mm, top - 17 * mm, text)

    table_top = top - 31 * mm
    max_columns = min(len(scenario["headers"]), 12 if width > 700 else 8)
    headers = [str(value)[:32] for value in scenario["headers"][:max_columns]]
    table_data = [headers]
    for row in sample:
        table_data.append([format_value(value)[:48] for value in row[:max_columns]])
    available_width = width - 28 * mm
    col_widths = [available_width / max_columns] * max_columns
    style = ParagraphStyle("cell", fontName=regular_name, fontSize=5.5 if max_columns > 8 else 7, leading=7, textColor=colors.HexColor("#222222"))
    header_style = ParagraphStyle("head", fontName=bold_name, fontSize=5.5 if max_columns > 8 else 7, leading=7, textColor=colors.white)
    wrapped = [[Paragraph(cell, header_style) for cell in table_data[0]]]
    wrapped += [[Paragraph(cell, style) for cell in row] for row in table_data[1:]]
    table = Table(wrapped, colWidths=col_widths, repeatRows=1)
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor(primary)),
        ("BACKGROUND", (0, 1), (-1, -1), colors.white),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor(pale)]),
        ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#d1d5db")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 3),
        ("RIGHTPADDING", (0, 0), (-1, -1), 3),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]))
    table_width, table_height = table.wrap(available_width, height)
    table.drawOn(pdf, 14 * mm, max(15 * mm, table_top - table_height))


def draw_edge_fields(pdf, width, height, scenario, primary):
    values = scenario["rows"][0]
    positions = [
        (2 * mm, height - 43 * mm, TA_LEFT),
        (width - 2 * mm, height - 43 * mm, TA_RIGHT),
        (2 * mm, 11 * mm, TA_LEFT),
        (width - 2 * mm, 11 * mm, TA_RIGHT),
    ]
    pdf.setFillColor(colors.HexColor(primary))
    pdf.setFont(bold_name, 9)
    for value, (x, y, alignment) in zip(values, positions):
        if alignment == TA_RIGHT:
            pdf.drawRightString(x, y, value)
        else:
            pdf.drawString(x, y, value)


with open(QA_ROOT / "manifest.json", encoding="utf-8") as stream:
    scenarios = json.load(stream)

for index, scenario in enumerate(scenarios):
    base_size = PAGE_SIZES[scenario["page"]]
    page_size = landscape(base_size) if scenario["orientation"] == "landscape" else portrait(base_size)
    width, height = page_size
    primary, pale = PALETTES[index % len(PALETTES)]
    output = PDF_DIR / f'{scenario["id"]}.pdf'
    pdf = canvas.Canvas(str(output), pagesize=page_size)
    for page_index in range(scenario["pages"]):
        pdf.setFillColor(colors.HexColor("#faf8f4"))
        pdf.rect(0, 0, width, height, fill=1, stroke=0)
        pdf.setFillColor(colors.HexColor(primary))
        header_height = 24 * mm if index % 3 else 34 * mm
        pdf.rect(0, height - header_height, width, header_height, fill=1, stroke=0)
        pdf.setFillColor(colors.white)
        pdf.setFont(bold_name, 16 if width < 500 else 20)
        pdf.drawString(14 * mm, height - 14 * mm, scenario["title"])
        pdf.setFont(regular_name, 8)
        pdf.drawRightString(width - 14 * mm, height - 14 * mm, f'Cenário {index + 1:02d} · página {page_index + 1}/{scenario["pages"]}')

        if scenario.get("design") == "edges":
            draw_edge_fields(pdf, width, height, scenario, primary)
        else:
            draw_content(pdf, width, height, scenario, page_index, primary, pale)

        pdf.setFillColor(colors.HexColor(primary))
        pdf.setFont(regular_name, 7)
        pdf.drawString(10 * mm, 6 * mm, 'QA Report Studio · arquivo produzido para teste adversarial')
        pdf.drawRightString(width - 10 * mm, 6 * mm, f'{page_index + 1}/{scenario["pages"]}')
        pdf.showPage()
    pdf.save()

print(f"Generated {len(scenarios)} PDFs in {PDF_DIR}")
