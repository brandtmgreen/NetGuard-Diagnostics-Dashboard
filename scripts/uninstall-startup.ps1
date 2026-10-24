#Requires -RunAsAdministrator
$ErrorActionPreference = "Stop"
$task = Get-ScheduledTask -TaskName "NetGuard Security Desk" -ErrorAction SilentlyContinue
if ($task) {
  Unregister-ScheduledTask -TaskName "NetGuard Security Desk" -Confirm:$false
  Write-Output "Removed logon task 'NetGuard Security Desk'."
} else {
  Write-Output "No NetGuard logon task is installed."
}
