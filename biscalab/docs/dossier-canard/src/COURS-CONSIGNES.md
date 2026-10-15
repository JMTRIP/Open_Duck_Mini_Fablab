# Consignes de rédaction des cours — Canard BiscaLab

Public : membres d'un FabLab (retraités, amateurs expérimentés en bricolage, **aucune** culture préalable en Git, CAO avancée, électronique embarquée ou IA). Ils doivent **apprendre avant d'appliquer**. Le cours doit être lisible par quelqu'un qui part de zéro et rester utile à quelqu'un qui sait déjà un peu.

## Règles absolues
1. **Aucun lien externe.** Pas de `<a href="http…">`, pas d'URL dans le texte, pas de « voir la doc de X ». Tout ce qu'il faut savoir est écrit dans le cours. Les seuls liens autorisés sont internes : `<a href="#cours-xxx">` ou `<a href="#fabrication">` (ancres de la PWA, liste ci-dessous).
2. **Chaque terme technique est expliqué la première fois qu'il apparaît**, en une phrase, dans le texte. En plus, on le balise avec `<i class="t" data-t="slug">texte</i>` (slug = clé du fichier terms.json) : un clic ouvre la définition. Ne baliser que la **première occurrence** d'un terme par cours, et seulement les slugs existants (liste ci-dessous). Si un terme nécessaire n'a pas de slug, l'expliquer simplement dans le texte sans balise.
3. **Français**, tutoiement collectif implicite (« on », « nous », « vous » pluriel), phrases courtes, pas de jargon non expliqué, pas d'anglicisme sans traduction entre parenthèses la première fois. Nombres avec virgule décimale et espace fine avant l'unité (« 7,4 V », « 0,54 s »). Pas de tirets cadratins pour les apartés.
4. **Exemples concrets sur NOTRE robot** (faits dans COURS-FAITS.md). Jamais d'invention de chiffres : si une valeur n'est pas dans la fiche de faits, ne pas la donner ou dire explicitement qu'on la mesurera.
5. **Pédagogie** : partir d'une image mentale simple, puis préciser. Chaque cours contient dans l'ordre : objectifs, prérequis, le cours (plusieurs sections h2, avec des h3), au moins un « Exemple sur notre canard » par section importante, au moins un encadré « Erreur classique », un exercice pratique à faire au FabLab, un auto-contrôle (3 à 6 questions avec réponse cachée), et un « À retenir » (5 à 8 points).
6. Longueur : **1 800 à 3 000 mots** par cours. Dense mais aéré. Pas de remplissage, pas de répétition.
7. HTML : un seul `<section class="page" id="page-cours-xxx" data-title="…" data-sub="…" hidden>` par cours, contenu valide, toutes les balises fermées, attributs entre guillemets doubles. Pas de `<script>`, pas de `<style>`, pas d'images (pas d'`<img>`) ; un schéma simple en SVG inline est autorisé si vraiment utile (viewBox, texte en 11-12 px, classes `.diag`/`.box`/`.arr` fournies). Pas de caractères `<` ou `&` nus dans le texte (écrire `&lt;` `&amp;`).

## Gabarit (à respecter)

```html
<section class="page" id="page-cours-git" data-title="Cours · Git et GitHub" data-sub="Partir de zéro" hidden>
  <div class="page-head">
    <div class="eyebrow">Cours 1 · Bases numériques</div>
    <h1>Git et GitHub, en partant de zéro</h1>
    <p class="lead">Une phrase qui dit à quoi sert ce cours pour le projet.</p>
    <div class="lesson-meta">
      <span class="pill info">Durée : 45 min</span>
      <span class="pill mute">Niveau : débutant</span>
      <span class="pill mute">Prérequis : aucun</span>
      <span class="pill p">Rôles : tout le monde</span>
    </div>
  </div>

  <div class="card lesson-objectives">
    <h2>À la fin de ce cours, vous saurez</h2>
    <ul>
      <li>…</li>
    </ul>
  </div>

  <div class="card lesson">
    <h2>1. Titre de section</h2>
    <p>…</p>
    <h3>Sous-titre</h3>
    <p>…</p>
    <div class="ex"><b>Exemple sur notre canard</b><p>…</p></div>
    <div class="note warn"><svg><use href="#i-warn"/></svg><div><strong>Erreur classique.</strong> …</div></div>
    <div class="note info"><svg><use href="#i-info"/></svg><div><strong>Pourquoi c'est comme ça.</strong> …</div></div>
  </div>

  <!-- autant de cards .lesson que de sections -->

  <div class="card lesson-exo">
    <h2>Exercice pratique au FabLab</h2>
    <p>Matériel : … Durée : …</p>
    <ol class="steps">
      <li><div><b>Étape</b> …</div></li>
    </ol>
    <p><strong>Résultat attendu :</strong> …</p>
  </div>

  <div class="card">
    <h2>Auto-contrôle</h2>
    <details class="quiz"><summary>Question 1 ?</summary><p>Réponse.</p></details>
    <details class="quiz"><summary>Question 2 ?</summary><p>Réponse.</p></details>
  </div>

  <div class="card lesson-recap">
    <h2>À retenir</h2>
    <ul>
      <li>…</li>
    </ul>
    <p class="muted">Cours suivant : <a href="#cours-raspberry">Raspberry Pi et Linux</a>.</p>
  </div>
</section>
```

Classes disponibles : `.card`, `.lesson`, `.lesson-objectives`, `.lesson-exo`, `.lesson-recap`, `.lesson-meta`, `.ex`, `.note` (+ `.warn` `.info` `.ok` `.bad`), `.steps` (ol numérotée), `.tw` + `<table>` (tableaux, toujours dans `<div class="tw">`), `<pre><code>` (commandes, fichiers), `<kbd>`, `.quiz` (details), `.pill` (+ `.p .ok .warn .bad .info .mute`), `dl.def` (définitions dt/dd), `.diag` (svg).
Icônes disponibles pour `<use href="#i-…">` : i-warn, i-info, i-check, i-zap, i-cpu, i-git, i-cube, i-printer, i-cart, i-code, i-walk, i-cal, i-shield, i-book, i-link, i-users, i-flag.

## Ancres internes existantes (liens `<a href="#…">` autorisés)
accueil, projet, equipe, github, cao, fabrication, bom, electronique, logiciel, marche, planning, risques, parcours, glossaire, references,
cours-git, cours-raspberry, cours-python, cours-methode, cours-cao, cours-impression, cours-laser, cours-assemblage, cours-electronique, cours-servos, cours-capteurs, cours-securite, cours-marche, cours-rl, cours-calibration, cours-depannage.

## Slugs de termes (data-t) disponibles
git, github, depot, commit, branche, fork, clone, pull, push, pull-request, issue, milestone, conflit, amont, github-desktop, markdown, csv, licence-apache,
cao, parametrique, solide, maillage, stl, step, 3mf, fcstd, freecad, onshape, tolerance, jeu, kerf, dxf-svg,
fdm, filament, couche, perimetre, remplissage, support, orientation, pla, petg, tpu, buse, insert, roulement, gcode, slicer, prusaslicer,
laser-co2, gravure, xcs,
tension, courant, puissance, loi-ohm, li-ion, 18650, 2s, bms, ubec, xt30, gpio, pull-up, i2c, uart, bus-serie, half-duplex, baud, multimetre, soudure, court-circuit, gnd,
servo, servo-bus, pwm, codeur, id-servo, couple, kg-cm, pid, gain-p, backlash, offset, palonnier, sts3215, waveshare, firmware, banc-servo, alim-labo, potence,
raspberry-pi, pi-zero-2w, os, raspberry-pi-os, carte-sd, flasher, ssh, terminal, python, venv, pip, json, script, log, systemd, bluetooth-manette,
imu, bno055, accelerometre, gyroscope, magnetometre, fusion, quaternion, derive, contact-pied, ndof, clock-stretching,
ddl, cinematique, centre-de-masse, polygone-sustentation, phase-appui, periode-marche, inertie,
simulation, mujoco, mjcf, urdf, placo, mouvement-reference, rl, politique, recompense, ppo, reseau-neurones, observation, action, onnx, sim2real, domain-randomization, gpu, bam, frequence-controle, runtime, duck-config, home-pose, action-scale, crc,
fiche-de-test, dod, go-no-go, journal-de-bord, bom, fablab.
