#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_ROOT"

echo "몽이 시작 루틴을 엽니다."
echo

if npm run start:chrome; then
  echo
  echo "몽! CDP Chrome 준비가 끝났습니다."
  echo "Codex/Claude usage page에서 로그인 상태를 확인하세요."
  echo "로그인이나 Turnstile이 보이면 Chrome에서 직접 통과하세요."
  echo "launchd가 설치되어 있으면 monitor는 자동 실행됩니다."
  echo "상태가 애매하면 터미널에서 npm run health 를 실행하세요."
  status=0
else
  status=$?
  echo
  echo "몽이 시작 루틴이 실패했습니다."
  echo "터미널에서 npm run health 또는 npm run check:cdp 로 상태를 확인하세요."
fi

echo
printf "Enter를 누르면 창이 닫힙니다..."
read -r _ || true

exit "$status"
