#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_ROOT"

echo "Mongi Start"
echo
echo "1. CDP Chrome 준비 중..."

if npm run start:chrome; then
  echo
  echo "2. Codex/Claude usage page를 확인하세요."
  echo "3. launchd monitor는 10분마다 자동 실행됩니다."
  echo "4. 상태 확인: npm run health"
  status=0
else
  status=$?
  echo
  echo "Mongi Start 실패"
  echo "다음 확인: npm run health"
fi

echo
printf "Enter를 누르면 창이 닫힙니다..."
read -r _ || true

exit "$status"
