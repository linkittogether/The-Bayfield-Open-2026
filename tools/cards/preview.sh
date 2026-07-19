#!/bin/bash
# Render a generated card HTML to a PNG for visual review (headless Chrome).
#
#   tools/cards/preview.sh players/joe.html [out.png]
#
# Wraps the file with a UTF-8 charset (the raw card HTML omits <head>, since the
# Artifact host supplies one) so em-dashes / stars / emoji render correctly, then
# screenshots at 2x. Used to self-review layout without publishing.
set -e
in="$1"
out="${2:-${in%.html}.png}"
chrome="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
[ -x "$chrome" ] || chrome="$(command -v chromium || command -v chromium-browser || true)"
[ -n "$chrome" ] || { echo "no Chrome/Chromium found"; exit 1; }

tmp="$(dirname "$out")/.preview.html"
printf '<!doctype html><html><head><meta charset="utf-8"></head><body>\n' > "$tmp"
cat "$in" >> "$tmp"
printf '\n</body></html>' >> "$tmp"

"$chrome" --headless=new --disable-gpu --hide-scrollbars \
  --force-device-scale-factor=2 --window-size=580,905 \
  --screenshot="$out" "file://$tmp" >/dev/null 2>&1
rm -f "$tmp"
echo "wrote $out"
