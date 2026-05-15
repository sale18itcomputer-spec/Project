# capture-url.ps1
# Runs cloudflared and captures the trycloudflare.com URL into .cloudflared-url

$ErrorActionPreference = 'Continue'

& cloudflared tunnel --url http://localhost:3000 2>&1 | ForEach-Object {
    Write-Host $_
    if ($_ -match 'https://[a-z0-9-]+\.trycloudflare\.com') {
        $matches[0] | Set-Content -Path "$PSScriptRoot\.cloudflared-url" -NoNewline
    }
}
