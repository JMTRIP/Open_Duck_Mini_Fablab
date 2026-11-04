/* Appli de pilotage du canard — BiscaLab — version 0.1 (étape 3).
   Protocole : ../protocole.md */
'use strict';
(() => {
  const VERSION = '0.1';
  const ZONE_MORTE = 0.08;        // fraction du joystick sans effet
  const PERIODE_CMD = 50;         // ms : 20 consignes par seconde
  const SILENCE_MAX = 1000;       // ms sans état du canard : liaison perdue
  const $ = (s) => document.querySelector(s);

  // ---------- stockage local (peut être bloqué : l'appli s'en passe) ----------
  const stock = {
    lire(cle, defaut) {
      try { const v = localStorage.getItem('canard.' + cle); return v === null ? defaut : JSON.parse(v); }
      catch { return defaut; }
    },
    ecrire(cle, v) { try { localStorage.setItem('canard.' + cle, JSON.stringify(v)); } catch { /* rien */ } },
  };

  function nouvelId() {
    const octets = new Uint8Array(16);
    crypto.getRandomValues(octets); // crypto.randomUUID n'existe pas hors HTTPS
    return Array.from(octets, (x) => x.toString(16).padStart(2, '0')).join('');
  }
  let idTel = stock.lire('id', null);
  if (typeof idTel !== 'string' || !/^[0-9a-f]{32}$/.test(idTel)) { idTel = nouvelId(); stock.ecrire('id', idTel); }

  const reglages = {
    nom: stock.lire('nom', ''),
    sons: stock.lire('sons', true),
    vibrations: stock.lire('vibrations', true),
  };

  // ---------- sons (synthétisés, aucun fichier) et vibrations ----------
  let ctxAudio = null;
  function audio() {
    if (!ctxAudio) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      ctxAudio = new Ctx();
    }
    if (ctxAudio.state === 'suspended') ctxAudio.resume().catch(() => {});
    return ctxAudio;
  }
  function note(freq, debut, duree, { type = 'sine', vol = 0.18, glisse = null } = {}) {
    const ctx = audio();
    if (!ctx) return;
    const t0 = ctx.currentTime + debut;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (glisse) osc.frequency.exponentialRampToValueAtTime(glisse, t0 + duree);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duree);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + duree + 0.03);
  }
  const SONS = {
    clic: () => note(1400, 0, 0.03, { type: 'triangle', vol: 0.07 }),
    connexion: () => { note(660, 0, 0.09); note(990, 0.1, 0.12); },
    jeton: () => { note(523, 0, 0.08); note(659, 0.09, 0.08); note(784, 0.18, 0.14); },
    marche: () => note(440, 0, 0.18, { glisse: 880 }),
    pause: () => note(660, 0, 0.18, { glisse: 330 }),
    stop: () => { note(220, 0, 0.35, { type: 'square', vol: 0.12 }); note(165, 0.05, 0.35, { type: 'square', vol: 0.1 }); },
    alarme: () => {
      for (let i = 0; i < 3; i++) {
        note(880, i * 0.22, 0.1, { type: 'square', vol: 0.1 });
        note(660, i * 0.22 + 0.11, 0.1, { type: 'square', vol: 0.1 });
      }
    },
    coin: () => {
      note(520, 0, 0.12, { type: 'sawtooth', vol: 0.12, glisse: 380 });
      note(520, 0.16, 0.14, { type: 'sawtooth', vol: 0.12, glisse: 360 });
    },
    erreur: () => note(200, 0, 0.15, { type: 'square', vol: 0.08 }),
  };
  const VIBRATIONS = {
    clic: 8, connexion: 15, jeton: [30, 40, 30], marche: 25, pause: 60,
    stop: 300, alarme: [200, 100, 200, 100, 200], coin: 20, erreur: [80, 50, 80],
  };
  function vibrer(motif) {
    if (reglages.vibrations && navigator.vibrate) { try { navigator.vibrate(motif); } catch { /* rien */ } }
  }
  function retour(nom) {
    if (reglages.sons) { try { SONS[nom]?.(); } catch { /* rien */ } }
    vibrer(VIBRATIONS[nom] ?? 10);
  }

  // ---------- message en bas d'écran ----------
  let minuterieToast = null;
  function toast(texte, alerte = false) {
    const el = $('#toast');
    el.textContent = texte;
    el.classList.toggle('alerte', alerte);
    el.hidden = false;
    clearTimeout(minuterieToast);
    minuterieToast = setTimeout(() => { el.hidden = true; }, alerte ? 4000 : 2500);
  }

  // ---------- liaison avec le canard ----------
  const etat = {
    ws: null,
    num: null,            // numéro public donné par le canard
    dernier: null,        // dernier message « etat »
    recuA: 0,             // performance.now() du dernier état
    enLigne: false,       // au moins un état reçu sur cette connexion
    latence: null,        // aller-retour en ms
    essais: 0,
    remplace: false,      // appli ouverte ailleurs sur ce téléphone
    alarmeDonnee: false,
    etaisPilote: false,
    batterieSignalee: false,
    axes: { vx: 0, vy: 0, wz: 0 },
    sprint: false,
  };

  function estPilote(e = etat.dernier) {
    return !!(e && e.pilote && etat.num !== null && e.pilote.num === etat.num);
  }

  function envoyer(msg) {
    const ws = etat.ws;
    if (!ws || ws.readyState !== WebSocket.OPEN) return false;
    ws.send(JSON.stringify(msg));
    return true;
  }

  function connecter() {
    if (etat.ws) return;
    etat.remplace = false;
    const url = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`;
    let ws;
    try { ws = new WebSocket(url); } catch { planifierReconnexion(); return; }
    etat.ws = ws;
    ws.onopen = () => {
      etat.essais = 0;
      envoyer({ t: 'bonjour', id: idTel, nom: reglages.nom, version: VERSION });
    };
    ws.onmessage = (ev) => {
      let m;
      try { m = JSON.parse(ev.data); } catch { return; }
      if (m && typeof m === 'object') recevoir(m);
    };
    ws.onclose = (ev) => {
      if (etat.ws !== ws) return;
      etat.ws = null;
      etat.num = null;
      etat.enLigne = false;
      lacherCommandes();
      if (ev.code === 4001) { etat.remplace = true; return; } // un autre onglet a pris la place
      planifierReconnexion();
    };
    ws.onerror = () => { /* onclose suit */ };
  }

  function planifierReconnexion() {
    const delai = Math.min(3000, 500 * 2 ** etat.essais++);
    setTimeout(() => { if (!etat.ws && !etat.remplace && !document.hidden) connecter(); }, delai);
  }

  function recevoir(m) {
    switch (m.t) {
      case 'bienvenue':
        etat.num = m.num;
        if (reglages.sons) SONS.connexion();
        break;
      case 'etat':
        etat.dernier = m;
        etat.recuA = performance.now();
        etat.enLigne = true;
        afficher(m);
        break;
      case 'evenement':
        surEvenement(m);
        break;
      case 'erreur':
        if (m.code === 'id_invalide') { idTel = nouvelId(); stock.ecrire('id', idTel); }
        retour('erreur');
        toast(m.texte || 'Erreur', true);
        break;
      case 'pong':
        if (typeof m.ts === 'number') etat.latence = performance.now() - m.ts;
        break;
      default:
        break;
    }
  }

  function surEvenement(m) {
    const texte = m.texte || '';
    switch (m.e) {
      case 'jeton': retour('jeton'); toast(texte); break;
      case 'stop': retour('stop'); toast(texte, true); break;
      case 'pause': retour('pause'); toast(`Pause : ${texte}`); break;
      case 'reprise': retour('marche'); toast(texte); break;
      case 'liaison': retour('alarme'); toast(texte, true); break;
      case 'chute': retour('alarme'); toast(texte, true); break;
      case 'bouton':
        if (texte.startsWith('Coin')) { if (reglages.sons) SONS.coin(); vibrer(20); } else retour('clic');
        toast(texte);
        break;
      default: if (texte) toast(texte);
    }
  }

  // Consignes 20 fois par seconde (signe de vie du pilote), latence chaque seconde.
  setInterval(() => {
    if (!estPilote() || document.hidden) return;
    const r = (x) => Math.round(x * 1000) / 1000;
    envoyer({ t: 'cmd', vx: r(etat.axes.vx), vy: r(etat.axes.vy), wz: r(etat.axes.wz), sprint: etat.sprint });
  }, PERIODE_CMD);
  setInterval(() => { if (!document.hidden) envoyer({ t: 'ping', ts: performance.now() }); }, 1000);

  // Surveillance de la liaison côté téléphone.
  setInterval(() => {
    if ($('#pilotage').hidden) return;
    const pLiaison = $('#p-liaison');
    const bandeau = $('#bandeau');
    const ouvert = etat.ws && etat.ws.readyState === WebSocket.OPEN;
    const silence = performance.now() - etat.recuA;
    const perdu = !ouvert || (etat.enLigne && silence > SILENCE_MAX) || !etat.enLigne;
    if (etat.remplace) {
      bandeau.textContent = 'Appli ouverte ailleurs sur ce téléphone. Touche ici pour revenir.';
      bandeau.hidden = false;
      pastille(pLiaison, 'Inactive', 'mauvais');
      return;
    }
    if (perdu) {
      pastille(pLiaison, !etat.dernier ? 'Connexion…' : ouvert && etat.enLigne ? 'Liaison perdue' : 'Reconnexion…', 'mauvais');
      if (etat.dernier) {
        bandeau.textContent = 'Liaison perdue : le canard se met en pause tout seul.';
        bandeau.hidden = false;
        if (!etat.alarmeDonnee && etat.etaisPilote) { retour('alarme'); etat.alarmeDonnee = true; }
      }
    } else {
      bandeau.hidden = true;
      etat.alarmeDonnee = false;
      const l = etat.latence;
      if (l === null) pastille(pLiaison, 'Liaison OK', 'ok');
      else pastille(pLiaison, `Liaison ${Math.round(l)} ms`, l < 60 ? 'ok' : l < 150 ? 'moyen' : 'mauvais');
    }
  }, 250);

  function pastille(el, texte, classe) {
    el.textContent = texte;
    el.classList.remove('ok', 'moyen', 'mauvais');
    if (classe) el.classList.add(classe);
  }

  // ---------- affichage de l'état ----------
  let cleListe = '';

  function afficher(e) {
    const moi = estPilote(e);
    if (moi !== etat.etaisPilote) {
      if (!moi) lacherCommandes();
      garderEcranAllume(moi);
      etat.etaisPilote = moi;
    }
    document.body.classList.toggle('est-pilote', moi);

    const c = e.canard || {};
    if (typeof c.batterie_pct === 'number') {
      const pct = c.batterie_pct;
      pastille($('#p-batterie'), `Batterie ${pct} % · ${Number(c.batterie_v).toFixed(2)} V`,
        pct < 10 ? 'mauvais' : pct < 25 ? 'moyen' : 'ok');
      if (pct < 15 && !etat.batterieSignalee && moi) {
        etat.batterieSignalee = true;
        retour('alarme');
        toast('Batterie faible : il faut ramener le canard.', true);
      }
      if (pct >= 20) etat.batterieSignalee = false;
    }
    if (typeof c.temp_max === 'number') {
      pastille($('#p-temp'), `Servos ${Math.round(c.temp_max)} °C`,
        c.temp_max >= 65 ? 'mauvais' : c.temp_max >= 55 ? 'moyen' : 'ok');
    }
    $('#p-simule').hidden = !c.simule;
    $('#p-simule').textContent = c.modele === 'mujoco' ? 'Canard virtuel' : 'Faux canard';

    const p = e.pilote;
    const btn = $('#btn-jeton');
    if (!p) {
      $('#j-texte').textContent = 'Personne ne pilote';
      btn.textContent = 'Prendre les commandes';
      btn.dataset.action = 'prendre';
    } else if (moi) {
      $('#j-texte').textContent = "C'est toi qui pilotes";
      btn.textContent = 'Rendre la main';
      btn.dataset.action = 'rendre';
    } else {
      $('#j-texte').textContent = `${p.nom} pilote${p.connecte ? '' : ' (liaison coupée)'}`;
      btn.textContent = 'Reprendre la main';
      btn.dataset.action = 'admin';
    }
    btn.classList.toggle('principal', !p);
    $('#j-raison').textContent = e.pause ? `En pause${e.raison ? ' : ' + e.raison : ''}` : 'En marche';

    const marche = $('#btn-marche');
    marche.disabled = !moi;
    marche.textContent = e.pause ? 'Marche' : 'Pause';
    marche.classList.toggle('go', e.pause);
    marche.classList.toggle('halte', !e.pause);

    for (const b of document.querySelectorAll('[data-bouton]')) {
      b.disabled = !moi;
      const acc = e.accessoires && e.accessoires[b.dataset.bouton];
      if (typeof acc === 'boolean') b.setAttribute('aria-pressed', String(acc));
    }
    $('#btn-sprint').disabled = !moi;

    const cle = JSON.stringify([e.clients, p && p.num, etat.num]);
    if (cle !== cleListe) { cleListe = cle; afficherListe(e, moi); }
    if ($('#infos').open) afficherCapteurs(e);
    ajouterPose(c.pose);
  }

  function afficherListe(e, moi) {
    const ul = $('#liste-tel');
    ul.replaceChildren();
    for (const cl of e.clients || []) {
      const li = document.createElement('li');
      const nom = document.createElement('span');
      nom.textContent = cl.nom + (cl.num === etat.num ? ' (toi)' : '');
      if (e.pilote && e.pilote.num === cl.num) {
        const badge = document.createElement('span');
        badge.className = 'badge';
        badge.textContent = 'pilote';
        nom.append(badge);
      }
      li.append(nom);
      if (moi && cl.num !== etat.num) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'bouton petit';
        b.textContent = 'Passer la main';
        b.addEventListener('click', () => { retour('clic'); envoyer({ t: 'passer', a: cl.num }); });
        li.append(b);
      }
      ul.append(li);
    }
  }

  function afficherCapteurs(e) {
    const c = e.canard || {};
    const v = e.vitesse || {};
    const lignes = [
      ['Consigne', `${fx(v.vx)} m/s · ${fx(v.vy)} m/s · ${fx(v.wz)} rad/s${e.sprint ? ' · sprint' : ''}`],
      ['Puissance', `${c.puissance_w ?? '–'} W`],
      ['Pieds', c.contacts ? `gauche ${c.contacts.gauche ? 'posé' : 'levé'} · droit ${c.contacts.droit ? 'posé' : 'levé'}` : '–'],
    ];
    const NOMS = { genoux: 'Genoux', hanches: 'Hanches', chevilles: 'Chevilles', tete: 'Tête' };
    for (const [k, t] of Object.entries(c.temperatures || {})) lignes.push([NOMS[k] || k, `${Number(t).toFixed(1)} °C`]);
    if (c.pose) lignes.push(['Position', `x ${fx(c.pose.x)} m · y ${fx(c.pose.y)} m · cap ${Math.round(c.pose.cap * 180 / Math.PI)}°`]);
    if (typeof c.chutes === 'number') lignes.push(['Chutes', `${c.chutes}${c.tombe ? ' (au sol)' : ''}`]);
    lignes.push(['Latence', etat.latence === null ? '–' : `${Math.round(etat.latence)} ms`]);
    const dl = $('#capteurs');
    dl.replaceChildren(...lignes.flatMap(([k, t]) => {
      const dt = document.createElement('dt'); dt.textContent = k;
      const dd = document.createElement('dd'); dd.textContent = t;
      return [dt, dd];
    }));
  }
  const fx = (x) => (typeof x === 'number' ? x.toFixed(2) : '–');

  // ---------- trajet du canard (simulation) ----------
  const trace = { points: [], pose: null, aDessiner: true };

  function ajouterPose(pose) {
    if (!pose) return;
    const der = trace.points[trace.points.length - 1];
    if (!der || Math.hypot(pose.x - der.x, pose.y - der.y) > 0.005 || Math.abs(pose.cap - der.cap) > 0.02) {
      trace.points.push({ x: pose.x, y: pose.y, cap: pose.cap });
      if (trace.points.length > 800) trace.points.shift();
      trace.aDessiner = true;
    }
    trace.pose = pose;
  }

  function dessinerTrace() {
    requestAnimationFrame(dessinerTrace);
    const cv = $('#trace');
    if (!trace.aDessiner || !cv.offsetParent) return;
    trace.aDessiner = false;
    const dpr = window.devicePixelRatio || 1;
    const w = cv.clientWidth, h = cv.clientHeight;
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
      cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    }
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillStyle = '#8f9cab';
    const pts = trace.points;
    if (!pts.length) { ctx.fillText('Trajet du canard', 10, 18); return; }
    // Repère du canard : x vers l'avant (haut de l'écran), y vers la gauche.
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const q of pts) { minX = Math.min(minX, q.x); maxX = Math.max(maxX, q.x); minY = Math.min(minY, q.y); maxY = Math.max(maxY, q.y); }
    const k = Math.min((h - 24) / Math.max(1, maxX - minX), (w - 24) / Math.max(1, maxY - minY));
    const mx = (minX + maxX) / 2, my = (minY + maxY) / 2;
    const ecran = (q) => [w / 2 - (q.y - my) * k, h / 2 - (q.x - mx) * k];
    ctx.fillText(`échelle : 50 cm = ${Math.round(0.5 * k)} px`, 10, h - 8);
    ctx.strokeStyle = 'rgba(245, 197, 24, 0.75)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    pts.forEach((q, i) => { const [sx, sy] = ecran(q); if (i) ctx.lineTo(sx, sy); else ctx.moveTo(sx, sy); });
    ctx.stroke();
    const d = trace.pose || pts[pts.length - 1];
    const [sx, sy] = ecran(d);
    const ux = -Math.sin(d.cap), uy = -Math.cos(d.cap); // direction du regard à l'écran
    ctx.fillStyle = '#f5c518';
    ctx.beginPath();
    ctx.moveTo(sx + ux * 11, sy + uy * 11);
    ctx.lineTo(sx - ux * 6 - uy * 6, sy - uy * 6 + ux * 6);
    ctx.lineTo(sx - ux * 6 + uy * 6, sy - uy * 6 - ux * 6);
    ctx.closePath();
    ctx.fill();
  }
  requestAnimationFrame(dessinerTrace);
  window.addEventListener('resize', () => { trace.aDessiner = true; });

  // ---------- joysticks tactiles (plusieurs doigts à la fois) ----------
  function creerJoystick(zone, { vertical, onChange }) {
    const socle = zone.querySelector('.socle');
    const manche = zone.querySelector('.manche');
    let pid = null, centre = null, rx = 1, ry = 1;

    const placer = (dx, dy) => { manche.style.transform = `translate(${dx * rx}px, ${dy * ry}px)`; };
    function maj(ev) {
      let dx = (ev.clientX - centre.x) / rx;
      let dy = vertical ? (ev.clientY - centre.y) / ry : 0;
      const n = Math.hypot(dx, dy);
      if (n > 1) { dx /= n; dy /= n; }
      placer(dx, dy);
      const m = Math.min(1, n);
      const f = m < ZONE_MORTE ? 0 : (m - ZONE_MORTE) / (1 - ZONE_MORTE) / m;
      onChange(dx * f, -dy * f); // y vers le haut
    }
    function lacher() {
      if (pid === null) return;
      pid = null;
      zone.classList.remove('actif');
      placer(0, 0);
      onChange(0, 0);
    }
    zone.addEventListener('pointerdown', (ev) => {
      if (pid !== null || !estPilote()) return;
      pid = ev.pointerId;
      try { zone.setPointerCapture(pid); } catch { /* rien */ }
      const r = socle.getBoundingClientRect();
      const rm = manche.getBoundingClientRect();
      centre = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      rx = Math.max(1, (r.width - rm.width) / 2);
      ry = vertical ? Math.max(1, (r.height - rm.height) / 2) : 1;
      zone.classList.add('actif');
      vibrer(8);
      maj(ev);
      ev.preventDefault();
    });
    zone.addEventListener('pointermove', (ev) => { if (ev.pointerId === pid) maj(ev); });
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
      zone.addEventListener(type, (ev) => { if (ev.pointerId === pid) lacher(); });
    }
    return { lacher };
  }

  // Axes du protocole : vx > 0 avance, vy > 0 vers la gauche, wz > 0 tourne à gauche.
  const joyDep = creerJoystick($('#zone-dep'), {
    vertical: true,
    onChange: (x, y) => { etat.axes.vx = y; etat.axes.vy = -x; },
  });
  const joyRot = creerJoystick($('#zone-rot'), {
    vertical: false,
    onChange: (x) => { etat.axes.wz = -x; },
  });

  function lacherCommandes() {
    joyDep.lacher();
    joyRot.lacher();
    etat.axes = { vx: 0, vy: 0, wz: 0 };
    etat.sprint = false;
    $('#btn-sprint').setAttribute('aria-pressed', 'false');
  }

  // ---------- boutons ----------
  function stop() {
    retour('stop');
    if (!envoyer({ t: 'stop' })) toast('Pas de liaison : le canard se met en pause tout seul.', true);
  }
  $('#btn-stop').addEventListener('pointerdown', (ev) => { ev.preventDefault(); stop(); });
  $('#btn-stop').addEventListener('click', (ev) => { if (ev.detail === 0) stop(); }); // clavier

  document.addEventListener('keydown', (ev) => {
    if ($('#pilotage').hidden || ev.repeat) return;
    if (ev.key === 'Escape' || (ev.key === ' ' && !(ev.target instanceof HTMLInputElement))) {
      ev.preventDefault();
      stop();
    }
  });

  $('#btn-jeton').addEventListener('click', () => {
    retour('clic');
    const action = $('#btn-jeton').dataset.action;
    if (action === 'prendre') envoyer({ t: 'prendre' });
    else if (action === 'rendre') envoyer({ t: 'rendre' });
    else if (action === 'admin') {
      const code = window.prompt('Code administrateur pour reprendre la main :');
      if (code && code.trim()) envoyer({ t: 'prendre', code: code.trim() });
    }
  });

  $('#btn-marche').addEventListener('click', () => {
    if (!etat.dernier) return;
    envoyer({ t: etat.dernier.pause ? 'marche' : 'pause' });
  });

  for (const b of document.querySelectorAll('[data-bouton]')) {
    b.addEventListener('click', () => { envoyer({ t: 'bouton', b: b.dataset.bouton }); });
  }

  const sprint = $('#btn-sprint');
  const finSprint = () => { etat.sprint = false; sprint.setAttribute('aria-pressed', 'false'); };
  sprint.addEventListener('pointerdown', () => {
    if (!estPilote()) return;
    etat.sprint = true;
    sprint.setAttribute('aria-pressed', 'true');
    vibrer(10);
  });
  for (const type of ['pointerup', 'pointercancel', 'pointerleave']) sprint.addEventListener(type, finSprint);
  sprint.addEventListener('contextmenu', (ev) => ev.preventDefault()); // appui long sur Android

  $('#bandeau').addEventListener('click', () => {
    if (etat.remplace) { etat.remplace = false; connecter(); }
  });

  // ---------- réglages ----------
  $('#r-sons').checked = reglages.sons;
  $('#r-vibrations').checked = reglages.vibrations;
  $('#r-sons').addEventListener('change', (ev) => { reglages.sons = ev.target.checked; stock.ecrire('sons', reglages.sons); });
  $('#r-vibrations').addEventListener('change', (ev) => { reglages.vibrations = ev.target.checked; stock.ecrire('vibrations', reglages.vibrations); });
  $('#btn-prenom').addEventListener('click', () => {
    lacherCommandes();
    $('#pilotage').hidden = true;
    $('#accueil').hidden = false;
    $('#prenom').focus();
  });
  $('#infos').addEventListener('toggle', () => { if ($('#infos').open && etat.dernier) afficherCapteurs(etat.dernier); });
  $('#version').textContent = `Appli ${VERSION}`;

  // ---------- écran allumé pendant le pilotage (HTTPS seulement) ----------
  let verrouEcran = null;
  async function garderEcranAllume(oui) {
    try {
      if (oui && !verrouEcran && 'wakeLock' in navigator && document.visibilityState === 'visible') {
        verrouEcran = await navigator.wakeLock.request('screen');
        verrouEcran.addEventListener('release', () => { verrouEcran = null; });
      } else if (!oui && verrouEcran) {
        await verrouEcran.release();
        verrouEcran = null;
      }
    } catch { verrouEcran = null; }
  }

  // Appli en arrière-plan : plus de consignes, le canard se met en pause tout seul.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { lacherCommandes(); return; }
    if (!etat.ws && !etat.remplace && !$('#pilotage').hidden) connecter();
    if (estPilote()) garderEcranAllume(true);
  });

  // ---------- démarrage ----------
  function demarrer() {
    $('#accueil').hidden = true;
    $('#pilotage').hidden = false;
    trace.aDessiner = true;
    if (etat.ws) etat.ws.close(); // nouveau prénom : on se reconnecte (le jeton est gardé)
    else connecter();
  }

  $('#form-accueil').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const nom = $('#prenom').value.trim().slice(0, 20);
    if (!nom) return;
    reglages.nom = nom;
    stock.ecrire('nom', nom);
    audio(); // les navigateurs n'autorisent le son qu'après un geste
    demarrer();
  });
  document.addEventListener('pointerdown', () => audio(), { once: true, capture: true });

  const nomUrl = new URLSearchParams(location.search).get('nom');
  if (nomUrl) { reglages.nom = nomUrl.trim().slice(0, 20); stock.ecrire('nom', reglages.nom); }
  $('#prenom').value = reglages.nom;
  if (reglages.nom) demarrer();
})();
