#!/usr/bin/env bash
# Renders every concept image used by the site. ~1 hour on 4 CPU cores.
# Usage: PY=/path/to/python-with-bpy OUT=/path/to/output bash scripts/render/render_all.sh
set -u
PY=${PY:-python3}
OUT=${OUT:-renders-raw}
RES=${RES:-"1500 1000"}
SAMPLES=${SAMPLES:-64}
HERE="$(cd "$(dirname "$0")" && pwd)"
mkdir -p "$OUT"
jobs=(
  "a before day wide" "a modern day wide" "a classic day wide" "a dark day wide" "a light day wide" "a specials day wide"
  "b before day wide" "b modern day wide" "b classic day wide" "b dark day wide" "b light day wide" "b specials day wide"
  "c before day wide" "c modern day wide" "c classic day wide" "c dark day wide" "c light day wide" "c specials day wide"
  "b dark evening wide"
  "b modern day detail" "b classic day detail" "b dark day detail" "b light day detail" "b specials day detail"
)
for j in "${jobs[@]}"; do
  set -- $j
  name="room-$1-$2"
  [ "$3" = "evening" ] && name="$name-evening"
  [ "$4" = "detail" ] && name="detail-$2"
  if [ -f "$OUT/$name.png" ]; then echo "skip $name"; continue; fi
  start=$(date +%s)
  "$PY" "$HERE/scenes.py" --room "$1" --style "$2" --light "$3" --shot "$4" --res $RES --samples "$SAMPLES" --out "$OUT/$name.png" > "$OUT/$name.log" 2>&1
  echo "$name $(( $(date +%s) - start ))s"
done
echo ALL_DONE
