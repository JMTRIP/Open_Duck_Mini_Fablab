@echo off
rem ============================================================================
rem  Ouvrir-le-dossier-Canard.cmd  --  BiscaLab, Dossier Canard (v1.2)
rem
rem  A QUOI CA SERT
rem    Ouvre la page index.html (le Dossier Canard) dans un navigateur web.
rem    Sur beaucoup de PC, un double-clic sur un fichier .html l'ouvre dans un
rem    editeur de code (VS Code...) et on voit du code au lieu de la page.
rem    Ce lanceur evite le probleme : double-cliquer dessus, c'est tout.
rem
rem  CE QU'IL FAIT
rem    1. Il repere le dossier ou il se trouve, et en deduit le chemin de index.html.
rem    2. Il cherche un navigateur installe, dans cet ordre : Chrome, Edge, Firefox.
rem    3. Il ouvre la page avec le premier trouve, puis se ferme.
rem    Il ne modifie rien sur l'ordinateur et ne touche pas aux reglages Windows.
rem
rem  REMARQUE
rem    Pas d'accents dans ce fichier : l'invite de commandes Windows les affiche mal.
rem ============================================================================

rem --- 1. Chemin de la page a ouvrir ------------------------------------------
rem %~dp0 = dossier ou se trouve ce fichier .cmd (avec la barre oblique finale).
set "PAGE=%~dp0index.html"

rem --- 2. Chrome --------------------------------------------------------------
rem Installation classique (pour tous les utilisateurs du PC).
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" (
  start "" "%ProgramFiles%\Google\Chrome\Application\chrome.exe" "%PAGE%"
  exit /b
)
rem Installation "pour moi seulement" (dans le dossier de l'utilisateur).
if exist "%LocalAppData%\Google\Chrome\Application\chrome.exe" (
  start "" "%LocalAppData%\Google\Chrome\Application\chrome.exe" "%PAGE%"
  exit /b
)
rem Ancienne installation 32 bits. La variable "ProgramFiles(x86)" contient des
rem parentheses qui genent cmd : on la recopie d'abord dans PF86.
set "PF86=%ProgramFiles(x86)%"
if exist "%PF86%\Google\Chrome\Application\chrome.exe" (
  start "" "%PF86%\Google\Chrome\Application\chrome.exe" "%PAGE%"
  exit /b
)

rem --- 3. Edge (livre avec Windows 10 et 11) ----------------------------------
if exist "%PF86%\Microsoft\Edge\Application\msedge.exe" (
  start "" "%PF86%\Microsoft\Edge\Application\msedge.exe" "%PAGE%"
  exit /b
)
if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" (
  start "" "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" "%PAGE%"
  exit /b
)

rem --- 4. Firefox -------------------------------------------------------------
if exist "%ProgramFiles%\Mozilla Firefox\firefox.exe" (
  start "" "%ProgramFiles%\Mozilla Firefox\firefox.exe" "%PAGE%"
  exit /b
)

rem --- 5. Dernier recours -----------------------------------------------------
rem Aucun navigateur trouve aux endroits habituels : on demande a Windows
rem d'ouvrir la page avec Edge, par son adresse speciale "microsoft-edge:".
start "" "microsoft-edge:%PAGE%"
