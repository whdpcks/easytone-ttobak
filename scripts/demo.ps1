# ─────────────────────────────────────────────
# 또박 시연 서버 한 번에 켜기 (Windows PowerShell)
#
#   powershell -ExecutionPolicy Bypass -File scripts\demo.ps1          백엔드 + 프론트 + ngrok
#   powershell -ExecutionPolicy Bypass -File scripts\demo.ps1 -Local   ngrok 없이 이 컴퓨터에서만
#
# 처음 한 번: winget install ngrok.ngrok → ngrok config add-authtoken <팀 키>
#             copy .env.ngrok.example .env.ngrok → NGROK_DOMAIN 채우기
# 끄기: Ctrl+C
# ─────────────────────────────────────────────
param([switch]$Local)
$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

function Say($m) { Write-Host "▶ $m" -ForegroundColor Yellow }
function Die($m) { Write-Host "✖ $m" -ForegroundColor Red; exit 1 }

if (-not (Get-Command python -ErrorAction SilentlyContinue)) { Die "Python 3.11 이상을 설치해 주세요." }
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) { Die "Node.js(npm)를 설치해 주세요." }

if (-not $Local) {
  if (-not (Get-Command ngrok -ErrorAction SilentlyContinue)) { Die "ngrok을 설치해 주세요: winget install ngrok.ngrok" }
  if (-not (Test-Path .env.ngrok)) { Die ".env.ngrok 이 없어요. copy .env.ngrok.example .env.ngrok 후 NGROK_DOMAIN을 채워 주세요." }
  $Domain = (Get-Content .env.ngrok | Where-Object { $_ -match '^NGROK_DOMAIN=' }) -replace '^NGROK_DOMAIN=', '' -replace '^https://', ''
  if (-not $Domain -or $Domain -like '*example*') { Die ".env.ngrok 의 NGROK_DOMAIN을 팀 주소로 바꿔 주세요." }
}

# 백엔드
Set-Location "$Root\backend"
if (-not (Test-Path .venv)) { Say "백엔드 가상환경 만드는 중 (처음 한 번)"; python -m venv .venv }
& .\.venv\Scripts\python.exe -m pip install -q --disable-pip-version-check -r requirements.txt
$env:PYTHONIOENCODING = "utf-8"
Say "백엔드 켜는 중 → http://localhost:8000"
$be = Start-Process -PassThru -NoNewWindow -FilePath ".\.venv\Scripts\python.exe" `
  -ArgumentList "-m uvicorn main:app --port 8000" -RedirectStandardOutput "data-server.log" -RedirectStandardError "data-server.err.log"

# 프론트
Set-Location "$Root\frontend"
if (-not (Test-Path node_modules)) { Say "프론트 패키지 설치 중 (처음 한 번)"; npm ci --no-audit --no-fund }
Say "프론트 빌드·실행 중 → http://localhost:5173"
$fe = Start-Process -PassThru -NoNewWindow -FilePath "cmd.exe" -ArgumentList "/c npm run demo > demo-server.log 2>&1"

try {
  for ($i = 0; $i -lt 60; $i++) {
    try {
      Invoke-WebRequest -UseBasicParsing http://localhost:8000/health | Out-Null
      Invoke-WebRequest -UseBasicParsing http://localhost:5173/ | Out-Null
      break
    } catch { Start-Sleep 1 }
  }
  if ($Local) {
    Say "준비 완료: http://localhost:5173  (끄기: Ctrl+C)"
    Wait-Process -Id $fe.Id
  } else {
    Say "ngrok 연결 중 → https://$Domain"
    Say "휴대폰에서 위 주소를 열고, 처음 한 번 'Visit Site'를 눌러 주세요. (끄기: Ctrl+C)"
    ngrok http --url="$Domain" 5173 --log=stdout --log-level=warn
  }
} finally {
  Say "끄는 중…"
  Stop-Process -Id $be.Id -ErrorAction SilentlyContinue
  taskkill /PID $fe.Id /T /F 2>$null | Out-Null
}
