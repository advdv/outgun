#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.10"
# dependencies = ["reportlab==4.4.10"]
# ///
"""Build a printable A4 landscape sheet with the requested sections omitted.

Source: html/outgunned-adventure-sheets-en/
outgunned-adventure-adventurer-sheet-blank-en/page-0001.md.
The original PDF also supplies the rating marks and non-text trackers.
"""

import argparse
from pathlib import Path

from reportlab.lib.pagesizes import A4, landscape
from reportlab.pdfgen import canvas


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
    pdf = canvas.Canvas(str(destination), pagesize=(width, height), invariant=1)
    pdf.setTitle("Outgunned Adventure - Simplified Player Sheet")
    pdf.setAuthor("Unofficial homebrew adaptation")
    pdf.setSubject("Printable single-page adventurer sheet")

    # Coordinates below are measured from the top-left, in PDF points.
    def text(x, y, value, size=9, bold=False, gray=0.12, align="left"):
        pdf.setFillGray(gray)
        pdf.setFont("Helvetica-Bold" if bold else "Helvetica", size)
        draw = {"left": pdf.drawString, "right": pdf.drawRightString,
                "center": pdf.drawCentredString}[align]
        draw(x, height - y, value)

    def line(x1, y1, x2, y2, gray=0.65, weight=0.5):
        pdf.setStrokeGray(gray)
        pdf.setLineWidth(weight)
        pdf.line(x1, height - y1, x2, height - y2)

    def box(x, y, w, h, weight=0.7, gray=0.25):
        pdf.setStrokeGray(gray)
        pdf.setLineWidth(weight)
        pdf.rect(x, height - y - h, w, h, fill=0, stroke=1)

    def circle(x, y, radius=5, weight=0.8):
        pdf.setStrokeGray(0.15)
        pdf.setLineWidth(weight)
        pdf.circle(x, height - y, radius, fill=0, stroke=1)

    def ratings(x, y, filled):
        for index in range(3):
            cx = x + index * 15
            cy = height - y
            path = pdf.beginPath()
            path.moveTo(cx, cy + 3.3)
            path.lineTo(cx + 3.3, cy)
            path.lineTo(cx, cy - 3.3)
            path.lineTo(cx - 3.3, cy)
            path.close()
            pdf.setFillGray(0.12)
            pdf.setStrokeGray(0.12)
            pdf.setLineWidth(0.7)
            pdf.drawPath(path, fill=int(index < filled), stroke=1)

    def field(x, y, w, label):
        text(x, y, label, size=7, bold=True, gray=0.35)
        line(x, y + 14, x + w, y + 14)

    def section(x, y, w, label):
        text(x, y, label, size=10, bold=True)
        line(x, y + 7, x + w, y + 7, gray=0.18, weight=1)

    # Identity and portrait.
    text(28, 24, "OUTGUNNED", size=8, bold=True, gray=0.4)
    text(27, 53, "ADVENTURE", size=23, bold=True)
    text(width - 28, 43, "SIMPLIFIED PLAYER SHEET", size=10,
         bold=True, align="right")
    line(28, 65, width - 28, 65, gray=0.18, weight=1)
    box(28, 80, 82, 120, gray=0.65)
    text(69, 191, "PORTRAIT", size=6.5, gray=0.5, align="center")
    field(126, 85, 375, "NAME")
    field(126, 110, 179, "ROLE")
    field(322, 110, 179, "TROPE")
    field(126, 135, 278, "BACKGROUND")
    field(421, 135, 80, "AGE")
    field(126, 160, 375, "FLAW")
    field(126, 185, 375, "CATCHPHRASE")

    # Keep six Luck marks, but remove its conversion-to-Spotlight reminder.
    text(520, 89, "LUCK", size=11, bold=True)
    for index in range(6):
        circle(605 + index * 37.5, 85, radius=6)
    text(520, 113, "SPEND 1 LUCK: GAIN +1", size=7.5, gray=0.35)

    # Twelve Grit boxes, with the original eighth (Bad) and last (Hot) markers.
    text(520, 140, "GRIT", size=11, bold=True)
    for index in range(12):
        x = 520 + index * 25.1
        box(x, 158, 17, 17, weight=1.2 if index in (7, 11) else 0.7)
        text(x + 8.5, 154, str(index + 1), size=5.8,
             gray=0.45, align="center")
        if index in (7, 11):
            text(x + 8.5, 185, "BAD!" if index == 7 else "HOT!",
                 size=6.5, bold=True, align="center")
    text(520, 201, "BAD: SUFFER A CONDITION", size=7, gray=0.35)
    text(width - 28, 201, "HOT: GAIN 2 LUCK", size=7, gray=0.35, align="right")

    # Ratings retain the original prefilled baseline: 2 attribute / 1 skill.
    section(28, 233, 215, "ATTRIBUTES & SKILLS")
    for index, (attribute, skills) in enumerate(ATTRIBUTES.items()):
        y = 254 + index * 65
        text(28, y, attribute, size=10, bold=True)
        ratings(194, y - 3.5, filled=2)
        for skill_index, skill in enumerate(skills):
            sy = y + 13 + skill_index * 12.5
            text(40, sy, skill, size=9)
            ratings(194, sy - 3, filled=1)

    # Six separate feat spaces, as on the original sheet.
    section(262, 233, 239, "FEATS")
    for index in range(6):
        y = 253 + index * 52
        box(262, y, 239, 46, gray=0.55)
        text(269, y + 12, f"0{index + 1}", size=6, gray=0.5)
        line(283, y + 15, 493, y + 15, gray=0.72)
        line(270, y + 30, 493, y + 30, gray=0.8)

    # Six gear rows; the first three each retain three ammunition marks.
    section(520, 233, width - 548, "GUNS & GEAR")
    text(width - 28, 257, "AMMO", size=6.5, gray=0.4, align="right")
    for index in range(6):
        y = 279 + index * 22
        end = 752 if index < 3 else width - 28
        line(520, y, end, y)
        if index < 3:
            for ammo in range(3):
                circle(772 + ammo * 17, y - 5, radius=4)

    text(520, 417, "CA$H", size=10, bold=True)
    for index in range(5):
        circle(686 + index * 30, 413, radius=5.5)
    for x, label in ((520, "BACKPACK"), (676, "BAG")):
        section(x, 446, 138, label)
        for index in range(5):
            y = 475 + index * 21
            line(x, y, x + 138, y)

    text(28, 582, "Unofficial homebrew sheet / Personal use", size=6, gray=0.45)
    text(width - 28, 582, "A4 LANDSCAPE", size=6, gray=0.45, align="right")
    pdf.showPage()
    pdf.save()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "output", nargs="?", type=Path,
        default=Path(".amp/in/artifacts/outgunned-adventure-simplified-sheet.pdf"),
    )
    args = parser.parse_args()
    create_sheet(args.output)
    print(f"Created {args.output}")
