# Run this script once in your terminal to configure Firebase Storage
# Usage: .\setup-storage.ps1

$ErrorActionPreference = "Stop"
$projectId = "produzai-ab8ad"
$bucket = "produzai-ab8ad.firebasestorage.app"

Write-Host "=== Firebase Storage Setup ===" -ForegroundColor Cyan

# Step 1 — Login
Write-Host "`n[1/3] Logging in to Firebase..." -ForegroundColor Yellow
firebase login

# Step 2 — Deploy storage rules
Write-Host "`n[2/3] Deploying storage.rules..." -ForegroundColor Yellow
firebase deploy --only storage --project $projectId

# Step 3 — Set CORS (needs gcloud / gsutil)
Write-Host "`n[3/3] Configuring CORS..." -ForegroundColor Yellow
$gsutil = Get-Command gsutil -ErrorAction SilentlyContinue
$gcloud  = Get-Command gcloud  -ErrorAction SilentlyContinue

if ($gsutil) {
    gsutil cors set cors.json "gs://$bucket"
    Write-Host "CORS configured via gsutil." -ForegroundColor Green
} elseif ($gcloud) {
    gcloud storage buckets update "gs://$bucket" --cors-file=cors.json
    Write-Host "CORS configured via gcloud." -ForegroundColor Green
} else {
    Write-Host @"

CORS tool not found. Do ONE of these manually:

Option A — Install Google Cloud CLI (recommended):
  https://cloud.google.com/sdk/docs/install
  Then run: gsutil cors set cors.json gs://$bucket

Option B — Firebase Console (no install):
  1. Open https://console.firebase.google.com/project/$projectId/storage
  2. Click "Rules" tab → paste the contents of storage.rules → Publish
  (CORS still needs gsutil — console has no CORS UI)

"@ -ForegroundColor Red
}

Write-Host "`nDone! Restart your dev server and try uploading again." -ForegroundColor Green
