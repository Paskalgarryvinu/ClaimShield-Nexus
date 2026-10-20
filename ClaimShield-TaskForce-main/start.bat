@echo off
echo =======================================================
echo          CLAIMSHIELD NEXUS - SIU PLATFORM
echo =======================================================
echo 1. Seeding Synthetic Database...
python backend/run_seed.py
echo.
echo 2. Launching Backend and Frontend in separate windows...
start "ClaimShield Backend" cmd /c "run_backend.bat"
start "ClaimShield Frontend" cmd /c "run_frontend.bat"
echo.
echo ClaimShield Nexus is launching!
echo Backend:  http://localhost:8000/docs
echo Frontend: http://localhost:5173
echo =======================================================

