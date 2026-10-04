#!/usr/bin/env bash
# Head-to-upper-thigh crops of the main illustrations, not generated artwork.
# Sources are existing 1276x1956 page renders. Each illustration is on the
# second role page: PDF position = the role's first printed page + 3.
set -euo pipefail
root="$(dirname "$(dirname "$(realpath "$0")")")"
source="$root/site/static/books/adventure"
output="$root/site/static/images/adventure/roles"
mkdir -p "$output"
while read -r page crop role; do
  printf -v pdf '%04d' "$((page + 3))"
  magick "$source/page-$pdf.webp" -crop "$crop" +repage -resize 320x480 -quality 88 "$output/role-$page.webp"
done <<'CROPS'
22 640x960+150+180 Daredevil
24 640x960+150+180 Guardian
26 640x960+150+200 Captain
28 640x960+150+170 Hunter
30 600x900+190+200 Heart
32 680x1020+110+215 Star
34 680x1020+110+140 Professor
36 640x960+150+160 Technician
38 680x1020+110+245 Scoundrel
40 680x1020+110+250 Smuggler
CROPS
