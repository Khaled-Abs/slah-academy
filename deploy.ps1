# deploy.ps1 — commit & push current changes, then Vercel auto-deploys.
param(
    [string]$Message = "",
    [switch]$Deploy = $false
)

if ($Message -eq "") {
    $Message = Read-Host "Commit message"
}

git add -A
git commit -m $Message
git push origin main

if ($Deploy) {
    vercel --prod
}