#!/usr/bin/env bash
set -e
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
echo "Starting ClaimShield Nexus Frontend on http://localhost:5173 ..."
cd "$DIR/frontend"
exec npm run dev
