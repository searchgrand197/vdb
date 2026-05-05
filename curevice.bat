@echo off
setlocal
cd /d "%~dp0"

if /i "%~1"=="__backend" goto backend_worker
if /i "%~1"=="__frontend" goto frontend_worker

if exist ".venv\Scripts\activate.bat" (
  call ".venv\Scripts\activate.bat"
) else if exist "venv\Scripts\activate.bat" (
  call "venv\Scripts\activate.bat"
)

where python >nul 2>&1
if errorlevel 1 (
  echo Python was not found in PATH. Install Python 3 and try again.
  pause
  exit /b 1
)

:menu
echo.
echo ========================================
echo   Curevice (Django)
echo ========================================
echo   1  Run backend + frontend
echo   2  Install dependencies ^(pip install -r requirements.txt^)
echo   3  Apply database migrations
echo   4  Django shell
echo   5  Create superuser ^(interactive^)
echo   6  Seed hospital floors / rooms / beds
echo   0  Exit
echo ========================================
set /p choice=Choose [0-6]: 

if "%choice%"=="1" goto runserver
if "%choice%"=="2" goto install
if "%choice%"=="3" goto migrate
if "%choice%"=="4" goto shell
if "%choice%"=="5" goto superuser
if "%choice%"=="6" goto seed_beds
if "%choice%"=="0" goto end

echo Invalid choice.
goto menu

:runserver
echo.
start "Curevice Backend" cmd /k ""%~f0" __backend"
start "Curevice Frontend" cmd /k ""%~f0" __frontend"
echo Backend and frontend are starting in separate windows...
goto menu

:install
echo.
python -m pip install -r requirements.txt
if errorlevel 1 pause
goto menu

:migrate
echo.
python manage.py migrate
if errorlevel 1 pause
goto menu

:shell
echo.
python manage.py shell
goto menu

:superuser
echo.
python manage.py createsuperuser
if errorlevel 1 pause
goto menu

:seed_beds
echo.
python manage.py seed_beds
if errorlevel 1 pause
goto menu

:backend_worker
cd /d "%~dp0"
if exist ".venv\Scripts\activate.bat" (
  call ".venv\Scripts\activate.bat"
) else if exist "venv\Scripts\activate.bat" (
  call "venv\Scripts\activate.bat"
)
python manage.py runserver
echo.
echo Backend stopped. Press any key to close...
pause >nul
exit /b 0

:frontend_worker
cd /d "%~dp0frontend"
npm run dev
echo.
echo Frontend stopped. Press any key to close...
pause >nul
exit /b 0

:end
endlocal
exit /b 0
