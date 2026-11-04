#!/usr/bin/env bash
# Choix du réseau Wi-Fi du canard. Installé par installer.sh en /usr/local/sbin/canard-reseau.
#
#   canard-reseau auto        au démarrage : reste sur un Wi-Fi « maison » s'il est à portée,
#                             sinon crée le réseau du canard (point d'accès)
#   canard-reseau canard      passe tout de suite sur le réseau du canard
#   canard-reseau wifi        quitte le réseau du canard et revient sur un Wi-Fi connu
#   canard-reseau essai [s]   réseau du canard pendant s secondes (120 par défaut), puis retour
#                             au Wi-Fi d'avant ; compte-rendu dans /var/lib/canard/essai-reseau.txt
#   canard-reseau etat        réseau en cours et adresse de l'appli
#
# Le Zero 2 W n'a qu'une puce Wi-Fi : il est soit sur un Wi-Fi existant, soit point d'accès.
# Les Wi-Fi « maison » sont les profils NetworkManager listés dans /etc/canard/wifi-maison
# (un par ligne). À la maison le canard reste joignable pour les mises à jour ; partout
# ailleurs (FabLab compris) il crée son propre réseau.

set -uo pipefail

PROFIL=${CANARD_PROFIL:-canard-wifi}
MAISON=${CANARD_FICHIER_MAISON:-/etc/canard/wifi-maison}
ETAT=${CANARD_FICHIER_ETAT:-/run/canard-reseau}
ESSAI=${CANARD_FICHIER_ESSAI:-/var/lib/canard/essai-reseau.txt}
IF=${CANARD_INTERFACE:-wlan0}
ATTENTE=${CANARD_ATTENTE:-60}  # au démarrage : temps laissé au Wi-Fi maison pour se connecter (s)
REGARD=${CANARD_REGARD:-15}    # après ce délai, on regarde si un Wi-Fi maison est à portée (s)
PAS=${CANARD_PAS:-3}

log() {
    echo "canard-reseau : $*"
    logger -t canard-reseau -- "$*" 2>/dev/null || true
}

noter_etat() { echo "$1" >"$ETAT" 2>/dev/null || true; }

connexion_active() { nmcli -g GENERAL.CONNECTION device show "$IF" 2>/dev/null | head -n1; }

# Profil du Wi-Fi seulement une fois la connexion établie (vide pendant la négociation).
connecte_a() {
    [[ $(nmcli -g GENERAL.STATE device show "$IF" 2>/dev/null | head -n1) == 100* ]] && connexion_active
}

maisons() {
    [[ -f $MAISON ]] || return 0
    sed -e 's/[[:space:]]*#.*$//' -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//' -e '/^$/d' "$MAISON"
}

est_maison() { [[ -n $1 ]] && maisons | grep -qxF -- "$1"; }

ssid_de() { nmcli -g 802-11-wireless.ssid connection show "$1" 2>/dev/null | head -n1; }

adresse_wifi() { nmcli -g IP4.ADDRESS device show "$IF" 2>/dev/null | head -n1 | cut -d/ -f1; }

# Premier profil maison dont le réseau est à portée (vide si aucun).
maison_a_portee() {
    local liste profil ssid
    liste=$(nmcli -g SSID device wifi list ifname "$IF" --rescan yes 2>/dev/null)
    while IFS= read -r profil; do
        [[ -n $profil ]] || continue
        ssid=$(ssid_de "$profil")
        if [[ -n $ssid ]] && grep -qxF -- "$ssid" <<<"$liste"; then
            echo "$profil"
            return 0
        fi
    done < <(maisons)
    return 0
}

nm_pret() {
    local i
    for ((i = 0; i < 30; i++)); do
        nmcli -t -f RUNNING general status 2>/dev/null | grep -q running && return 0
        sleep 1
    done
    return 1
}

passer_canard() {
    log "passage sur le réseau du canard « $(ssid_de "$PROFIL") »"
    if nmcli --wait 45 connection up "$PROFIL" >/dev/null 2>&1; then
        noter_etat canard
        log "réseau du canard actif, appli sur http://$(adresse_wifi)"
        return 0
    fi
    log "échec du point d'accès : retour sur un Wi-Fi connu"
    noter_etat erreur
    revenir_wifi
    return 1
}

revenir_wifi() {
    local profil
    if [[ $(connexion_active) == "$PROFIL" ]]; then
        nmcli --wait 15 connection down "$PROFIL" >/dev/null 2>&1 || true
    fi
    profil=$(maison_a_portee)
    if [[ -n $profil ]] && nmcli --wait 40 connection up "$profil" >/dev/null 2>&1; then
        noter_etat maison
        log "Wi-Fi « $profil », appli sur http://$(adresse_wifi)"
        return 0
    fi
    # Sinon NetworkManager se reconnecte seul au meilleur Wi-Fi connu (FabLab…).
    noter_etat wifi
    log "retour au Wi-Fi laissé à NetworkManager"
    return 0
}

auto() {
    local debut actif profil vu="" relance=0
    nm_pret || log "NetworkManager ne répond pas"
    if [[ -z $(maisons) ]]; then
        log "aucun Wi-Fi maison déclaré"
        passer_canard
        return
    fi
    debut=$SECONDS
    while ((SECONDS - debut < ATTENTE)); do
        actif=$(connecte_a)
        if est_maison "$actif"; then
            noter_etat maison
            log "Wi-Fi maison « $actif », on y reste : appli sur http://$(adresse_wifi)"
            return 0
        fi
        if ((SECONDS - debut >= REGARD)) && [[ -z $vu ]]; then
            profil=$(maison_a_portee)
            if [[ -z $profil ]]; then
                log "aucun Wi-Fi maison à portée"
                passer_canard
                return
            fi
            vu=$profil
            log "Wi-Fi maison « $vu » à portée, on attend la connexion"
        fi
        if [[ -n $vu ]] && ((relance == 0)) && ((SECONDS - debut >= 2 * REGARD)); then
            relance=1
            nmcli --wait 20 connection up "$vu" >/dev/null 2>&1 || true
            continue
        fi
        sleep "$PAS"
    done
    log "Wi-Fi maison pas connecté au bout de ${ATTENTE} s"
    passer_canard
}

etat() {
    local actif
    actif=$(connexion_active)
    if [[ $actif == "$PROFIL" ]]; then
        echo "Réseau du canard « $(ssid_de "$PROFIL") » : appli sur http://$(adresse_wifi)"
    elif [[ -n $actif ]]; then
        echo "Wi-Fi « $actif » : appli sur http://$(adresse_wifi) ou http://$(hostname).local"
    else
        echo "Pas de Wi-Fi"
    fi
}

compter_telephones() {
    if command -v iw >/dev/null 2>&1; then
        iw dev "$IF" station dump 2>/dev/null | grep -c '^Station' || true
    else
        echo "?"
    fi
}

essai() {
    local duree=${1:-120} avant fin n max=0
    [[ $duree =~ ^[0-9]+$ ]] || { echo "durée en secondes attendue" >&2; return 2; }
    mkdir -p "$(dirname "$ESSAI")"
    avant=$(connexion_active)
    {
        echo "Essai du réseau du canard : $(date '+%d/%m/%Y %H:%M:%S'), $duree s"
        echo "Avant : ${avant:-aucun Wi-Fi}"
    } >"$ESSAI"
    if passer_canard; then
        echo "Point d'accès : OK, adresse $(adresse_wifi)" >>"$ESSAI"
        fin=$((SECONDS + duree))
        while ((SECONDS < fin)); do
            sleep 5
            n=$(compter_telephones)
            [[ $n =~ ^[0-9]+$ ]] && ((n > max)) && max=$n
        done
        echo "Téléphones connectés en même temps (maximum) : $max" >>"$ESSAI"
        if systemctl is-active --quiet canard-telecommande 2>/dev/null; then
            echo "Serveur de la télécommande : actif" >>"$ESSAI"
        else
            echo "Serveur de la télécommande : ARRÊTÉ" >>"$ESSAI"
        fi
    else
        echo "Point d'accès : ÉCHEC (voir journalctl -u NetworkManager)" >>"$ESSAI"
    fi
    if [[ -n $avant && $avant != "$PROFIL" ]] && nmcli --wait 40 connection up "$avant" >/dev/null 2>&1; then
        noter_etat maison
        log "fin de l'essai, retour sur « $avant »"
    else
        revenir_wifi
    fi
    echo "Après : $(etat)" >>"$ESSAI"
}

case ${1:-etat} in
    auto) auto ;;
    canard) passer_canard ;;
    wifi | maison) revenir_wifi ;;
    essai) essai "${2:-120}" ;;
    etat) etat ;;
    *)
        sed -n '2,12p' "$0" | sed 's/^# \{0,1\}//'
        exit 2
        ;;
esac
