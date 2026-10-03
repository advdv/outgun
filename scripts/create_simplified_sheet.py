#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.10"
# dependencies = ["reportlab==4.4.10", "pymupdf==1.28.2"]
# ///
"""Build a textured A4 landscape sheet without the omitted homebrew mechanics.

Source: html/outgunned-adventure-sheets-en/
outgunned-adventure-adventurer-sheet-blank-en/page-0001.md.
The supplied original PDF provides its map/paper textures, logo, backpack,
and embedded display font. --web-backdrop exports the adapted artwork for the
editable site prototype; confirm redistribution permission before public release.
"""

import argparse
import base64
from io import BytesIO
from pathlib import Path
from tempfile import TemporaryDirectory
import xml.etree.ElementTree as ET

import pymupdf
from PIL import Image
from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas


SOURCE = Path(__file__).resolve().parents[1] / (
    "outgunned-adventure-sheets-en/outgunned-adventure-adventurer-sheet-blank-en.pdf"
)
BROWN = HexColor("#634123")
INK = HexColor("#33261c")
RULE = HexColor("#bcb4a4")
PAPER = HexColor("#fcfaf4")

ATTRIBUTES = {
    "BRAWN": ("ENDURE", "FIGHT", "FORCE", "STUNT"),
    "NERVES": ("COOL", "DRIVE", "SHOOT", "SURVIVAL"),
    "SMOOTH": ("FLIRT", "LEADERSHIP", "SPEECH", "STYLE"),
    "FOCUS": ("DETECT", "FIX", "HEAL", "KNOW"),
    "CRIME": ("AWARENESS", "DEXTERITY", "STEALTH", "STREETWISE"),
}


def create_sheet(destination):
    destination.parent.mkdir(parents=True, exist_ok=True)
    width, height = landscape(A4)
    source = pymupdf.open(SOURCE)
    font = source.extract_font(157)[3]
    pdfmetrics.registerFont(TTFont("Adventure", BytesIO(font)))

    def asset(xref):
        image = source.extract_image(xref)
        pixmap = pymupdf.Pixmap(source, xref)
        if image["smask"]:
            pixmap = pymupdf.Pixmap(pixmap, pymupdf.Pixmap(source, image["smask"]))
        return ImageReader(BytesIO(pixmap.tobytes("png")))

    # Xrefs refer to the unchanged supplied original, not rendered page crops.
    map_texture = asset(326)
    paper_texture = asset(179)
    logo = asset(180)
    backpack = asset(379)
    pdf = canvas.Canvas(str(destination), pagesize=(width, height), invariant=1)
    pdf.setTitle("Outgunned Adventure - Textured Simplified Player Sheet")
    pdf.setAuthor("Unofficial homebrew adaptation")
    pdf.setSubject("Single-page adventurer sheet without conditions or Bad")

    # Coordinates below are measured from the top-left, in PDF points.
    def text(x, y, value, size=9, bold=False, color=INK, align="left", display=False):
        pdf.setFillColor(color)
        face = "Adventure" if display else "Helvetica-Bold" if bold else "Helvetica"
        pdf.setFont(face, size)
        draw = {"left": pdf.drawString, "right": pdf.drawRightString,
                "center": pdf.drawCentredString}[align]
        draw(x, height - y, value)

    def line(x1, y1, x2, y2, color=RULE, weight=0.5):
        pdf.setStrokeColor(color)
        pdf.setLineWidth(weight)
        pdf.line(x1, height - y1, x2, height - y2)

    def box(x, y, w, h, fill=None, weight=0.7, color=BROWN):
        pdf.setStrokeColor(color)
        if fill is not None:
            pdf.setFillColor(fill)
        pdf.setLineWidth(weight)
        pdf.rect(x, height - y - h, w, h, fill=int(fill is not None), stroke=1)

    def image(asset_image, x, y, w, h):
        pdf.drawImage(asset_image, x, height - y - h, w, h, mask="auto")

    def polygon(points, fill=BROWN, stroke=None, weight=0.7):
        path = pdf.beginPath()
        path.moveTo(points[0][0], height - points[0][1])
        for x, y in points[1:]:
            path.lineTo(x, height - y)
        path.close()
        pdf.setFillColor(fill)
        pdf.setStrokeColor(stroke or fill)
        pdf.setLineWidth(weight)
        pdf.drawPath(path, fill=1, stroke=int(stroke is not None))

    def banner(x, y, w, label, size=15):
        polygon([(x + 7, y), (x + w, y), (x + w - 2, y + 18), (x, y + 18)])
        text(x + w / 2 + 2, y + 13.5, label, size=size, display=True,
             color=PAPER, align="center")

    def ratings(x, y, filled):
        for index in range(3):
            cx = x + index * 15
            polygon([(cx, y - 3.4), (cx + 3.4, y),
                     (cx, y + 3.4), (cx - 3.4, y)],
                    fill=BROWN if index < filled else PAPER, stroke=BROWN)

    def field(x, y, w, label):
        text(x, y, label, size=7, bold=True, color=BROWN)
        line(x, y + 14, x + w, y + 14, color=BROWN, weight=0.7)

    def shield(x, y):
        # Hollow shields echo the original, leaving their centers writable.
        points = [(0, 3), (10.5, 0), (21, 3), (20, 12), (16, 18),
                  (10.5, 21), (5, 18), (1, 12)]
        polygon([(x + dx, y + dy) for dx, dy in points])
        polygon([(x + 10.5 + (dx - 10.5) * 0.62,
                  y + 10 + (dy - 10) * 0.62) for dx, dy in points], fill=PAPER)

    def bolt(x, y):
        polygon([(x + 9, y), (x + 2, y + 10), (x + 7, y + 10),
                 (x + 4, y + 18), (x + 13, y + 7), (x + 8, y + 7)])

    def cartridge(x, y):
        polygon([(x, y + 15), (x, y + 5), (x + 2.5, y),
                 (x + 5, y + 5), (x + 5, y + 15)], fill=PAPER,
                stroke=BROWN, weight=0.5)
        line(x, y + 6, x + 5, y + 6, color=BROWN, weight=0.4)
        box(x - 0.7, y + 15, 6.4, 1.5, fill=PAPER, weight=0.5)

    # Reuse the antique map without the original's brown leather edge.
    image(map_texture, 0, 0, width, height)

    # A tilted, textured photograph card with the original logo and a paperclip.
    pdf.saveState()
    pdf.translate(77, height - 112)
    pdf.rotate(3)
    pdf.setFillColor(HexColor("#c2b49c"))
    pdf.rect(-57, -95, 117, 190, fill=1, stroke=0)
    pdf.drawImage(paper_texture, -60, -92, 117, 190, mask="auto")
    pdf.setLineWidth(0.5)
    pdf.setStrokeColor(RULE)
    pdf.rect(-60, -92, 117, 190, fill=0, stroke=1)
    pdf.setFillColor(HexColor("#f8f7f3"))
    pdf.setStrokeColor(INK)
    pdf.roundRect(-52, -54, 101, 142, 2, fill=1, stroke=1)
    # Center the smaller logo in the lower border, clear of an uploaded portrait.
    pdf.drawImage(logo, -37, -86.2, 72, 26.4, mask="auto")
    pdf.restoreState()
    pdf.saveState()
    pdf.translate(29, height - 13)
    pdf.rotate(-15)
    clip = pdf.beginPath()
    clip.moveTo(0, -35)
    clip.lineTo(0, 1)
    clip.curveTo(0, 12, 16, 12, 16, 1)
    clip.lineTo(16, -41)
    clip.curveTo(16, -56, -7, -56, -7, -41)
    clip.lineTo(-7, -4)
    pdf.setStrokeColor(BROWN)
    pdf.setLineWidth(1.8)
    pdf.drawPath(clip, fill=0, stroke=1)
    pdf.restoreState()

    field(155, 39, 338, "NAME")
    field(155, 69, 338, "ROLE")
    field(155, 99, 338, "TROPE")
    field(155, 129, 245, "BACKGROUND")
    field(417, 129, 76, "AGE")
    field(155, 159, 338, "FLAW")
    field(155, 189, 338, "CATCHPHRASE")

    # Six illustrated Luck tickets; no Spotlight conversion reminder.
    text(664, 44, "LUCK!", size=18, display=True, color=BROWN, align="center")
    for index in range(6):
        x = 548 + index * 42
        box(x, 62, 19, 26, fill=PAPER, weight=0.8)
        bolt(x + 2, 66)
    text(664, 106, "SPEND 1 LUCK: GAIN +1", size=7.5, bold=True,
         color=BROWN, align="center")

    # All twelve Grit shields remain. Only the final shield is special now.
    text(520, 141, "GRIT", size=17, display=True, color=BROWN)
    for index in range(12):
        x = 520 + index * 24.7
        shield(x, 159)
        text(x + 10.5, 191, str(index + 1), size=6, color=BROWN, align="center")
    # Flame above the Hot shield, not over its writable center.
    polygon([(800, 160), (796, 156), (797, 150), (801, 145),
             (800, 152), (804, 148), (807, 154), (805, 160)])
    text(803, 204, "HOT!", size=7, bold=True, color=BROWN, align="center")
    text(520, 207, "HOT: GAIN 2 LUCK", size=7, bold=True, color=BROWN)

    # Ratings retain the original prefilled baseline: 2 attribute / 1 skill.
    for index, (attribute, skills) in enumerate(ATTRIBUTES.items()):
        y = 218 + index * 72
        banner(24, y, 133, attribute)
        ratings(188, y + 9, filled=2)
        for skill_index, skill in enumerate(skills):
            sy = y + 28 + skill_index * 12.5
            text(40, sy, skill, size=9, bold=True)
            ratings(188, sy - 3, filled=1)

    # Six tabbed note cards with the original paper texture and pale ruled lines.
    text(501, 233, "FEATS", size=17, display=True, color=BROWN, align="right")
    for index in range(6):
        y = 245 + index * 53
        polygon([(256, y - 5), (385, y - 5), (390, y), (503, y),
                 (503, y + 45), (256, y + 45)])
        image(paper_texture, 257, y + 2, 245, 42)
        box(256, y + 1, 247, 44)
        line(264, y + 16, 495, y + 16)
        line(264, y + 30, 495, y + 30)

    # Six gear rows, with cartridge illustrations for the first three weapons.
    banner(520, 220, 294, "GUNS & GEAR")
    image(paper_texture, 520, 239, 294, 153)
    box(520, 238, 294, 154)
    text(804, 249, "AMMO", size=5.8, bold=True, color=BROWN, align="right")
    for index in range(6):
        y = 272 + index * 23
        line(527, y, 807, y)
        if index < 3:
            for ammo in range(3):
                cartridge(771 + ammo * 15, y - 19)

    text(627, 417, "CA$H", size=15, display=True, color=BROWN)
    for index in range(5):
        x = 701 + index * 26
        pdf.setFillColor(PAPER)
        pdf.setStrokeColor(BROWN)
        pdf.setLineWidth(0.6)
        pdf.circle(x, height - 412, 6.2, fill=1, stroke=1)
        text(x, 415.1, "$", size=9, bold=True, color=BROWN, align="center")

    # Tuck the illustration behind its paper panel, as on the original sheet.
    image(backpack, 505, 429, 118, 131)
    for x, label in ((551, "BACKPACK"), (692, "BAG")):
        w = 123 if label == "BACKPACK" else 122
        banner(x, 442, w, label, size=13)
        image(paper_texture, x, 461, w, 99)
        box(x, 460, w, 100)
        for index in range(5):
            y = 479 + index * 19
            line(x + 5, y, x + w - 5, y)

    text(28, 582, "Unofficial homebrew sheet / Original artwork: Two Little Mice",
         size=6, color=BROWN)
    text(814, 582, "SIMPLIFIED PLAYER SHEET / A4 LANDSCAPE", size=6,
         color=BROWN, align="right")
    pdf.showPage()
    pdf.save()
    source.close()


def create_web_backdrop(destination):
    """Reuse the approved layout as vector artwork, not a rasterized PDF page.

    Only four bitmap assets are embedded (map, paper, logo, backpack). Static
    lettering becomes paths, so no extracted font file or source PDF is shipped.
    The browser app places accessible HTML controls over these fixed coordinates.
    """
    with TemporaryDirectory() as temporary:
        pdf_path = Path(temporary) / "sheet.pdf"
        create_sheet(pdf_path)
        with pymupdf.open(pdf_path) as document:
            svg = ET.fromstring(document[0].get_svg_image(text_as_path=True))
    ET.register_namespace("", "http://www.w3.org/2000/svg")
    ET.register_namespace("xlink", "http://www.w3.org/1999/xlink")
    href = "{http://www.w3.org/1999/xlink}href"
    for element in svg.iter("{http://www.w3.org/2000/svg}image"):
        encoded = element.get(href)
        if encoded and encoded.startswith("data:image/"):
            bitmap = Image.open(BytesIO(base64.b64decode(encoded.split(",", 1)[1])))
            output = BytesIO()
            bitmap.save(output, format="WEBP", quality=90,
                        lossless="A" in bitmap.getbands())
            element.set(href, "data:image/webp;base64," + base64.b64encode(output.getvalue()).decode())
    destination.parent.mkdir(parents=True, exist_ok=True)
    ET.ElementTree(svg).write(destination, encoding="utf-8", xml_declaration=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "output", nargs="?", type=Path,
        default=Path(".amp/in/artifacts/outgunned-adventure-textured-sheet.pdf"),
    )
    parser.add_argument("--web-backdrop", action="store_true",
                        help="Write the approved layout as an SVG web asset instead of a PDF")
    args = parser.parse_args()
    if args.web_backdrop:
        create_web_backdrop(args.output)
    else:
        create_sheet(args.output)
    print(f"Created {args.output}")
