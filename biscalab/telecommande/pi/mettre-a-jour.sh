#!/usr/bin/env bash
# Met à jour la télécommande depuis GitHub, puis relance l'installation (réglages gardés).
# Le Pi doit avoir internet, donc être sur le Wi-Fi maison. À lancer sans sudo :
#
#   bash ~/Open_Duck_Mini_Fablab/biscalab/telecommande/pi/mettre-a-jour.sh
{
    set -euo pipefail
    ICI=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
    git -C "$ICI" pull --ff-only
    sudo bash "$ICI/installer.sh"
    exit
}
