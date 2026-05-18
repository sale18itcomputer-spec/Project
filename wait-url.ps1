$urlFile = ".cloudflared-url"
for ($i = 0; $i -lt 40; $i++) {
    Start-Sleep 3
    if (Test-Path $urlFile) {
        $u = Get-Content $urlFile -Raw
        if ($u -match 'https://') {
            Write-Host "NEW URL: $u"
            break
        }
    }
    Write-Host "Waiting... attempt $i"
}
