#!/usr/bin/env bash
set -e
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
echo "Starting ClaimShield Nexus Backend on http://localhost:8000 ..."
cd "$DIR/backend"
exec python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload --reload-dir app
