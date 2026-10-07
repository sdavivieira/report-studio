from dataclasses import dataclass
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.units import mm
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfgen import canvas


OUTPUT = Path("output/pdf/estoque-botas-ecommerce-preenchido.pdf")

INK = colors.HexColor("#22201E")
COFFEE = colors.HexColor("#3A2C26")
LEATHER = colors.HexColor("#9C5A32")
SAND = colors.HexColor("#E6D5BF")
CREAM = colors.HexColor("#F8F4EE")
WHITE = colors.white
MUTED = colors.HexColor("#746B65")
LINE = colors.HexColor("#DED5CB")
GREEN = colors.HexColor("#287451")
GREEN_BG = colors.HexColor("#E4F2EA")
AMBER = colors.HexColor("#9B6500")
AMBER_BG = colors.HexColor("#FFF0CB")
RED = colors.HexColor("#A23E37")
RED_BG = colors.HexColor("#F8E1DE")


@dataclass(frozen=True)
class Product:
    sku: str
    name: str
    category: str
    color: str
    sizes: str
    stock: int
    reserved: int
    cost: float
    price: float
    status: str

    @property
    def available(self) -> int:
        return self.stock - self.reserved


PRODUCTS = [
    Product("BT-1001", "Serra Chelsea", "Chelsea", "Café", "34-40", 68, 9, 168.0, 349.9, "Saudável"),
    Product("BT-1002", "Trilha Couro", "Adventure", "Caramelo", "35-44", 54, 12, 192.0, 399.9, "Saudável"),
    Product("BT-1003", "Aurora Cano Alto", "Feminina", "Preto", "33-40", 31, 8, 205.0, 429.9, "Atenção"),
    Product("BT-1004", "Ranch Western", "Western", "Tabaco", "35-43", 47, 6, 221.0, 459.9, "Saudável"),
    Product("BT-1005", "Urban Track", "Coturno", "Preto", "34-44", 72, 18, 176.0, 369.9, "Saudável"),
    Product("BT-1006", "Vale Camurça", "Casual", "Areia", "34-40", 24, 7, 154.0, 329.9, "Atenção"),
    Product("BT-1007", "Nordic Forrada", "Inverno", "Marrom", "35-42", 18, 5, 238.0, 489.9, "Reposição"),
    Product("BT-1008", "Work Pro", "Trabalho", "Café", "36-45", 61, 11, 214.0, 449.9, "Saudável"),
    Product("BT-1009", "Luna Salto Bloco", "Feminina", "Vinho", "33-39", 29, 10, 183.0, 389.9, "Atenção"),
    Product("BT-1010", "Deserto Chukka", "Chukka", "Caramelo", "35-43", 38, 4, 147.0, 319.9, "Saudável"),
    Product("BT-1011", "Alpes Neve", "Inverno", "Off-white", "34-41", 15, 6, 246.0, 519.9, "Reposição"),
    Product("BT-1012", "Mini Trail Kids", "Infantil", "Marinho", "25-33", 29, 8, 109.0, 249.9, "Atenção"),
]


def money(value: float) -> str:
    formatted = f"{value:,.2f}".replace(",", "_").replace(".", ",").replace("_", ".")
    return f"R$ {formatted}"


def draw_boot_logo(pdf: canvas.Canvas, x: float, y: float) -> None:
    pdf.saveState()
    pdf.setFillColor(LEATHER)
    path = pdf.beginPath()
    path.moveTo(x + 2 * mm, y + 19 * mm)
    path.lineTo(x + 12 * mm, y + 19 * mm)
    path.lineTo(x + 13 * mm, y + 8 * mm)
    path.curveTo(x + 17 * mm, y + 5 * mm, x + 22 * mm, y + 4 * mm, x + 27 * mm, y + 4 * mm)
    path.lineTo(x + 29 * mm, y + 1 * mm)
    path.lineTo(x + 8 * mm, y + 1 * mm)
    path.curveTo(x + 3 * mm, y + 1 * mm, x + 1 * mm, y + 4 * mm, x + 2 * mm, y + 8 * mm)
    path.close()
    pdf.drawPath(path, fill=1, stroke=0)
    pdf.setStrokeColor(SAND)
    pdf.setLineWidth(1.2)
    for offset in (9, 12, 15):
        pdf.line(x + 5 * mm, y + offset * mm, x + 11 * mm, y + offset * mm)
    pdf.restoreState()


def draw_kpi(pdf: canvas.Canvas, x: float, y: float, width: float, label: str, value: str, note: str) -> None:
    pdf.setFillColor(WHITE)
    pdf.roundRect(x, y, width, 26 * mm, 4 * mm, fill=1, stroke=0)
    pdf.setFillColor(MUTED)
    pdf.setFont("Helvetica-Bold", 7.2)
    pdf.drawString(x + 5 * mm, y + 18.5 * mm, label.upper())
    pdf.setFillColor(INK)
    pdf.setFont("Helvetica-Bold", 16)
    pdf.drawString(x + 5 * mm, y + 9.5 * mm, value)
    pdf.setFillColor(MUTED)
    pdf.setFont("Helvetica", 6.7)
    pdf.drawString(x + 5 * mm, y + 4.4 * mm, note)


def draw_status(pdf: canvas.Canvas, x: float, y: float, text: str) -> None:
    palette = {
        "Saudável": (GREEN, GREEN_BG),
        "Atenção": (AMBER, AMBER_BG),
        "Reposição": (RED, RED_BG),
    }
    foreground, background = palette[text]
    width = stringWidth(text, "Helvetica-Bold", 6.4) + 6 * mm
    pdf.setFillColor(background)
    pdf.roundRect(x, y, width, 5.5 * mm, 2.75 * mm, fill=1, stroke=0)
    pdf.setFillColor(foreground)
    pdf.setFont("Helvetica-Bold", 6.4)
    pdf.drawCentredString(x + width / 2, y + 1.85 * mm, text)


def build_inventory_report() -> None:
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    width, height = landscape(A4)
    pdf = canvas.Canvas(str(OUTPUT), pagesize=(width, height))
    pdf.setTitle("Painel de estoque - Nômade Boots")
    pdf.setAuthor("Nômade Boots")
    pdf.setSubject("Relatório de estoque do e-commerce")

    pdf.setFillColor(CREAM)
    pdf.rect(0, 0, width, height, fill=1, stroke=0)

    header_height = 35 * mm
    pdf.setFillColor(COFFEE)
    pdf.rect(0, height - header_height, width, header_height, fill=1, stroke=0)
    draw_boot_logo(pdf, 14 * mm, height - 29 * mm)
    pdf.setFillColor(WHITE)
    pdf.setFont("Helvetica-Bold", 18)
    pdf.drawString(47 * mm, height - 16 * mm, "NÔMADE BOOTS")
    pdf.setFillColor(SAND)
    pdf.setFont("Helvetica", 7.5)
    pdf.drawString(47 * mm, height - 22 * mm, "COURO, CONFORTO E CAMINHOS")

    pdf.setFillColor(WHITE)
    pdf.setFont("Helvetica-Bold", 15)
    pdf.drawRightString(width - 14 * mm, height - 14 * mm, "PAINEL DE ESTOQUE")
    pdf.setFillColor(SAND)
    pdf.setFont("Helvetica", 7.5)
    pdf.drawRightString(width - 14 * mm, height - 21 * mm, "Atualizado em 05/10/2026 às 08:00")
    pdf.drawRightString(width - 14 * mm, height - 26 * mm, "Centro de distribuição - São Paulo")

    card_y = height - 69 * mm
    card_gap = 4 * mm
    card_width = (width - 28 * mm - 3 * card_gap) / 4
    total_stock = sum(product.stock for product in PRODUCTS)
    stock_cost = sum(product.cost * product.stock for product in PRODUCTS)
    available_revenue = sum(product.price * product.available for product in PRODUCTS)
    replenishment_count = sum(product.status == "Reposição" for product in PRODUCTS)
    draw_kpi(
        pdf,
        14 * mm,
        card_y,
        card_width,
        "Pares em estoque",
        str(total_stock),
        "+8,2% em relação ao mês anterior",
    )
    draw_kpi(
        pdf,
        14 * mm + card_width + card_gap,
        card_y,
        card_width,
        "Valor em estoque",
        money(stock_cost).removesuffix(",00"),
        "custo de aquisição acumulado",
    )
    draw_kpi(
        pdf,
        14 * mm + 2 * (card_width + card_gap),
        card_y,
        card_width,
        "Potencial de venda",
        money(available_revenue).removesuffix(",00"),
        "preço cheio do estoque disponível",
    )
    draw_kpi(
        pdf,
        14 * mm + 3 * (card_width + card_gap),
        card_y,
        card_width,
        "Reposição prioritária",
        f"{replenishment_count} SKUs",
        "Alpes Neve e Nordic Forrada",
    )

    table_x = 14 * mm
    table_top = card_y - 9 * mm
    row_height = 7.2 * mm
    columns = [
        ("SKU", 18),
        ("Produto", 42),
        ("Categoria", 25),
        ("Cor", 22),
        ("Tamanhos", 19),
        ("Estoque", 18),
        ("Reserv.", 17),
        ("Dispon.", 18),
        ("Custo", 25),
        ("Preço", 25),
        ("Status", 27),
    ]
    table_width = sum(column_width for _, column_width in columns) * mm

    pdf.setFillColor(INK)
    pdf.setFont("Helvetica-Bold", 10)
    pdf.drawString(table_x, table_top, "INVENTÁRIO POR SKU")
    pdf.setFillColor(MUTED)
    pdf.setFont("Helvetica", 7)
    pdf.drawRightString(table_x + table_width, table_top, "Valores em reais · estoque físico menos reservas")

    header_y = table_top - 8 * mm
    pdf.setFillColor(COFFEE)
    pdf.roundRect(table_x, header_y - row_height, table_width, row_height, 2.5 * mm, fill=1, stroke=0)
    cursor_x = table_x
    pdf.setFont("Helvetica-Bold", 6.6)
    pdf.setFillColor(WHITE)
    for label, column_width in columns:
        cell_width = column_width * mm
        pdf.drawString(cursor_x + 2.2 * mm, header_y - 5.2 * mm, label)
        cursor_x += cell_width

    data_y = header_y - row_height
    for row_index, product in enumerate(PRODUCTS):
        row_y = data_y - (row_index + 1) * row_height
        pdf.setFillColor(WHITE if row_index % 2 == 0 else colors.HexColor("#F2ECE5"))
        pdf.rect(table_x, row_y, table_width, row_height, fill=1, stroke=0)
        pdf.setStrokeColor(LINE)
        pdf.setLineWidth(0.35)
        pdf.line(table_x, row_y, table_x + table_width, row_y)

        values = [
            product.sku,
            product.name,
            product.category,
            product.color,
            product.sizes,
            str(product.stock),
            str(product.reserved),
            str(product.available),
            money(product.cost),
            money(product.price),
        ]
        cursor_x = table_x
        pdf.setFillColor(INK)
        for column_index, ((_, column_width), value) in enumerate(zip(columns[:-1], values)):
            cell_width = column_width * mm
            pdf.setFont("Helvetica-Bold" if column_index in (0, 1, 7) else "Helvetica", 6.5)
            if column_index in (5, 6, 7, 8, 9):
                pdf.drawRightString(cursor_x + cell_width - 2 * mm, row_y + 2.35 * mm, value)
            else:
                pdf.drawString(cursor_x + 2.2 * mm, row_y + 2.35 * mm, value)
            cursor_x += cell_width
        draw_status(pdf, cursor_x + 2 * mm, row_y + 0.85 * mm, product.status)

    footer_y = 10 * mm
    pdf.setFillColor(COFFEE)
    pdf.roundRect(14 * mm, footer_y, width - 28 * mm, 16 * mm, 3 * mm, fill=1, stroke=0)
    pdf.setFillColor(WHITE)
    pdf.setFont("Helvetica-Bold", 8)
    pdf.drawString(20 * mm, footer_y + 9.5 * mm, "AÇÃO RECOMENDADA")
    pdf.setFont("Helvetica", 7.2)
    pdf.setFillColor(SAND)
    pdf.drawString(20 * mm, footer_y + 4.8 * mm, "Emitir pedido de 24 pares do Alpes Neve e 18 pares do Nordic Forrada até 07/10 para preservar 30 dias de cobertura.")
    pdf.setFillColor(WHITE)
    pdf.setFont("Helvetica-Bold", 7)
    pdf.drawRightString(width - 20 * mm, footer_y + 7 * mm, "Página 1 de 1")

    pdf.save()


if __name__ == "__main__":
    build_inventory_report()
