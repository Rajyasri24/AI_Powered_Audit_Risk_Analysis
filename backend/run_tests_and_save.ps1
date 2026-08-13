$ErrorActionPreference = "Continue"

Write-Host "Running AuditRisk AI automated tests..."

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$resultsDir = "test-results"

if (!(Test-Path $resultsDir)) {
    New-Item -ItemType Directory -Path $resultsDir | Out-Null
}

$txtFile = Join-Path $resultsDir "pytest_$timestamp.txt"
$xmlFile = Join-Path $resultsDir "pytest_$timestamp.xml"
$summaryFile = Join-Path $resultsDir "summary_$timestamp.txt"

pytest -v --junitxml=$xmlFile 2>&1 | Tee-Object -FilePath $txtFile

$exitCode = $LASTEXITCODE

$xml = [xml](Get-Content $xmlFile)

$suites = $xml.testsuites
if ($null -ne $suites.testsuite) {
    $suite = $suites.testsuite
} else {
    $suite = $xml.testsuite
}

$total = [int]$suite.tests
$failures = [int]$suite.failures
$errors = [int]$suite.errors
$skipped = [int]$suite.skipped
$passed = $total - $failures - $errors - $skipped

$summary = @"
AuditRisk AI Automated Test Summary
===================================
Timestamp : $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
Total     : $total
Passed    : $passed
Failed    : $failures
Errors    : $errors
Skipped   : $skipped
Exit Code : $exitCode

Detailed TXT : $txtFile
JUnit XML    : $xmlFile
"@

$summary | Tee-Object -FilePath $summaryFile

Write-Host ""
Write-Host "Saved documentation results in: $resultsDir"
Write-Host "Summary: $summaryFile"

exit $exitCode
