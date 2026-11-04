#!/usr/bin/env bash
# Installe ou met à jour la télécommande du canard sur le Pi (Raspberry Pi OS Bookworm).
# À lancer depuis le clone du dépôt, avec sudo :
#
#   sudo bash biscalab/telecommande/pi/installer.sh
#
# Ce que ça fait (on peut le relancer sans risque, les réglages déjà faits sont gardés) :
#   - environnement Python ~/.venvs/telecommande avec aiohttp ;
#   - service canard-telecommande : serveur + appli sur le port 80, lancé au démarrage ;
#   - profil NetworkManager « canard-wifi » : point d'accès 2,4 GHz, adresse 10.42.0.1 ;
#   - service canard-reseau : au démarrage, Wi-Fi maison s'il est là, sinon réseau du canard.
#
# Réglages facultatifs, en variables d'environnement (sudo VAR=valeur bash installer.sh) :
#   CANARD_WIFI_MDP    mot de passe du réseau du canard (8 caractères ou plus). Sans lui :
#                      celui déjà réglé, ou à la première installation un mot de passe tiré au hasard.
#   CANARD_WIFI_NOM    nom du réseau (Canard-BiscaLab par défaut)
#   CANARD_CODE_ADMIN  code administrateur de l'appli (4 à 8 chiffres). Sans lui : celui déjà réglé,
#                      sinon tiré au hasard.
#   CANARD_MAISON      profils Wi-Fi « maison », séparés par des virgules. Sans lui : la liste déjà
#                      réglée, sinon le Wi-Fi utilisé pendant l'installation.
# Aucun mot de passe n'est écrit dans le dépôt : ils restent dans /etc/canard et NetworkManager.

set -euo pipefail

[[ $EUID -eq 0 ]] || { echo "À lancer avec sudo : sudo bash $0" >&2; exit 1; }

ICI=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
TELECOMMANDE=$(dirname "$ICI")
SERVEUR=$TELECOMMANDE/serveur
UTILISATEUR=${SUDO_USER:-$(stat -c %U "$TELECOMMANDE")}
[[ $UTILISATEUR != root ]] || { echo "Lancer avec sudo depuis le compte du canard, pas en root." >&2; exit 1; }
DOMICILE=$(getent passwd "$UTILISATEUR" | cut -d: -f6)
VENV=$DOMICILE/.venvs/telecommande
CONF=/etc/canard
ENV_FICHIER=$CONF/telecommande.env
MAISON_FICHIER=$CONF/wifi-maison
PROFIL=canard-wifi
NOM_WIFI=${CANARD_WIFI_NOM:-Canard-BiscaLab}
ADRESSE=10.42.0.1
PORT=80

etape() { printf '\n== %s\n' "$*"; }

[[ -f $SERVEUR/canard_serveur.py ]] || { echo "Pas de serveur dans $SERVEUR" >&2; exit 1; }
[[ -f $TELECOMMANDE/appli-react/dist/index.html ]] || echo "Attention : appli React absente, l'ancienne appli sera servie."

etape "Paquets du système"
manque=()
for paquet in python3-venv dnsmasq-base iw; do
    dpkg -s "$paquet" >/dev/null 2>&1 || manque+=("$paquet")
done
if ((${#manque[@]})); then
    apt-get update -qq
    DEBIAN_FRONTEND=noninteractive apt-get install -y -qq "${manque[@]}"
fi
echo "ok"

etape "Python (${VENV/#$DOMICILE/\~})"
[[ -x $VENV/bin/python ]] || sudo -H -u "$UTILISATEUR" python3 -m venv "$VENV"
if ! sudo -H -u "$UTILISATEUR" "$VENV/bin/pip" install -q --disable-pip-version-check -r "$SERVEUR/requirements.txt"; then
    "$VENV/bin/python" -c 'import aiohttp' 2>/dev/null || { echo "aiohttp manque et pip a échoué (internet ?)" >&2; exit 1; }
    echo "pip a échoué (pas d'internet ?) : on garde les paquets déjà installés"
fi
"$VENV/bin/python" -c 'import aiohttp; print("aiohttp", aiohttp.__version__)'

etape "Code administrateur"
install -d -m 755 "$CONF"
code=${CANARD_CODE_ADMIN:-}
if [[ -z $code && -f $ENV_FICHIER ]]; then
    code=$(sed -n 's/^CANARD_CODE_ADMIN=//p' "$ENV_FICHIER")
fi
if [[ -z $code ]]; then
    code=$(shuf -i 0-9999 -n 1 --random-source=/dev/urandom)
    code=$(printf '%04d' "$code")
fi
[[ $code =~ ^[0-9]{4,8}$ ]] || { echo "Le code administrateur doit faire 4 à 8 chiffres." >&2; exit 1; }
(umask 077 && printf 'CANARD_CODE_ADMIN=%s\n' "$code" >"$ENV_FICHIER")
echo "réglé (dans $ENV_FICHIER)"

etape "Service canard-telecommande (port $PORT)"
if ss -Hltn "sport = :$PORT" 2>/dev/null | grep -q . && ! systemctl is-active --quiet canard-telecommande; then
    echo "Attention : le port $PORT est déjà pris par un autre programme."
fi
cat >/etc/systemd/system/canard-telecommande.service <<EOF
[Unit]
Description=Telecommande du canard (serveur de commande et appli)
After=network.target

[Service]
User=$UTILISATEUR
WorkingDirectory=$SERVEUR
EnvironmentFile=$ENV_FICHIER
Environment=PYTHONUNBUFFERED=1
ExecStart=$VENV/bin/python canard_serveur.py --port $PORT
AmbientCapabilities=CAP_NET_BIND_SERVICE
Restart=always
RestartSec=2

[Install]
WantedBy=multi-user.target
EOF
echo "ok"

etape "Réseau du canard « $NOM_WIFI » (profil $PROFIL)"
mdp=${CANARD_WIFI_MDP:-}
if [[ -n $mdp ]] && ((${#mdp} < 8 || ${#mdp} > 63)); then
    echo "Le mot de passe Wi-Fi doit faire de 8 à 63 caractères." >&2
    exit 1
fi
reglages=(
    connection.autoconnect no
    802-11-wireless.ssid "$NOM_WIFI"
    802-11-wireless.mode ap
    802-11-wireless.band bg
    802-11-wireless.channel 6
    802-11-wireless.powersave 2
    ipv4.method shared
    ipv4.addresses "$ADRESSE/24"
    ipv6.method disabled
    wifi-sec.key-mgmt wpa-psk
    wifi-sec.proto rsn
    wifi-sec.pairwise ccmp
    wifi-sec.group ccmp
    wifi-sec.pmf disable
)
if nmcli -g NAME connection show | grep -qxF "$PROFIL"; then
    nmcli connection modify "$PROFIL" "${reglages[@]}"
    if [[ -n $mdp ]]; then
        nmcli connection modify "$PROFIL" wifi-sec.psk "$mdp"
    fi
else
    if [[ -z $mdp ]]; then
        mots=(plume mare bec aile patte roseau etang galet saule radeau vague mousse plongeon canot duvet ponton)
        mdp=$(shuf -n 3 -e "${mots[@]}" --random-source=/dev/urandom | paste -sd-)-$(shuf -i 10-99 -n 1 --random-source=/dev/urandom)
        nouveau_mdp=1
    fi
    nmcli connection add type wifi ifname wlan0 con-name "$PROFIL" "${reglages[@]}" wifi-sec.psk "$mdp" >/dev/null
fi
echo "ok"

etape "Wi-Fi maison"
if [[ -n ${CANARD_MAISON:-} ]]; then
    tr ',' '\n' <<<"$CANARD_MAISON" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//;/^$/d' >"$MAISON_FICHIER"
elif [[ ! -s $MAISON_FICHIER ]]; then
    actif=$(nmcli -g GENERAL.CONNECTION device show wlan0 2>/dev/null | head -n1 || true)
    if [[ -n $actif && $actif != "$PROFIL" ]]; then
        printf '%s\n' "$actif" >"$MAISON_FICHIER"
    else
        : >"$MAISON_FICHIER"
    fi
fi
chmod 644 "$MAISON_FICHIER"
if [[ -s $MAISON_FICHIER ]]; then
    sed 's/^/  - /' "$MAISON_FICHIER"
else
    echo "  aucun : le canard créera toujours son réseau au démarrage"
fi

etape "Bascule automatique (service canard-reseau)"
install -m 755 "$ICI/canard-reseau.sh" /usr/local/sbin/canard-reseau
install -d -m 755 /var/lib/canard
cat >/etc/systemd/system/canard-reseau.service <<'EOF'
[Unit]
Description=Choix du reseau du canard (Wi-Fi maison ou point d'acces)
Wants=NetworkManager.service
After=NetworkManager.service

[Service]
Type=simple
ExecStart=/usr/local/sbin/canard-reseau auto

[Install]
WantedBy=multi-user.target
EOF
echo "ok"

etape "Démarrage"
systemctl daemon-reload
systemctl enable canard-reseau.service >/dev/null 2>&1
systemctl enable canard-telecommande.service >/dev/null 2>&1
systemctl restart canard-telecommande.service
sleep 3
if systemctl is-active --quiet canard-telecommande.service; then
    echo "serveur actif"
else
    echo "Le serveur ne démarre pas :" >&2
    journalctl -u canard-telecommande -n 20 --no-pager >&2
    exit 1
fi

etape "Résumé"
echo "Réseau du canard : $NOM_WIFI"
if [[ -n ${nouveau_mdp:-} ]]; then
    echo "Mot de passe tiré au hasard : $mdp   (à noter dans le coffre du club)"
elif [[ -n ${CANARD_WIFI_MDP:-} ]]; then
    echo "Mot de passe : celui donné à l'installation"
else
    echo "Mot de passe : inchangé"
fi
echo "Appli sur le réseau du canard : http://$ADRESSE"
echo "Appli en ce moment : $(/usr/local/sbin/canard-reseau etat)"
echo "Au prochain démarrage hors de la maison, le canard crée son réseau en une minute environ."
