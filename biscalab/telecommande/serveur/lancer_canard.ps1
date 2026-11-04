# Lance le serveur du canard avec le canard virtuel MuJoCo, indépendamment de tout terminal.
# Utilisé par la tâche planifiée Windows « Canard - serveur de télécommande ».
# Journal : serveur\journal\canard.log (réécrit à chaque lancement).
param(
    [string]$CodeAdmin = $env:CANARD_CODE_ADMIN,
    [string]$Python = "$env:USERPROFILE\.venvs\canard-telecommande\Scripts\python.exe"
)

$ici = Split-Path -Parent $MyInvocation.MyCommand.Path
$journal = Join-Path $ici 'journal'
New-Item -ItemType Directory -Force $journal | Out-Null

# Un seul serveur à la fois : on arrête l'ancien s'il tourne encore (sinon le port 8080 est pris).
Get-CimInstance Win32_Process -Filter "name like 'python%'" |
    Where-Object { $_.CommandLine -match 'canard_serveur\.py' -and $_.CommandLine -notmatch '--port' } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
Start-Sleep -Seconds 1

$arguments = @('-X', 'utf8', '-u', 'canard_serveur.py', '--mujoco')
if ($CodeAdmin) { $arguments += @('--code-admin', $CodeAdmin) }

$p = Start-Process -FilePath $Python -ArgumentList $arguments -WorkingDirectory $ici -NoNewWindow -PassThru -Wait `
    -RedirectStandardError (Join-Path $journal 'canard.log') `
    -RedirectStandardOutput (Join-Path $journal 'canard-sortie.log')
exit $p.ExitCode
