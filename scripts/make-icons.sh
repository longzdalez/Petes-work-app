#!/bin/sh
# Makes the home-screen icons (PNG) from the SVGs in icons/. Needs rsvg-convert (apt: librsvg2-bin).
# The publish workflow runs this before building. Run it yourself before `npm run dev` if you need the icons locally.
set -e
cd "$(dirname "$0")/.."
out=public/icons
mkdir -p $out
rsvg-convert -w 512 -h 512 icons/icon.svg -o $out/icon-512.png
rsvg-convert -w 192 -h 192 icons/icon.svg -o $out/icon-192.png
rsvg-convert -w 32 -h 32 icons/icon.svg -o $out/favicon-32.png
rsvg-convert -w 512 -h 512 icons/icon-maskable.svg -o $out/icon-512-maskable.png
rsvg-convert -w 180 -h 180 icons/icon-apple.svg -o $out/apple-touch-icon.png
echo "Icons made in $out"
