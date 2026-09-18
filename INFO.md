# INFO — instructiuni de lucru

Ghid scurt pentru tot ce s-a schimbat in septembrie 2026: scroll pe sectiuni,
varianta mobila fara GLB-uri mari, preloader complet, optimizarea imaginilor
(WebP) si separarea bazelor de date de Git. Detaliile de instalare raman in
`README.md` si `deploy/README-AAPANEL.txt`.

---

## 1. Comenzi de zi cu zi

| Ce vrei | Comanda | Unde |
|---|---|---|
| Build pentru productie (`dist/` e versionat) | `npm run build` | local |
| Optimizeaza toate pozele existente + rebuild `dist/` | `npm run optimize:images` | local |
| Doar raport, fara modificari | `npm run optimize:images -- --dry-run` | local / server |
| Optimizeaza pozele incarcate din admin pe server | `npm run optimize:images -- --live` | server |
| Deploy pe server | `bash deploy/update.sh` | server |

Ordinea normala a unei publicari:

```bash
# local
npm run build            # sau npm run optimize:images, care face si build
git add -A
git commit -m "..."
git push origin main

# server
cd /var/www/greentech
bash deploy/update.sh
```

---

## 2. Bazele de date si Git

- **`storage/`** = datele live: `storage/data/*.json` (continut, recenzii,
  solicitari, aplicatii), `storage/translations/*.json` (snapshoturi DeepL),
  `storage/uploads/` (poze si video din admin). Daca `.env` seteaza
  `DATA_DIR` / `UPLOADS_DIR` / `TRANSLATIONS_DIR` (recomandat:
  `/var/lib/greentech/...`), acelea sunt datele live.
- `storage/` este **ignorat de Git** (`.gitignore`). Ce modifici din admin pe
  server ramane asa; `git pull` nu il atinge.
- **`data/`** si **`public/uploads/`** = seeduri versionate, citite doar cand
  un fisier live nu exista inca. Serverul nu scrie niciodata in ele.
- `deploy/update.sh` arhiveaza `storage/` in `/root/greentech-storage-*.tar.gz`
  inainte de fiecare pull, face `git pull --ff-only`, `npm ci --omit=dev`,
  `pm2 restart`, apoi pune `storage/` la loc identic. La prima rulare dupa
  scoaterea din Git asta e esential; ulterior e un no-op inofensiv.
- Nu rula `npm run build` si nu rula `npm run optimize:images` **fara `--live`**
  pe server: ar modifica fisiere versionate si ar bloca urmatorul pull.

---

## 3. Imagini

### Upload din admin
- Orice JPEG / PNG / WebP incarcat este convertit pe server (`sharp`):
  orientare EXIF aplicata, latura lunga max **1600 px**, WebP calitate **78**,
  metadate eliminate. GIF si video raman neatinse.
- Comutatorul **"Optimise uploads (WebP)"** din bara de sus a adminului e
  pornit implicit; il opresti daca vrei sa pastrezi originalul pentru un
  anumit upload (se reseteaza la reincarcarea paginii).
- Limita pentru imagini: 24 MB per fisier (pe disc ajunge oricum mic).
- Setarile se schimba intr-un singur loc: `server/imageOptimizer.js`
  (`IMAGE_MAX_EDGE`, `WEBP_QUALITY`).

### Pozele existente (`npm run optimize:images`)
- Converteste tot din `public/projects`, `public/gallery`, `public/clients`,
  `public/uploads` si `UPLOADS_DIR`; rescrie URL-urile in `data/`,
  `storage/data`, `storage/translations`, `DATA_DIR`, `TRANSLATIONS_DIR`;
  sterge originalele; reconstruieste `dist/`.
- Idempotenta: a doua rulare raporteaza "Nothing to optimise".
- Rulata deja local pe 18.09.2026: 361 imagini, 201,5 MB -> 98,3 MB.
- Pe server mai trebuie rulata o data cu `--live` pentru pozele deja incarcate
  din admin (`storage/uploads/gallery`, ~25 MB).
- Logo-urile care nu s-ar micsora (PNG-uri mici) sunt lasate ca atare.

---

## 4. Ce se intampla pe mobil (telefon / tableta mica)

Detectia: `isMobileDevice()` in `src/lib/devicePerformance.js` = pointer
touch + ecran cu latura mica <= 900 px (stabil la rotire).

- **Sectiunile de servicii** (fotovoltaic, electric, constructii, data center)
  folosesc pe **toate dispozitivele** (si desktop) ilustratii SVG line-art
  care se deseneaza pe masura ce derulezi: `src/serviceIllustrations.jsx`
  (desenele) + `src/ServiceSvgIllustration.jsx` (motorul) +
  `ServiceSvgIllustration.css` (pozitie: centrat pe desktop, banda plina pe
  mobil; micro-animatii dupa ce e gata). Ritmul: `BUILD_START_VIEWPORT`
  (0.55 - porneste cand sectiunea a intrat pe jumatate in ecran) si
  `BUILD_COMPLETE_AT` (0.45 din cursa lipita).
  GLB-urile lor (~51 MB) au fost sterse din `public/3d`; componentele
  `Scroll*.jsx` nu mai contin cod three.js.
- **Soarele de la contact** (`space_sun.glb`) nu se incarca si nici spacer-ul
  `solar-contact-visual-space` nu se randeaza; formularele au `padding-top:
  40px` in `SolarContactForms.css`.
- **Turbina eoliana** foloseste `public/3d/animated_wind_turbine_mobile.glb`
  (44 KB: texturi 256 px WebP + Draco, aceeasi animatie) in loc de cea de
  1,27 MB. Alegerea se face in `src/lib/threeAssetCache.js`.
- Preloaderul incarca **tot** ce afiseaza homepage-ul (lista exacta in
  `src/lib/pageAssetPreloader.js` -> `collectHomepageMediaUrls`), iar imaginile
  din sectiuni sunt `loading="eager"`. Masurat: mobil 28 imagini / ~7 MB,
  desktop 40 imagini / ~14 MB (cu JPEG-urile vechi; acum mai putin).

---

## 5. Intrarea in site si scroll in hero (cele 6 scene 3D)

- Nu mai exista pasul "Incepeti explorarea": cand preloaderul ajunge la 100%,
  norii se deschid singuri (`AUTO_ENTER_DELAY`, 600 ms, in `src/main.jsx`).
  Sectiunea "intro-hero" din admin (titlu, descriere, buton) nu mai este
  afisata nicaieri.
- Logo-ul din meniu duce inapoi la prima scena (scroll sus), nu la un ecran
  de intro.
- Un link din meniu apasat in timpul preloaderului este retinut: site-ul
  intra singur si deruleaza la sectiunea ceruta cand e gata.
- Sectiunile sticky de servicii au `data-anchor-progress="0.85"`: un link din
  meniu aterizeaza la 85% din cursa lor, deci cu desenul SVG / modelul 3D
  deja construit, nu la primul pixel (unde ar fi la 0%). Logica e in
  `resolveAnchorScrollTop` din `src/scrollMotion.js`.

`src/heroSectionSnap.js`, montat din `useExperienceScrollController.js`:

- **Un gest = o scena**, pe toate dispozitivele: swipe pe touch, un notch de
  rotita sau un flick de trackpad. De pe scena 6, urmatorul gest aterizeaza
  fix pe `#company`, de unde scroll-ul redevine liber. De pe `#company`, scroll
  in sus revine pe scena 6 ca un pas.
- Pe desktop animatia o face Lenis (`lenis.scrollTo`), pe touch un tween
  propriu. Coada de inertie a trackpadului e filtrata ca sa nu sara doua scene.
- Reglaje (in capul fisierului): `SWIPE_COMMIT_DISTANCE` (24 px),
  `WHEEL_COMMIT_DISTANCE` (30), `SNAP_DURATION` (620 ms touch),
  `WHEEL_SNAP_DURATION` (0.9 s desktop), `WHEEL_COOLDOWN` (260 ms).
- Meniul deschis / rutele modale suspenda tot; cardul extins isi pastreaza
  scroll-ul intern.

---

## 5b. Bara de iconite sociale (dreapta)

- Trei iconite fixe (Facebook, Instagram, LinkedIn) pe marginea dreapta,
  centrate vertical: `src/SideTabs.jsx` + `SideTabs.css`.
- Se controleaza din **Admin -> Continut -> "Bara sociala (dreapta)"**:
  comutatorul "Visible on homepage" ascunde toata bara; fiecare URL gol
  ascunde iconita respectiva. Instagram porneste gol (nu exista pagina in
  continut) - completeaza-l cand ai link.
- Sectiunea este adaugata automat la continutul mai vechi (`withDefaults` in
  `server/contentSchema.js`), deci apare in admin si pe server fara migrare.

## 5c. Dashboard de vizite (admin)

- **Admin -> Dashboard -> "Vizite pe site"**: vizite azi / 7 zile / interval /
  total, grafic pe zile impartit pe surse, procente pe surse, mobil vs.
  desktop, campanii (`utm_campaign`), domenii de origine, ultimele vizite si
  link-urile de partajat cu buton de copiere. Se reincarca singur la 60 s.
- Link-urile de folosit pe retele: `https://greentechpro.ro/?utm_source=facebook`
  (`instagram`, `tiktok`, `other`); optional `&utm_campaign=nume` ca sa vezi
  si campania. Fara `utm_source`, sursa se deduce din referrer (facebook /
  instagram / tiktok / cautare / alt site) sau e "Direct".
- O vizita = o sesiune de browser (un beacon la prima incarcare, `POST
  /api/visits`). Nu se stocheaza IP-uri sau identificatori; botii si
  crawlerele de preview (Facebook, WhatsApp etc.) sunt ignorate.
- Datele stau in `DATA_DIR/site-analytics.json` (agregate pe zi + ultimele 100
  vizite), deci in `storage/`, ignorat de Git — nu se pierd la deploy.
- Cod: `server/analyticsRepository.js`, rutele `/visits` si `/admin/analytics`
  in `server/routes.js`, `src/lib/visitTracker.js` (site),
  `src/components/admin/AnalyticsDashboard.jsx` (admin).
- `server.js` are acum `trust proxy: loopback` ca `request.ip` sa fie IP-ul
  real al vizitatorului din spatele nginx (necesar si pentru rate limiting).

## 6. Fisiere noi / relevante

```
server/imageOptimizer.js          pipeline sharp (upload + script)
scripts/optimize-images.mjs       comanda de optimizare in bloc
deploy/update.sh                  deploy fara sa atinga storage/
src/heroSectionSnap.js            un gest = o scena in hero
src/serviceIllustrations.jsx      cele 4 desene SVG (mobil)
src/ServiceSvgIllustration.jsx    motorul de desenare la scroll
src/ServiceSvgIllustration.css
src/SideTabs.jsx / SideTabs.css     iconitele sociale fixe din dreapta
server/analyticsRepository.js     contor de vizite (agregate pe zi)
src/lib/visitTracker.js           beacon-ul de vizita din site
src/components/admin/AnalyticsDashboard.jsx   dashboard-ul din admin
public/3d/animated_wind_turbine_mobile.glb
```

## 7. De stiut

- `data/site-content.backup.json` este un fisier gol in Git de dinainte.
- `storage/translations/site-content.en.json` avea deja ~224 referinte moarte
  (`/projects/.../butimanu/...`); snapshotul se regenereaza la republicare.
- Warningurile `"use client"` de la `vite build` sunt normale (radix /
  framer-motion).
