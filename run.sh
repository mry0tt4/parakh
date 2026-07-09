#!/usr/bin/env bash
# Parakh one-command demo launcher.
#   ./run.sh          start both servers (reuse existing DB)
#   ./run.sh --fresh  reseed the demo database first
set -euo pipefail
cd "$(dirname "$0")"

echo "▸ Clearing ports 8000/5173..."
lsof -ti:8000 2>/dev/null | xargs kill -9 2>/dev/null || true
lsof -ti:5173 2>/dev/null | xargs kill -9 2>/dev/null || true
sleep 1

if [[ "${1:-}" == "--fresh" ]]; then
  echo "▸ Fresh seed requested — removing demo database..."
  rm -f backend/parakh.db
fi

if [[ ! -d backend/.venv ]]; then
  echo "▸ Creating backend venv (python3.13)..."
  (cd backend && python3.13 -m venv .venv && .venv/bin/pip install -q -r requirements.txt)
fi
if [[ ! -d frontend/node_modules ]]; then
  echo "▸ Installing frontend dependencies..."
  (cd frontend && npm install --silent)
fi

echo "▸ Starting backend on :8000 (auto-seeds if empty)..."
(cd backend && nohup .venv/bin/uvicorn app.main:app --port 8000 > /tmp/parakh-backend.log 2>&1 &)

echo "▸ Starting frontend on :5173..."
(cd frontend && nohup npm run dev > /tmp/parakh-frontend.log 2>&1 &)

echo -n "▸ Waiting for API"
for _ in $(seq 1 60); do
  if curl -sf http://localhost:8000/api/v1/health > /dev/null 2>&1; then break; fi
  echo -n "."; sleep 1
done
echo
curl -sf http://localhost:8000/api/v1/health > /dev/null || { echo "Backend failed — see /tmp/parakh-backend.log"; exit 1; }

echo "✓ Parakh is up:  http://localhost:5173   (API docs: http://localhost:8000/docs)"
echo "  officer@parakh.demo / Officer@2026 · risk@parakh.demo / Risk@2026"
command -v open > /dev/null && open http://localhost:5173 || true
