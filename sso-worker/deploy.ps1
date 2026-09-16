# ============================================================
# HubQuiz SSO Worker - Deploy Script
# Run this on the JP Nagar system in a PowerShell terminal
# ============================================================

Write-Host "Pulling latest code from GitHub..." -ForegroundColor Cyan
cd D:\HubQuiz
git pull

Write-Host "Moving into the SSO Worker directory..." -ForegroundColor Cyan
cd D:\HubQuiz\sso-worker

Write-Host "Setting SUPABASE_ANON_KEY secret in Cloudflare..." -ForegroundColor Yellow
Write-Host "When prompted, paste this value and press Enter:"
Write-Host "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0" -ForegroundColor Green
$env:NODE_OPTIONS="--no-deprecation"
npx wrangler secret put SUPABASE_ANON_KEY

Write-Host "Deploying Worker to Cloudflare..." -ForegroundColor Cyan
npx wrangler deploy

Write-Host ""
Write-Host "Done! Copy the worker URL printed above (e.g. https://hubquiz-sso.YOUR-ACCOUNT.workers.dev)" -ForegroundColor Green
Write-Host "Test it by opening: https://hubquiz-sso.YOUR-ACCOUNT.workers.dev/?hub=belagavi" -ForegroundColor Green
