# deploy_vercel.ps1
# Vercel Deployment Automation Script

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "   Vercel Deployment Automation Script    " -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

# 1. Check Vercel Availability
Write-Host "`n[Step 1] Checking Vercel CLI..." -ForegroundColor Yellow
if (Get-Command "vercel" -ErrorAction SilentlyContinue) {
    $version = vercel --version
    Write-Host "Vercel CLI is already installed: $version" -ForegroundColor Green
}
else {
    Write-Host "Vercel CLI not found. Installing via npm..." -ForegroundColor Yellow
    try {
        npm install -g vercel
        if ($LASTEXITCODE -eq 0) {
            Write-Host "Vercel CLI installed successfully." -ForegroundColor Green
        } else {
            throw "npm install failed."
        }
    }
    catch {
        Write-Error "Failed to install Vercel CLI. Please ensure npm is installed and you have internet access."
        exit 1
    }
}

# 2. Get App Folder Path
Write-Host "`n[Step 2] Select Application Directory" -ForegroundColor Yellow
$appPath = Read-Host "Enter the full path to your application folder"

# Validate Path
if (-not (Test-Path -Path $appPath)) {
    Write-Error "The path '$appPath' does not exist. Exiting."
    exit 1
}

# Navigate to directory
Push-Location $appPath
Write-Host "Changed directory to: $appPath" -ForegroundColor Gray

# 3. Vercel Login Check
Write-Host "`n[Step 3] Vercel Authentication" -ForegroundColor Yellow
Write-Host "Checking login status..."
# We use cmd /c to run vercel commands to ensure proper I/O handling in some PS environments
cmd /c "vercel whoami" 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "You are not logged in. Please log in now." -ForegroundColor Yellow
    cmd /c "vercel login"
} else {
    Write-Host "Already logged in." -ForegroundColor Green
}

# 4. Link Project
Write-Host "`n[Step 4] Linking Project" -ForegroundColor Yellow
Write-Host "Running 'vercel link'. Please answer the prompts to link your project." -ForegroundColor Gray
cmd /c "vercel link"

# 5. Environment Variable Configuration
Write-Host "`n[Step 5] Environment Variables" -ForegroundColor Yellow
$configEnv = Read-Host "Do you need to configure environment variables? (y/n)"

if ($configEnv -eq 'y') {
    do {
        $key = Read-Host "Enter Variable Name (KEY)"
        $value = Read-Host "Enter Variable Value (VALUE)"
        
        Write-Host "Adding '$key' to Production, Preview, and Development environments..."
        
        # vercel env add <name> [environment] < <value>
        # PowerShell piping to stdin
        $value | cmd /c "vercel env add $key production"
        $value | cmd /c "vercel env add $key preview"
        $value | cmd /c "vercel env add $key development"
        
        $continue = Read-Host "Add another variable? (y/n)"
    } while ($continue -eq 'y')
}

# 6. Deploy
Write-Host "`n[Step 6] Deploying to Production" -ForegroundColor Yellow
Write-Host "Running 'vercel deploy --prod'..." -ForegroundColor Gray

# We capture the output to find the URL, but also stream it to host so user sees progress.
# Since 'vercel deploy' updates the line in place (spinners), capturing it might be messy.
# We will run it and ask user to confirm or try to grab the last line.
# A robust way is to run it and capture the result which is the URL.
$deploymentUrl = cmd /c "vercel deploy --prod"

Write-Host "`nDeployment Output:" -ForegroundColor Gray
$deploymentUrl | ForEach-Object { Write-Host $_ }

# Attempt to extract URL (It looks like https://project-name-....vercel.app)
$validUrl = $null
foreach ($line in $deploymentUrl) {
    if ($line -match "https://.*\.vercel\.app") {
        $validUrl = $line.Trim()
        # Vercel sometimes outputs other text, we want the one that looks like a main url or the specific deployment url
        # usually the last one is the production url
    }
}

if ([string]::IsNullOrWhiteSpace($validUrl)) {
    Write-Warning "Could not automatically detect the deployment URL from the output."
    $validUrl = Read-Host "Please copy and paste the Deployment URL here for validation"
} else {
    Write-Host "`nDetected Deployment URL: $validUrl" -ForegroundColor Cyan
}

# 7. Validate Site
Write-Host "`n[Step 7] Validating Deployment" -ForegroundColor Yellow
if (-not [string]::IsNullOrWhiteSpace($validUrl)) {
    Write-Host "Checking availability of $validUrl ..."
    try {
        # Wait a few seconds for propagation if needed
        Start-Sleep -Seconds 5
        $response = Invoke-WebRequest -Uri $validUrl -UseBasicParsing -Method Head
        
        if ($response.StatusCode -eq 200) {
            Write-Host "SUCCESS: The site is live and reachable (HTTP 200)." -ForegroundColor Green
        } else {
            Write-Host "WARNING: The site returned HTTP $($response.StatusCode)." -ForegroundColor Yellow
        }
    }
    catch {
        Write-Error "Validation failed. The site might not be ready yet or the URL is incorrect."
        Write-Error $_.Exception.Message
    }
}

Pop-Location
Write-Host "`n==========================================" -ForegroundColor Cyan
Write-Host "       Automation Script Completed        " -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
