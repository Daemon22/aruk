$ErrorActionPreference = 'Stop'

# Configure git to use Windows Credential Manager
git config --global credential.helper manager-core

# Check if the repo already exists on GitHub (unauthenticated check)
try {
    $response = curl -s -o /dev/null -w "%{http_code}" "https://api.github.com/repos/Daemon22/aruk" 2>&1
    Write-Host "Repo exists check (HTTP $response)"
} catch {
    Write-Host "Repo check failed: $_"
}
