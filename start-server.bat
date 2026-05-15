@echo off
setlocal
cd /d "%~dp0"

echo Kisisel Gazetem server baslatiliyor...
echo Klasor: %cd%
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo HATA: Node.js bulunamadi. Once Node.js yuklenmeli.
  echo https://nodejs.org/
  pause
  exit /b 1
)

if not exist ".env" (
  echo UYARI: .env dosyasi bulunamadi.
  echo .env.example dosyasini .env olarak kopyalayip API keyleri ekleyebilirsin.
  echo.
)

echo Site adresi: http://localhost:3000
echo Kapatmak icin bu pencereyi kapat veya Ctrl+C yap.
echo.

for /f "tokens=5" %%a in ('netstat -ano ^| findstr /r /c:":3000 .*LISTENING"') do (
  echo Port 3000 zaten kullaniliyor. Server buyuk olasilikla zaten acik.
  echo Tarayicida ac: http://localhost:3000
  echo.
  echo Mevcut server'i kapatmak istersen Gorev Yoneticisi'nden node.exe surecini kapatabilir
  echo veya PowerShell'de su komutu kullanabilirsin: Stop-Process -Id %%a -Force
  echo.
  pause
  exit /b 0
)

node server.js

echo.
echo Server kapandi.
pause
