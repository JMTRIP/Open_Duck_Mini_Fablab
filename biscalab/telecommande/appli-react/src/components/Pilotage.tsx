import { AnimatePresence, motion } from 'framer-motion';
import {
  BatteryFull,
  BatteryLow,
  BatteryMedium,
  BatteryWarning,
  ChevronsRight,
  Lightbulb,
  MessageSquare,
  Mic,
  RadioTower,
  SlidersHorizontal,
  Sun,
  Thermometer,
  Volume2,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { reglerSoleil, useSoleil } from '../lib/affichage';
import { enModeAppli, estIOS } from '../lib/appareil';
import { useAppui } from '../lib/appui';
import { alpha, NEON } from '../lib/couleurs';
import { liaison, useLiaison, type Vue } from '../lib/liaison';
import { jouer, retour, vibrer } from '../lib/retours';
import { ecrire, lire } from '../lib/stockage';
import Annonces from './Annonces';
import BoutonAccessoire from './BoutonAccessoire';
import BoutonCarre from './BoutonCarre';
import BoutonStop from './BoutonStop';
import Decor from './Decor';
import DialogueCode from './DialogueCode';
import Joystick from './Joystick';
import MenuPilote from './MenuPilote';
import OngletPilote from './OngletPilote';
import Orientation from './Orientation';
import Puce, { type Ton } from './Puce';
import Radar from './Radar';
import Reglages from './Reglages';
import Scene from './Scene';
import VoyantMarche from './VoyantMarche';

// Disposition sur la scène 932 × 430, pensée pour l'extérieur :
// joysticks de 240 à gauche et à droite, colonne centrale de 376 (radar, voyant de marche, STOP),
// accessoires en grands pavés sous les joysticks, textes de 15 à 22 en gras.
// Pas de bouton Marche : le canard part quand on pousse un joystick et se pose quand on lâche.
const JOY = { taille: 240, haut: 88, gauche: 24, droite: 668 };
const CENTRE = { gauche: 278, largeur: 376 };
const RANGEE = { haut: 250, hauteur: 56, ecart: 8 }; // micro, voyant, phrases
const ONGLET = { gauche: 346, largeur: 240 }; // onglet du pilote, en haut au centre
const ASTUCES_RENDRE = 3; // nombre de fois où l'on rappelle comment rendre la main

function puceLiaison(vue: Vue): { ton: Ton; texte: string; coupee: boolean; clignote: boolean } {
  if (vue.remplace) return { ton: 'rose', texte: 'INACTIVE', coupee: true, clignote: false };
  if (vue.perdu) return { ton: 'rose', texte: 'PERDUE', coupee: true, clignote: true };
  if (!vue.etat) return { ton: 'cyan', texte: 'CONNEXION…', coupee: true, clignote: true };
  const l = vue.latence;
  if (l === null) return { ton: 'vert', texte: 'OK', coupee: false, clignote: false };
  return { ton: l < 60 ? 'vert' : l < 150 ? 'jaune' : 'rose', texte: `${Math.round(l)} ms`, coupee: false, clignote: false };
}

function iconeBatterie(pct: number | null): ReactNode {
  const t = 18;
  if (pct === null) return <BatteryMedium size={t} />;
  if (pct < 10) return <BatteryWarning size={t} />;
  if (pct < 35) return <BatteryLow size={t} />;
  if (pct < 70) return <BatteryMedium size={t} />;
  return <BatteryFull size={t} />;
}

/** Écran allumé tant qu'on pilote (navigateurs en HTTPS seulement). */
function useEcranAllume(oui: boolean) {
  useEffect(() => {
    if (!oui || !('wakeLock' in navigator)) return;
    let verrou: WakeLockSentinel | null = null;
    let fini = false;
    const prendre = async () => {
      try {
        if (document.visibilityState !== 'visible' || verrou) return;
        const v = await navigator.wakeLock.request('screen');
        if (fini) {
          void v.release();
          return;
        }
        verrou = v;
        v.addEventListener('release', () => {
          verrou = null;
        });
      } catch {
        verrou = null;
      }
    };
    void prendre();
    const vis = () => {
      if (document.visibilityState === 'visible') void prendre();
    };
    document.addEventListener('visibilitychange', vis);
    return () => {
      fini = true;
      document.removeEventListener('visibilitychange', vis);
      if (verrou) void verrou.release();
    };
  }, [oui]);
}

const FLECHES = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

/** Clavier, pour essayer sur un ordinateur : Échap ou Espace = STOP, flèches = piloter, Maj = turbo. */
function useClavier(moi: boolean) {
  useEffect(() => {
    const touches = new Set<string>();
    const appliquer = () => {
      if (!moi) return;
      const avant = (touches.has('ArrowUp') ? 1 : 0) - (touches.has('ArrowDown') ? 1 : 0);
      const tourne = (touches.has('ArrowLeft') ? 1 : 0) - (touches.has('ArrowRight') ? 1 : 0);
      liaison.axes = { vx: avant, vy: 0, wz: tourne };
      liaison.sprint = touches.has('Shift');
    };
    const bas = (ev: KeyboardEvent) => {
      if (ev.target instanceof HTMLInputElement) return;
      if (ev.key === 'Escape' || ev.key === ' ') {
        ev.preventDefault();
        if (!ev.repeat) liaison.stop();
        return;
      }
      if (FLECHES.has(ev.key) || ev.key === 'Shift') {
        ev.preventDefault();
        touches.add(ev.key);
        appliquer();
      }
    };
    const haut = (ev: KeyboardEvent) => {
      if (touches.delete(ev.key)) appliquer();
    };
    const flou = () => {
      if (!touches.size) return;
      touches.clear();
      appliquer();
    };
    document.addEventListener('keydown', bas);
    document.addEventListener('keyup', haut);
    window.addEventListener('blur', flou);
    return () => {
      document.removeEventListener('keydown', bas);
      document.removeEventListener('keyup', haut);
      window.removeEventListener('blur', flou);
    };
  }, [moi]);
}

function Etiquette({ x, couleur, children }: { x: number; couleur: string; children: ReactNode }) {
  return (
    <div
      className="pointer-events-none absolute top-[60px] text-center text-[18px] font-bold tracking-[0.2em]"
      style={{ left: x, width: JOY.taille, color: couleur }}
    >
      {children}
    </div>
  );
}

export default function Pilotage() {
  const vue = useLiaison();
  const soleil = useSoleil();
  const e = vue.etat;
  const c = e?.canard;
  const moi = vue.moi;
  const [panneau, setPanneau] = useState<null | 'tout' | 'telephones'>(null);
  const [code, setCode] = useState(false);
  const [turbo, setTurbo] = useState(false);
  const reprise = useAppui(() => liaison.reprendre(), { actif: vue.remplace });
  const [menu, setMenu] = useState(false);
  const fermerMenu = useCallback(() => setMenu(false), []);

  useEcranAllume(moi);
  useClavier(moi);
  useEffect(() => {
    if (moi) return;
    setTurbo(false);
    setMenu(false);
  }, [moi]);
  // On vient de prendre la main : dire (les premières fois) comment la rendre.
  useEffect(() => {
    if (!moi) return;
    const n = lire<number>('astuceRendre', 0);
    if (typeof n === 'number' && n >= ASTUCES_RENDRE) return;
    const id = window.setTimeout(() => {
      liaison.annoncer('Tu pilotes ! Pour rendre la main : touche ton nom, en haut.');
      ecrire('astuceRendre', (typeof n === 'number' ? n : 0) + 1);
    }, 1200);
    return () => window.clearTimeout(id);
  }, [moi]);
  // Sur iPhone dans Safari : rappeler une fois comment avoir le plein écran.
  useEffect(() => {
    if (!estIOS || enModeAppli()) return;
    const id = window.setTimeout(() => liaison.annoncer("Plein écran sur iPhone : Partager, puis « Sur l'écran d'accueil »."), 1500);
    return () => window.clearTimeout(id);
  }, []);

  const lien = puceLiaison(vue);
  const pct = typeof c?.batterie_pct === 'number' ? c.batterie_pct : null;
  const tonBatt: Ton = pct === null ? 'cyan' : pct < 10 ? 'rose' : pct < 25 ? 'jaune' : 'cyan';
  const temp = c?.temp_max;
  const tonTemp: Ton = typeof temp === 'number' ? (temp >= 65 ? 'rose' : temp >= 55 ? 'jaune' : 'cyan') : 'cyan';
  const acc = e?.accessoires ?? {};

  const bientot = (quoi: string) => {
    retour('clic');
    liaison.annoncer(`Bientôt : ${quoi}.`);
  };
  const debutTurbo = () => {
    if (!moi) return;
    liaison.sprint = true;
    setTurbo(true);
    jouer('turbo');
    vibrer(12);
  };
  const finTurbo = () => {
    liaison.sprint = false;
    setTurbo(false);
  };
  const basculer = (b: 'projecteur' | 'antennes') => () => {
    retour('clic');
    liaison.bouton(b);
  };
  const yAccessoires = JOY.haut + JOY.taille + 14;

  return (
    <>
      <Decor />
      <Scene>
        {/* ---------- bandeau du haut ---------- */}
        <div className="absolute left-4 top-2.5 flex gap-2">
          <Puce ton={lien.ton} icone={lien.coupee ? <WifiOff size={18} /> : <Wifi size={18} />} clignote={lien.clignote}>
            {lien.texte}
          </Puce>
          <Puce ton={tonBatt} icone={iconeBatterie(pct)} clignote={pct !== null && pct < 10}>
            {pct === null ? '–' : `${pct} %`}
          </Puce>
        </div>
        <div className="absolute top-0" style={{ left: ONGLET.gauche }}>
          <OngletPilote
            vue={vue}
            menuOuvert={menu}
            onPrendre={() => liaison.prendre()}
            onMenu={() => {
              retour('clic');
              setMenu((m) => !m);
            }}
            onReprendre={() => {
              retour('clic');
              setCode(true);
            }}
          />
        </div>
        <MenuPilote
          ouvert={menu && moi}
          gauche={ONGLET.gauche + ONGLET.largeur / 2 - 160}
          largeur={320}
          autres={Math.max(0, (e?.clients.length ?? 1) - 1)}
          onRendre={() => {
            setMenu(false);
            liaison.rendre();
          }}
          onPasser={() => {
            setMenu(false);
            retour('clic');
            setPanneau('telephones');
          }}
          onFermer={fermerMenu}
        />
        <div className="absolute right-[128px] top-2.5 flex gap-2">
          {typeof temp === 'number' && (
            <Puce ton={tonTemp} icone={<Thermometer size={18} />}>
              {Math.round(temp)}°C
            </Puce>
          )}
          {c?.simule && <Puce ton="rose">{c.modele === 'mujoco' ? 'VIRTUEL' : 'SIMULÉ'}</Puce>}
        </div>
        <BoutonCarre
          style={{ right: 70, top: 4 }}
          couleur={NEON.jaune}
          label={soleil ? 'Quitter le mode plein soleil' : 'Mode plein soleil (contraste maximal)'}
          allume={soleil}
          onClick={() => {
            retour('clic');
            reglerSoleil(!soleil);
          }}
        >
          <Sun size={26} strokeWidth={2.4} />
        </BoutonCarre>
        <BoutonCarre
          style={{ right: 14, top: 4 }}
          couleur={NEON.jaune}
          label="Réglages et détails"
          onClick={() => {
            retour('clic');
            setPanneau('tout');
          }}
        >
          <SlidersHorizontal size={26} strokeWidth={2.4} />
        </BoutonCarre>

        {/* ---------- à gauche : déplacement ---------- */}
        <Etiquette x={JOY.gauche} couleur={NEON.cyanClair}>
          DÉPLACEMENT
        </Etiquette>
        <div className="absolute" style={{ left: JOY.gauche, top: JOY.haut }}>
          <Joystick
            taille={JOY.taille}
            capuchon={92}
            anneau={94}
            course={62}
            teinte="cyan"
            vertical
            actif={moi}
            libelle="Joystick de déplacement"
            onChange={(x, y) => {
              liaison.axes.vx = y;
              liaison.axes.vy = -x;
            }}
          />
        </div>
        <div className="absolute flex gap-2" style={{ left: JOY.gauche, top: yAccessoires }}>
          <BoutonAccessoire couleur={NEON.jaune} label="PHARE" aide="Phare (projecteur)" allume={!!acc.projecteur} actif={moi} largeur={116} hauteur={62} onClic={basculer('projecteur')}>
            <Lightbulb size={26} strokeWidth={2.4} />
          </BoutonAccessoire>
          <BoutonAccessoire couleur={NEON.bleu} label="ANTENNES" aide="Antennes" allume={!!acc.antennes} actif={moi} largeur={116} hauteur={62} onClic={basculer('antennes')}>
            <RadioTower size={26} strokeWidth={2.4} />
          </BoutonAccessoire>
        </div>

        {/* ---------- au centre : radar, voyant de marche, STOP ---------- */}
        <div className="absolute top-[88px]" style={{ left: CENTRE.gauche }}>
          <Radar pose={c?.pose} vitesse={e?.vitesse} />
        </div>
        <BoutonCarre
          style={{ left: CENTRE.gauche, top: RANGEE.haut }}
          taille={RANGEE.hauteur}
          couleur={NEON.cyan}
          label="Commande à la voix (bientôt)"
          onClick={() => bientot('la commande à la voix')}
        >
          <Mic size={26} strokeWidth={2.4} />
        </BoutonCarre>
        <div className="absolute" style={{ left: CENTRE.gauche + RANGEE.hauteur + RANGEE.ecart, top: RANGEE.haut }}>
          <VoyantMarche vue={vue} largeur={CENTRE.largeur - 2 * (RANGEE.hauteur + RANGEE.ecart)} hauteur={RANGEE.hauteur} />
        </div>
        <BoutonCarre
          style={{ left: CENTRE.gauche + CENTRE.largeur - RANGEE.hauteur, top: RANGEE.haut }}
          taille={RANGEE.hauteur}
          couleur={NEON.cyan}
          label="Phrases du canard (bientôt)"
          onClick={() => bientot('les phrases du canard')}
        >
          <MessageSquare size={26} strokeWidth={2.4} />
        </BoutonCarre>
        {/* STOP : toujours au-dessus, même panneau ou dialogue ouvert */}
        <div className="absolute top-[318px] z-[60] h-[86px]" style={{ left: CENTRE.gauche, width: CENTRE.largeur }}>
          <BoutonStop onStop={() => liaison.stop()} />
        </div>

        {/* ---------- à droite : rotation ---------- */}
        <Etiquette x={JOY.droite} couleur={NEON.roseClair}>
          ROTATION
        </Etiquette>
        <div className="absolute" style={{ left: JOY.droite, top: JOY.haut }}>
          <Joystick
            taille={JOY.taille}
            capuchon={92}
            anneau={94}
            course={62}
            teinte="rose"
            vertical={false}
            actif={moi}
            libelle="Joystick de rotation"
            onChange={(x) => {
              liaison.axes.wz = -x;
            }}
          />
        </div>
        <div className="absolute flex gap-2" style={{ left: JOY.droite, top: yAccessoires }}>
          <BoutonAccessoire couleur={NEON.rose} label="COIN-COIN" aide="Coin-coin" actif={moi} largeur={116} hauteur={62} onClic={() => liaison.bouton('son')}>
            <Volume2 size={26} strokeWidth={2.4} />
          </BoutonAccessoire>
          <BoutonAccessoire
            couleur={NEON.vert}
            label="TURBO"
            aide="Turbo (maintenir)"
            allume={turbo || !!e?.sprint}
            actif={moi}
            largeur={116}
            hauteur={62}
            onAppui={debutTurbo}
            onLacher={finTurbo}
          >
            <ChevronsRight size={28} strokeWidth={2.6} />
          </BoutonAccessoire>
        </div>

        {/* ---------- liaison perdue, appli ouverte ailleurs ---------- */}
        <AnimatePresence>
          {(vue.perdu || vue.remplace) && (
            <motion.button
              key="bandeau"
              type="button"
              disabled={!vue.remplace}
              {...reprise}
              className="coupe absolute z-20 px-4 py-3 text-center text-white"
              style={{ left: CENTRE.gauche + 10, top: 118, width: CENTRE.largeur - 20, background: alpha(NEON.rose, 0.95) }}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
            >
              <div className={`text-[22px] font-bold tracking-[0.14em] ${vue.remplace ? '' : 'clignote'}`}>
                {vue.remplace ? 'APPLI OUVERTE AILLEURS' : 'LIAISON PERDUE'}
              </div>
              <div className="text-[15px] font-semibold">
                {vue.remplace ? 'Touche ici pour reprendre la télécommande.' : 'Le canard se met en pause tout seul.'}
              </div>
            </motion.button>
          )}
        </AnimatePresence>

        <Annonces />
        <Reglages ouvert={panneau !== null} section={panneau ?? 'tout'} onFermer={() => setPanneau(null)} />
        <DialogueCode ouvert={code} onFermer={() => setCode(false)} />
      </Scene>
      <Orientation />
    </>
  );
}
