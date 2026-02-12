# Test n8n feedback webhook (no auth). Run: .\scripts\test-n8n-webhook.ps1
$body = @{
  message    = "Test feedback from PowerShell"
  firstName  = "Test"
  lastName   = "User"
  email      = "test@example.com"
  timestamp  = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
} | ConvertTo-Json

$uri = "https://loganstools.app.n8n.cloud/webhook-test/feedback"
try {
  $response = Invoke-RestMethod -Uri $uri -Method POST -ContentType "application/json" -Body $body
  Write-Host "Success:" $response
} catch {
  $statusCode = $_.Exception.Response.StatusCode.value__
  Write-Host "HTTP $statusCode - $($_.Exception.Message)"
  if ($statusCode -eq 404) {
    Write-Host "Tip: Check the webhook URL in n8n (Webhook node). Ensure workflow is active and path is correct."
  }
}
