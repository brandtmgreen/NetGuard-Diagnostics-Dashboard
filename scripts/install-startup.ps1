#Requires -RunAsAdministrator
param(
  [string]$ExePath = "$env:LOCALAPPDATA\Programs\NetGuard\NetGuard.exe"
)

$ErrorActionPreference = "Stop"
if (-not (Test-Path $ExePath)) {
  throw "NetGuard executable not found: $ExePath"
}

$action = New-ScheduledTaskAction -Execute $ExePath -Argument "--background --netguard-elevated"
$trigger = New-ScheduledTaskTrigger -AtLogOn
$principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit ([TimeSpan]::Zero)

Register-ScheduledTask -TaskName "NetGuard Security Desk" -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Force | Out-Null
Write-Output "Installed logon task 'NetGuard Security Desk' -> $ExePath"
