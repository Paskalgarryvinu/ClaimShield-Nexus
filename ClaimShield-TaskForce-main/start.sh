#!/usr/bin/env bash
set -e
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
echo "======================================================="
echo "         CLAIMSHIELD NEXUS - SIU PLATFORM              "
echo "======================================================="
echo "1. Checking database..."
if [ ! -f "$DIR/backend/claimshield.db" ]; then
    echo "Seeding synthetic database..."
    python3 "$DIR/backend/run_seed.py"
fi

echo ""
echo "2. Launching Backend and Frontend..."
cd "$DIR/backend"
python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload --reload-dir app &
BACKEND_PID=$!

cd "$DIR/frontend"
npm run dev -- --host &
FRONTEND_PID=$!

trap "echo ''; echo 'Stopping ClaimShield services gracefully...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null || true; exit 0" SIGINT SIGTERM EXIT

echo ""
echo "ClaimShield Nexus is live!"
echo "Backend Docs: http://localhost:8000/docs"
echo "Frontend App:  http://localhost:5173"
echo "======================================================="

wait $BACKEND_PID $FRONTEND_PID
