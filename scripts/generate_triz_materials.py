from __future__ import annotations

import html
import re
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import PageBreak, Paragraph, SimpleDocTemplate, Spacer


ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = ROOT / "output" / "triz"
PDF_DIR = ROOT / "output" / "pdf"
FONT_REGULAR = "MicrosoftYaHei"
FONT_BOLD = "MicrosoftYaHeiBold"
MD_FILES = [
    "00-unified-info.md",
    "01-work-proposal.md",
    "02-novelty-brief.md",
    "03-ip-proof-template.md",
    "04-submission-checklist.md",
]


def register_fonts() -> None:
    regular = Path(r"C:\Windows\Fonts\msyh.ttc")
    bold = Path(r"C:\Windows\Fonts\msyhbd.ttc")
    if FONT_REGULAR not in pdfmetrics.getRegisteredFontNames():
        pdfmetrics.registerFont(TTFont(FONT_REGULAR, str(regular)))
    if FONT_BOLD not in pdfmetrics.getRegisteredFontNames():
        pdfmetrics.registerFont(TTFont(FONT_BOLD, str(bold)))


def build_styles():
    styles = getSampleStyleSheet()
    styles.add(
        ParagraphStyle(
            name="BodyCN",
            parent=styles["BodyText"],
            fontName=FONT_REGULAR,
            fontSize=10.5,
            leading=16,
            textColor=colors.HexColor("#1f2937"),
            spaceAfter=5,
        )
    )
    styles.add(
        ParagraphStyle(
            name="TitleCN",
            parent=styles["Title"],
            fontName=FONT_BOLD,
            fontSize=20,
            leading=24,
            textColor=colors.HexColor("#0f172a"),
            spaceAfter=12,
        )
    )
    styles.add(
        ParagraphStyle(
            name="Heading1CN",
            parent=styles["Heading1"],
            fontName=FONT_BOLD,
            fontSize=15,
            leading=20,
            textColor=colors.HexColor("#111827"),
            spaceBefore=8,
            spaceAfter=6,
        )
    )
    styles.add(
        ParagraphStyle(
            name="Heading2CN",
            parent=styles["Heading2"],
            fontName=FONT_BOLD,
            fontSize=12.5,
            leading=18,
            textColor=colors.HexColor("#1d4ed8"),
            spaceBefore=8,
            spaceAfter=4,
        )
    )
    styles.add(
        ParagraphStyle(
            name="Heading3CN",
            parent=styles["Heading3"],
            fontName=FONT_BOLD,
            fontSize=11.2,
            leading=16,
            textColor=colors.HexColor("#0f766e"),
            spaceBefore=6,
            spaceAfter=3,
        )
    )
    styles.add(
        ParagraphStyle(
            name="MutedCN",
            parent=styles["BodyText"],
            fontName=FONT_REGULAR,
            fontSize=9.4,
            leading=14,
            textColor=colors.HexColor("#6b7280"),
            spaceAfter=4,
        )
    )
    return styles


def inline_markup(text: str) -> str:
    escaped = html.escape(text, quote=False)
    escaped = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", escaped)
    escaped = re.sub(r"`(.+?)`", r"<font face='%s'>\1</font>" % FONT_BOLD, escaped)
    escaped = escaped.replace("\n", "<br/>")
    return escaped


def append_list_items(story: list, items: list[str], styles, numbered: bool):
    for index, item in enumerate(items, start=1):
        prefix = f"{index}. " if numbered else "- "
        story.append(Paragraph(inline_markup(f"{prefix}{item}"), styles["BodyCN"]))
    story.append(Spacer(1, 4))


def parse_markdown(path: Path, styles):
    story = []
    bullet_buffer: list[str] = []
    number_buffer: list[str] = []

    def flush_lists():
        nonlocal bullet_buffer, number_buffer
        if bullet_buffer:
            append_list_items(story, bullet_buffer, styles, numbered=False)
            bullet_buffer = []
        if number_buffer:
            append_list_items(story, number_buffer, styles, numbered=True)
            number_buffer = []

    lines = path.read_text(encoding="utf-8").splitlines()

    for raw_line in lines:
        line = raw_line.rstrip()
        stripped = line.strip()

        if not stripped:
            flush_lists()
            story.append(Spacer(1, 4))
            continue

        if stripped == "---":
            flush_lists()
            story.append(PageBreak())
            continue

        if stripped.startswith("# "):
            flush_lists()
            story.append(Paragraph(inline_markup(stripped[2:]), styles["TitleCN"]))
            continue

        if stripped.startswith("## "):
            flush_lists()
            story.append(Paragraph(inline_markup(stripped[3:]), styles["Heading1CN"]))
            continue

        if stripped.startswith("### "):
            flush_lists()
            story.append(Paragraph(inline_markup(stripped[4:]), styles["Heading2CN"]))
            continue

        if stripped.startswith("#### "):
            flush_lists()
            story.append(Paragraph(inline_markup(stripped[5:]), styles["Heading3CN"]))
            continue

        if stripped.startswith("> "):
            flush_lists()
            story.append(Paragraph(inline_markup(stripped[2:]), styles["MutedCN"]))
            continue

        if re.match(r"^- ", stripped):
            bullet_buffer.append(stripped[2:].strip())
            continue

        if re.match(r"^\d+\. ", stripped):
            number_buffer.append(re.sub(r"^\d+\.\s+", "", stripped))
            continue

        flush_lists()
        story.append(Paragraph(inline_markup(stripped), styles["BodyCN"]))

    flush_lists()
    return story


def draw_footer(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(colors.HexColor("#cbd5e1"))
    canvas.line(18 * mm, 12 * mm, A4[0] - 18 * mm, 12 * mm)
    canvas.setFont(FONT_REGULAR, 8.5)
    canvas.setFillColor(colors.HexColor("#64748b"))
    canvas.drawString(18 * mm, 7 * mm, "Anion TRIZ Competition Pack")
    canvas.drawRightString(A4[0] - 18 * mm, 7 * mm, f"Page {doc.page}")
    canvas.restoreState()


def render_pdf(md_name: str, styles) -> Path:
    source = SOURCE_DIR / md_name
    target = PDF_DIR / f"{source.stem}.pdf"
    doc = SimpleDocTemplate(
        str(target),
        pagesize=A4,
        leftMargin=18 * mm,
        rightMargin=18 * mm,
        topMargin=18 * mm,
        bottomMargin=18 * mm,
        title=source.stem,
        author="Codex",
    )
    story = parse_markdown(source, styles)
    doc.build(story, onFirstPage=draw_footer, onLaterPages=draw_footer)
    return target


def main() -> None:
    register_fonts()
    styles = build_styles()
    PDF_DIR.mkdir(parents=True, exist_ok=True)
    for md_name in MD_FILES:
        pdf_path = render_pdf(md_name, styles)
        print(f"generated: {pdf_path}")


if __name__ == "__main__":
    main()
