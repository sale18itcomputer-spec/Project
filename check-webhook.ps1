$lines = Get-Content ".env.local"
$tokenLine = $lines | Where-Object { $_ -match "^TELEGRAM_BOT_TOKEN=" }
$token = $tokenLine.Split("=", 2)[1].Trim()
$r = Invoke-RestMethod "https://api.telegram.org/bot${token}/getWebhookInfo"
Write-Host "Webhook URL: $($r.result.url)"
Write-Host "Pending updates: $($r.result.pending_update_count)"
