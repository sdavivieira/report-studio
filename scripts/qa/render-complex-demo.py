from __future__ import annotations

import subprocess
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont
from pypdf import PdfReader


ROOT = Path(__file__).resolve().parents[2]
PDF = ROOT / "output/demonstracao/relatorio-vendas-computadores-demonstracao.pdf"
OUTPUT = ROOT / "output/demonstracao/final-complexo"
PDFTOPPM = Path(
    r"C:\Users\Micro\.cache\codex-runtimes\codex-primary-runtime\dependencies"
    r"\native\poppler\Library\bin\pdftoppm.exe"
)


def main() -> None:
    reader = PdfReader(PDF)
    if len(reader.pages) != 5:
        raise RuntimeError(f"Esperadas 5 páginas, recebido: {len(reader.pages)}")
    OUTPUT.mkdir(parents=True, exist_ok=True)
    rendered = []
    for page in range(1, 6):
        prefix = OUTPUT / f"pagina-{page}"
        subprocess.run(
            [
                str(PDFTOPPM),
                "-png",
                "-r",
                "110",
                "-f",
                str(page),
                "-l",
                str(page),
                "-singlefile",
                str(PDF),
                str(prefix),
            ],
            check=True,
            capture_output=True,
        )
        rendered.append(prefix.with_suffix(".png"))

    width, height = 720, 920
    sheet = Image.new("RGB", (width * 3, (height + 60) * 2), "#e7e5e4")
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default()
    for index, path in enumerate(rendered):
        page = Image.open(path).convert("RGB")
        page.thumbnail((width - 30, height - 20))
        column, row = index % 3, index // 3
        x = column * width + (width - page.width) // 2
        y = row * (height + 60) + 10
        sheet.paste(page, (x, y))
        draw.text(
            (column * width + 20, row * (height + 60) + height + 20),
            f"Página {index + 1}",
            fill="#1c1917",
            font=font,
        )
    sheet.save(OUTPUT / "visao-geral-5-paginas.png")
    print(f"PDF validado e {len(rendered)} páginas renderizadas")


if __name__ == "__main__":
    main()
