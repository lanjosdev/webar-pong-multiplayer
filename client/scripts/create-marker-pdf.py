from dataclasses import dataclass
from pathlib import Path

from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen.canvas import Canvas


PROJECT_ROOT = Path(__file__).resolve().parents[2]
PAGE_WIDTH, PAGE_HEIGHT = A4


@dataclass(frozen=True)
class TargetSpec:
    height_mm: int
    name: str
    output_name: str
    print_only: bool
    source_path: Path
    target_bottom_mm: int
    width_mm: int


STANDARD_TARGET = TargetSpec(
    height_mm=200,
    name="pong-marker-v2",
    output_name="pong-marker-v2-a4-150x200mm.pdf",
    print_only=False,
    source_path=(
        PROJECT_ROOT
        / "client"
        / "image-targets"
        / "pong-marker-v2"
        / "source"
        / "pong-marker-v2.png"
    ),
    target_bottom_mm=42,
    width_mm=150,
)

MAX_A4_TARGET = TargetSpec(
    height_mm=260,
    name="pong-marker-v2",
    output_name="pong-marker-v2-a4-195x260mm.pdf",
    print_only=True,
    source_path=STANDARD_TARGET.source_path,
    target_bottom_mm=18,
    width_mm=195,
)

FALLBACK_A4_TARGET = TargetSpec(
    height_mm=240,
    name="pong-marker-v2",
    output_name="pong-marker-v2-a4-180x240mm.pdf",
    print_only=True,
    source_path=STANDARD_TARGET.source_path,
    target_bottom_mm=28,
    width_mm=180,
)

TARGETS = (STANDARD_TARGET, MAX_A4_TARGET, FALLBACK_A4_TARGET)


def draw_crop_marks(
    pdf: Canvas, target_left: float, target_bottom: float, target_width: float, target_height: float
) -> None:
    gap = 3 * mm
    length = 5 * mm
    right = target_left + target_width
    top = target_bottom + target_height

    pdf.setStrokeColor(HexColor("#8C929B"))
    pdf.setLineWidth(0.3)

    for x in (target_left, right):
        pdf.line(x, target_bottom - gap - length, x, target_bottom - gap)
        pdf.line(x, top + gap, x, top + gap + length)

    for y in (target_bottom, top):
        pdf.line(target_left - gap - length, y, target_left - gap, y)
        pdf.line(right + gap, y, right + gap + length, y)


def build_pdf(spec: TargetSpec) -> Path:
    if not spec.source_path.is_file():
        raise FileNotFoundError(f"Marker source not found: {spec.source_path}")

    output_path = PROJECT_ROOT / "output" / "pdf" / spec.output_name
    output_path.parent.mkdir(parents=True, exist_ok=True)
    target_width = spec.width_mm * mm
    target_height = spec.height_mm * mm
    target_left = (PAGE_WIDTH - target_width) / 2
    target_bottom = spec.target_bottom_mm * mm

    pdf = Canvas(str(output_path), pagesize=A4, pageCompression=1)
    pdf.setTitle(
        f"Pong WebAR - Image Target A4 {spec.width_mm} x {spec.height_mm} mm"
    )
    pdf.setAuthor("Pong WebAR")

    if not spec.print_only:
        pdf.setFillColor(HexColor("#111318"))
        pdf.setFont("Helvetica-Bold", 16)
        pdf.drawCentredString(PAGE_WIDTH / 2, 280 * mm, "MARCADOR DE REALIDADE AUMENTADA")

        pdf.setFillColor(HexColor("#353A43"))
        pdf.setFont("Helvetica", 10)
        pdf.drawCentredString(
            PAGE_WIDTH / 2,
            272 * mm,
            "Imprima em tamanho real (escala 100%). Nao use ajustar a pagina.",
        )
        pdf.drawCentredString(
            PAGE_WIDTH / 2,
            266 * mm,
            f"Tamanho final: {spec.width_mm} x {spec.height_mm} mm. Prefira papel fosco.",
        )

    pdf.drawImage(
        str(spec.source_path),
        target_left,
        target_bottom,
        width=target_width,
        height=target_height,
        preserveAspectRatio=True,
        mask="auto",
    )
    if spec.print_only:
        pdf.setFillColor(HexColor("#353A43"))
        pdf.setFont("Helvetica", 7)
        pdf.drawCentredString(
            PAGE_WIDTH / 2,
            7 * mm,
            f"{spec.name} - {spec.width_mm} x {spec.height_mm} mm - imprimir em escala 100%",
        )
    else:
        draw_crop_marks(pdf, target_left, target_bottom, target_width, target_height)
        pdf.setFillColor(HexColor("#353A43"))
        pdf.setFont("Helvetica", 9)
        pdf.drawCentredString(
            PAGE_WIDTH / 2,
            30 * mm,
            "Aponte a camera para o marcador inteiro, com boa iluminacao e sem reflexos.",
        )
        pdf.drawCentredString(PAGE_WIDTH / 2, 24 * mm, f"Versao do target: {spec.name}")

    pdf.showPage()
    pdf.save()
    return output_path


if __name__ == "__main__":
    for target in TARGETS:
        print(build_pdf(target))
