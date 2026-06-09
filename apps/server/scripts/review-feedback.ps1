param(
  [Parameter(Mandatory = $true)]
  [string]$Token,
  [Parameter(Mandatory = $true)]
  [string[]]$RecipeIds,
  [string]$BaseUrl = "http://localhost:3000"
)

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

$normalizedRecipeIds = $RecipeIds |
  ForEach-Object { $_ -split "," } |
  ForEach-Object { $_.Trim().Trim('"').Trim("'") } |
  Where-Object { $_ }

$invalidRecipeIds = $normalizedRecipeIds | Where-Object {
  $_ -match "^RECIPE_ID_" -or $_ -notmatch "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$"
}

if ($invalidRecipeIds.Count -gt 0) {
  throw "Invalid RecipeIds: $($invalidRecipeIds -join ', '). Use real UUID recipeIds from /recommendations output."
}

$headers = @{
  Authorization = "Bearer $Token"
  "Content-Type" = "application/json"
}

$eventTypes = @(
  "recommendation_impression",
  "recommendation_click",
  "recommendation_save",
  "recommendation_cook"
)

$rank = 1

foreach ($recipeId in $normalizedRecipeIds) {
  foreach ($eventType in $eventTypes) {
    $eventId = [guid]::NewGuid().ToString()
    $body = @{
      type = $eventType
      page = "review"
      payload = @{
        eventId = $eventId
        recipeId = $recipeId
        source = "review_feedback_script"
        rank = $rank
        surface = "recommendation_review"
        occurredAt = (Get-Date).ToUniversalTime().ToString("o")
      }
    } | ConvertTo-Json -Depth 8

    Invoke-RestMethod -Method Post -Uri "$BaseUrl/analytics/event" -Headers $headers -Body $body | Out-Null
    Start-Sleep -Milliseconds 1200
  }
  $rank += 1
}

Write-Host "Submitted review feedback for $($normalizedRecipeIds.Count) recipe(s)."
