param(
  [string]$BaseUrl = "http://localhost:3000",
  [string]$Phone = "09123456789",
  [string]$Password = "123456"
)

$loginBody = @{
  phone = $Phone
  password = $Password
} | ConvertTo-Json

Write-Host "== Logging in test user =="
$login = Invoke-RestMethod -Method Post -Uri "$BaseUrl/auth/login" -Body $loginBody -ContentType "application/json"
$token = $login.token

if (-not $token) {
  throw "Login succeeded but no token was returned."
}

$headers = @{
  Authorization = "Bearer $token"
  "Content-Type" = "application/json"
}

Write-Host "`n== /report =="
Invoke-RestMethod -Method Get -Uri "$BaseUrl/report" -Headers $headers | ConvertTo-Json -Depth 12

Write-Host "`n== /recommendations/compare =="
Invoke-RestMethod -Method Get -Uri "$BaseUrl/recommendations/compare" -Headers $headers | ConvertTo-Json -Depth 12

Write-Host "`n== /recommendations?limit=10 =="
Invoke-RestMethod -Method Get -Uri "$BaseUrl/recommendations?limit=10" -Headers $headers | ConvertTo-Json -Depth 12
