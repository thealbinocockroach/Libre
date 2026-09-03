$ErrorActionPreference = "Stop"
Set-Location "C:\Users\Roby\Documents\Default Project\libre-apk-build"
Write-Host "=== Building LibreAudio APK ===" -ForegroundColor Cyan

# Step 1: Vite build
Write-Host "`n[1/4] Vite build..." -ForegroundColor Yellow
cmd /c "npx vite build 2>&1"
if ($LASTEXITCODE -ne 0) { Write-Host "FAIL: vite build" -ForegroundColor Red; exit 1 }

# Step 2: Capacitor sync
Write-Host "`n[2/4] Capacitor sync..." -ForegroundColor Yellow
cmd /c "npx cap sync android 2>&1"
if ($LASTEXITCODE -ne 0) { Write-Host "FAIL: cap sync" -ForegroundColor Red; exit 1 }

# Step 3: Gradle build
Write-Host "`n[3/4] Gradle assembleDebug..." -ForegroundColor Yellow
Set-Location "C:\Users\Roby\Documents\Default Project\libre-apk-build\android"
cmd /c "gradlew.bat assembleDebug --no-daemon 2>&1"
if ($LASTEXITCODE -ne 0) { Write-Host "FAIL: gradle" -ForegroundColor Red; exit 1 }

# Step 4: Copy APK
Write-Host "`n[4/4] Copy APK..." -ForegroundColor Yellow
$src = "C:\Users\Roby\Documents\Default Project\libre-apk-build\android\app\build\outputs\apk\debug\LibreAudio-debug.apk"
$dst = "C:\Users\Roby\Desktop\LibreAudio.apk"
Copy-Item -LiteralPath $src -Destination $dst -Force
Write-Host "APK copied to: $dst" -ForegroundColor Green

# Step 5: Install
Write-Host "`nInstalling..." -ForegroundColor Yellow
adb install -r $dst
if ($LASTEXITCODE -eq 0) {
    Write-Host "`nDONE - Installed successfully!" -ForegroundColor Green
} else {
    Write-Host "Install failed" -ForegroundColor Red
}
