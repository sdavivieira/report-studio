from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


OUTPUT = Path("output/pdf/boletim-escolar-preenchido.pdf")
NAVY = colors.HexColor("#163A5F")
BLUE = colors.HexColor("#2878B5")
PALE_BLUE = colors.HexColor("#EAF3F9")
LIGHT_GRAY = colors.HexColor("#F5F7F9")
TEXT = colors.HexColor("#24313D")


def build_report_card() -> None:
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    document = SimpleDocTemplate(
        str(OUTPUT),
        pagesize=A4,
        rightMargin=18 * mm,
        leftMargin=18 * mm,
        topMargin=10 * mm,
        bottomMargin=10 * mm,
        title="Boletim escolar - Mariana Oliveira",
        author="Colégio Horizonte",
    )
    styles = getSampleStyleSheet()
    school = ParagraphStyle(
        "School",
        parent=styles["Heading1"],
        fontName="Helvetica-Bold",
        fontSize=19,
        leading=22,
        textColor=NAVY,
        alignment=TA_LEFT,
        spaceAfter=2 * mm,
    )
    report_title = ParagraphStyle(
        "ReportTitle",
        parent=styles["Heading2"],
        fontName="Helvetica-Bold",
        fontSize=13,
        leading=16,
        textColor=BLUE,
        alignment=TA_LEFT,
        spaceAfter=5 * mm,
    )
    body = ParagraphStyle(
        "Body",
        parent=styles["BodyText"],
        fontName="Helvetica",
        fontSize=9,
        leading=12,
        textColor=TEXT,
    )
    centered = ParagraphStyle("Centered", parent=body, alignment=TA_CENTER)
    summary_label = ParagraphStyle(
        "SummaryLabel",
        parent=centered,
        fontName="Helvetica-Bold",
        fontSize=8.5,
        leading=10,
    )
    summary_value = ParagraphStyle(
        "SummaryValue",
        parent=centered,
        fontName="Helvetica-Bold",
        fontSize=18,
        leading=20,
        textColor=NAVY,
    )
    summary_result = ParagraphStyle(
        "SummaryResult",
        parent=summary_value,
        fontSize=14,
        leading=17,
        textColor=colors.HexColor("#1D7A46"),
    )

    story = [
        Table([["", ""]], colWidths=[126 * mm, 48 * mm], rowHeights=[3 * mm], style=[
            ("BACKGROUND", (0, 0), (-1, -1), NAVY),
            ("BACKGROUND", (1, 0), (1, 0), BLUE),
        ]),
        Spacer(1, 5 * mm),
        Paragraph("COLÉGIO HORIZONTE", school),
        Paragraph("BOLETIM ESCOLAR - 2º BIMESTRE DE 2026", report_title),
    ]

    identity_data = [
        [Paragraph("<b>Aluno</b><br/>Mariana Oliveira", body), Paragraph("<b>Matrícula</b><br/>ALU-2026-047", body)],
        [Paragraph("<b>Turma</b><br/>8º Ano A", body), Paragraph("<b>Turno</b><br/>Manhã", body)],
    ]
    identity = Table(identity_data, colWidths=[108 * mm, 66 * mm], rowHeights=[15 * mm, 15 * mm])
    identity.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), PALE_BLUE),
        ("BOX", (0, 0), (-1, -1), 0.6, colors.HexColor("#B8CEDD")),
        ("INNERGRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#C9D9E4")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 7),
    ]))
    story.extend([identity, Spacer(1, 6 * mm), Paragraph("DESEMPENHO POR DISCIPLINA", report_title)])

    rows = [
        ["Disciplina", "Nota 1", "Nota 2", "Média", "Faltas", "Situação"],
        ["Língua Portuguesa", "8,4", "9,1", "8,75", "0", "Aprovado"],
        ["Matemática", "7,8", "8,6", "8,20", "1", "Aprovado"],
        ["Ciências", "9,3", "9,0", "9,15", "2", "Aprovado"],
        ["História", "8,1", "8,7", "8,40", "1", "Aprovado"],
        ["Geografia", "7,6", "8,3", "7,95", "0", "Aprovado"],
        ["Língua Inglesa", "9,4", "9,2", "9,30", "2", "Aprovado"],
    ]
    grade_table = Table(rows, colWidths=[52 * mm, 22 * mm, 22 * mm, 22 * mm, 20 * mm, 36 * mm], rowHeights=[9 * mm] + [9.5 * mm] * 6)
    grade_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), NAVY),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTNAME", (0, 1), (-1, -1), "Helvetica"),
        ("FONTSIZE", (0, 0), (-1, -1), 8.5),
        ("ALIGN", (1, 1), (-1, -1), "CENTER"),
        ("ALIGN", (0, 0), (-1, 0), "CENTER"),
        ("ALIGN", (0, 1), (0, -1), "LEFT"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("GRID", (0, 0), (-1, -1), 0.45, colors.HexColor("#C8D3DC")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, LIGHT_GRAY]),
        ("TEXTCOLOR", (0, 1), (-1, -1), TEXT),
    ]))
    story.extend([grade_table, Spacer(1, 6 * mm)])

    summary = Table([
        [Paragraph("Média geral", summary_label),
         Paragraph("Total de faltas", summary_label),
         Paragraph("Resultado", summary_label)],
        [Paragraph("8,63", summary_value),
         Paragraph("6", summary_value),
         Paragraph("APROVADA", summary_result)],
    ], colWidths=[58 * mm, 58 * mm, 58 * mm], rowHeights=[9 * mm, 15 * mm])
    summary.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), PALE_BLUE),
        ("BOX", (0, 0), (-1, -1), 0.8, colors.HexColor("#9FBCCF")),
        ("LINEBEFORE", (1, 0), (-1, -1), 0.5, colors.HexColor("#B8CEDD")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("BOTTOMPADDING", (0, 0), (-1, 0), 0),
        ("TOPPADDING", (0, 1), (-1, 1), 0),
    ]))
    story.extend([
        summary,
        Spacer(1, 5 * mm),
        Paragraph("Observação pedagógica", report_title),
        Paragraph(
            "A aluna apresentou bom desempenho no bimestre, com destaque para Ciências e Língua Inglesa. Recomenda-se manter a rotina de estudos em Matemática e Geografia.",
            body,
        ),
        Spacer(1, 9 * mm),
        Table(
            [["________________________________", "________________________________"], ["Coordenação pedagógica", "Responsável"]],
            colWidths=[87 * mm, 87 * mm],
            style=[
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("FONTNAME", (0, 0), (-1, -1), "Helvetica"),
                ("FONTSIZE", (0, 0), (-1, -1), 8),
                ("TEXTCOLOR", (0, 0), (-1, -1), colors.HexColor("#526575")),
            ],
        ),
    ])

    document.build(story)


if __name__ == "__main__":
    build_report_card()
