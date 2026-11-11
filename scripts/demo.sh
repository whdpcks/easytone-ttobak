#!/usr/bin/env bash
# ─────────────────────────────────────────────
# 또박 시연 서버 한 번에 켜기 (Mac / Linux / Windows Git Bash)
#
#   ./scripts/demo.sh            백엔드 + 프론트(빌드본) + ngrok 고정 주소
#   ./scripts/demo.sh --local    ngrok 없이 이 컴퓨터에서만 (http://localhost:5173)
#
# 처음 한 번:
#   1) ngrok 설치         Mac: brew install ngrok   Windows: winget install ngrok.ngrok
#   2) 팀 키 등록         ngrok config add-authtoken <팀 노션에 있는 키>
#   3) 주소 파일 만들기   cp .env.ngrok.example .env.ngrok  → NGROK_DOMAIN 채우기
#   4) 백엔드 키          cp backend/.env.example backend/.env → UPSTAGE_API_KEY 채우기
#
# 같은 주소는 한 번에 한 사람만 켤 수 있어요. 끄기: Ctrl+C
# ─────────────────────────────────────────────
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT="$(pwd)"
LOCAL_ONLY=0
[[ "${1:-}" == "--local" ]] && LOCAL_ONLY=1

say() { printf '\033[1;33m▶ %s\033[0m\n' "$*"; }
die() { printf '\033[1;31m✖ %s\033[0m\n' "$*" >&2; exit 1; }

# ── 준비물 확인 ──
PY="$(command -v python3.12 || command -v python3.11 || command -v python3 || command -v python || true)"
[[ -n "$PY" ]] || die "Python 3.11 이상을 설치해 주세요."
command -v npm >/dev/null || die "Node.js(npm)를 설치해 주세요."

if [[ $LOCAL_ONLY -eq 0 ]]; then
  command -v ngrok >/dev/null || die "ngrok을 설치해 주세요. (Mac: brew install ngrok / Windows: winget install ngrok.ngrok)"
  [[ -f .env.ngrok ]] || die ".env.ngrok 이 없어요. cp .env.ngrok.example .env.ngrok 후 NGROK_DOMAIN을 채워 주세요."
  # shellcheck disable=SC1091
  source .env.ngrok
  [[ -n "${NGROK_DOMAIN:-}" && "$NGROK_DOMAIN" != *example* ]] || die ".env.ngrok 의 NGROK_DOMAIN을 팀 주소로 바꿔 주세요."
  NGROK_DOMAIN="${NGROK_DOMAIN#https://}"
fi

# ── 백엔드 ──
cd "$ROOT/backend"
if [[ ! -d .venv ]]; then
  say "백엔드 가상환경 만드는 중 (처음 한 번)"
  "$PY" -m venv .venv
fi
VPY=".venv/bin/python"; [[ -x "$VPY" ]] || VPY=".venv/Scripts/python.exe"   # Windows Git Bash
"$VPY" -m pip install -q --disable-pip-version-check -r requirements.txt
[[ -f .env ]] || say "backend/.env 가 없어요. 문서 분석(C)을 쓰려면 UPSTAGE_API_KEY를 넣어 주세요."

PIDS=()
kill_tree() {   # npm → sh → vite 처럼 손자 프로세스까지 끄기
  local child
  for child in $(pgrep -P "$1" 2>/dev/null); do kill_tree "$child"; done
  kill "$1" 2>/dev/null || true
}
cleanup() {
  say "끄는 중…"
  for p in "${PIDS[@]:-}"; do [[ -n "$p" ]] && kill_tree "$p"; done
  wait 2>/dev/null || true
}
trap 'exit 130' INT TERM
trap cleanup EXIT

say "백엔드 켜는 중 → http://localhost:8000"
"$VPY" -m uvicorn main:app --port 8000 > "$ROOT/backend/data-server.log" 2>&1 &
PIDS+=($!)

# ── 프론트 (빌드본으로 실행: 시연 중 새로고침이 빠르고 안정적) ──
cd "$ROOT/frontend"
[[ -d node_modules ]] || { say "프론트 패키지 설치 중 (처음 한 번)"; npm ci --no-audit --no-fund; }
say "프론트 빌드·실행 중 → http://localhost:5173"
npm run demo > "$ROOT/frontend/demo-server.log" 2>&1 &
PIDS+=($!)

# 두 서버가 뜰 때까지 기다리기
for i in $(seq 1 60); do
  if curl -s -o /dev/null http://localhost:8000/health && curl -s -o /dev/null http://localhost:5173/; then break; fi
  sleep 1
  [[ $i -eq 60 ]] && die "서버가 안 떠요. backend/data-server.log, frontend/demo-server.log 를 확인해 주세요."
done

if [[ $LOCAL_ONLY -eq 1 ]]; then
  say "준비 완료: http://localhost:5173  (끄기: Ctrl+C)"
  wait
  exit 0
fi

say "ngrok 연결 중 → https://$NGROK_DOMAIN"
say "휴대폰에서 위 주소를 열고, 처음 한 번 'Visit Site'를 눌러 주세요. (끄기: Ctrl+C)"
ngrok http --url="$NGROK_DOMAIN" 5173 --log=stdout --log-level=warn
