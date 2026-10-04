#!/usr/bin/env bash
# Crops of the existing Adventure page renders (PDF positions, not printed pages).
set -euo pipefail
root="$(dirname "$(dirname "$(realpath "$0")")")"
source="$root/site/static/books/adventure"
output="$root/site/static/images/adventure"
mkdir -p "$output"
magick "$source/page-0016.webp" -crop 1276x1000+0+180 +repage -resize 1200x -quality 88 "$output/dart-trap.webp"
magick "$source/page-0014.webp" -crop 1276x1220+0+736 +repage -resize 850x -quality 88 "$output/explorer.webp"
magick "$source/page-0012.webp" -crop 1030x775+135+1090 +repage -resize 720x -quality 88 "$output/expedition-chest.webp"
