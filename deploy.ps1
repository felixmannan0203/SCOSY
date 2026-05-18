# SCOSY Deploy Script
# Run this from the project folder to push changes to GitHub
# Vercel will automatically redeploy within ~30 seconds

param(
    [string]$Message = "Update SCOSY app"
)

Write-Host "Deploying SCOSY..." -ForegroundColor Cyan

git add .
git commit -m $Message
git push origin main

Write-Host "Done! Vercel is redeploying. Check https://vercel.com/dashboard" -ForegroundColor Green
