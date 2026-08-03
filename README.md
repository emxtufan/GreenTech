# GreenTech Professionals

Website React/Vite cu experienta Three.js, server Express, panou de administrare
la `/admin` si persistenta locala in fisiere JSON.

## Productie

Instalarea curenta foloseste:

- Ubuntu cu aaPanel
- Nginx administrat de aaPanel
- Node.js 24 LTS
- PM2 / Node Project Manager din aaPanel
- Git pentru deploy
- fisiere JSON pentru continut si formulare
- domeniile `greentechpro.app` si `www.greentechpro.app`
- aplicatia Node pe `127.0.0.1:3000`

Directorul recomandat pe server este:

```text
/www/wwwroot/greentech
```

`dist/` este versionat in Git. Buildul se face local si nu se executa pe
serverul de productie.

## Cerinte aaPanel

Instaleaza din aaPanel App Store:

1. Nginx
2. Node.js Version Manager si Node.js 24 LTS
3. PM2 Manager / Node Project Manager
4. Git, daca nu este deja disponibil pe Ubuntu

Verificare prin terminal:

```bash
node -v
npm -v
git --version
```

Daca NVM raporteaza un `prefix` incompatibil din `.npmrc`, ruleaza:

```bash
nvm use --delete-prefix v24.18.1 --silent
```

## Instalare initiala

Cloneaza repository-ul si instaleaza doar dependentele necesare serverului:

```bash
cd /www/wwwroot
git clone <URL_REPOSITORY> greentech
cd /www/wwwroot/greentech
npm ci --omit=dev
cp .env.example .env
```

Completeaza `.env` cu valori private:

```dotenv
ADMIN_PASSWORD=parola-admin-puternica
SESSION_SECRET=cheie-lunga-si-aleatoare
DATA_DIR=storage/data
UPLOADS_DIR=storage/uploads
GEOCODER_USER_AGENT="GreenTechProfessionalsAdmin/1.0 (+https://greentechpro.app)"
PORT=3000
HOST=0.0.0.0
```

O cheie de sesiune poate fi generata astfel:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Pregateste directoarele care contin datele modificabile si acorda drepturi
utilizatorului sub care ruleaza PM2:

```bash
mkdir -p storage/data storage/uploads
chown -R www:www storage
chmod -R u+rwX,g+rwX storage
```

Nu adauga `.env` sau `storage/` in Git.

## Configurare PM2 in aaPanel

Adauga un proiect Node cu urmatoarele valori:

| Camp | Valoare |
| --- | --- |
| Name | `GreenTech` |
| Run directory | `/www/wwwroot/greentech` |
| Startup file | `/www/wwwroot/greentech/server.js` |
| Arguments | `--production` |
| Node version | `24 LTS` |
| Environment | `NODE_ENV=production` |
| Port | `3000` |
| Instances | `1` |
| Memory limit | `512M` sau mai mult |
| Run user | `www` |

Aplicatia trebuie sa ruleze intr-o singura instanta PM2 deoarece fisierele JSON
sunt locale. Mai multe instante pot incerca sa scrie simultan acelasi fisier.

Logul corect de pornire contine:

```text
[Storage] Using local JSON persistence.
GreenTech server (production) running at http://localhost:3000
Admin: http://localhost:3000/admin
Persistence: json
```

Verificare locala pe server:

```bash
curl -I http://127.0.0.1:3000/
curl -I http://127.0.0.1:3000/admin
pm2 logs GreenTech --lines 100
```

## Configurare Nginx in aaPanel

Blocul complet de mai jos este configuratia virtual host. In aaPanel se pune la:

```text
Website -> greentechpro.app -> Config
```

Nu pune un al doilea bloc `server {}` in tabul `Rewrite`. Fisierul Rewrite este
deja inclus prin linia:

```nginx
include /www/server/panel/vhost/rewrite/node_GreenTech.conf;
```

Configuratia folosita:

```nginx
server {
    listen 80;
    listen [::]:80;

    listen 443 ssl;
    listen [::]:443 ssl;

    server_name greentechpro.app www.greentechpro.app;

    index index.html index.htm default.htm default.html;

    # Permite uploadul video din panoul de administrare.
    client_max_body_size 250M;

    # SSL
    if ($server_port !~ 443) {
        rewrite ^(/.*)$ https://$host$1 permanent;
    }

    ssl_certificate /www/server/panel/vhost/cert/GreenTech/fullchain.pem;
    ssl_certificate_key /www/server/panel/vhost/cert/GreenTech/privkey.pem;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers EECDH+CHACHA20:EECDH+AES128:RSA+AES128:EECDH+AES256:RSA+AES256;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    add_header Strict-Transport-Security "max-age=31536000";
    error_page 497 https://$host$request_uri;

    # Rewrite
    include /www/server/panel/vhost/rewrite/node_GreenTech.conf;

    # Protected files
    location ~ ^/(\.user.ini|\.htaccess|\.git|\.svn|\.project|LICENSE|README.md|package.json|package-lock.json|\.env|node_modules) {
        return 404;
    }

    # SSL verification
    location /.well-known/ {
        root /www/wwwroot/greentech;
    }

    # Reverse proxy to Node
    location / {
        proxy_pass http://127.0.0.1:3000;

        proxy_http_version 1.1;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        proxy_no_cache 1;
        proxy_cache_bypass 1;

        proxy_connect_timeout 30s;
        proxy_read_timeout 86400s;
        proxy_send_timeout 30s;
    }

    access_log /www/wwwlogs/GreenTech.log;
    error_log /www/wwwlogs/GreenTech.error.log;
}
```

Dupa salvare, verifica si reincarca Nginx:

```bash
nginx -t
nginx -s reload
```

SSL-ul si DNS-ul trebuie configurate in aaPanel pentru ambele domenii. Domeniul
principal si `www` trebuie sa aiba in DNS inregistrari care indica serverul.

## Deploy prin Git

### Pe calculatorul de dezvoltare

Instaleaza dependentele, construieste `dist/`, apoi trimite inclusiv buildul in
repository:

```bash
npm ci
npm run build
git add -A
git commit -m "Update website"
git push
```

### Pe serverul aaPanel

```bash
cd /www/wwwroot/greentech
git pull --ff-only
npm ci --omit=dev
pm2 restart GreenTech --update-env
```

Nu rula `npm run build` pe server. Express serveste direct fisierele din
`dist/`, iar serverul nu are nevoie de dependentele Vite/Tailwind de dezvoltare.

## Persistenta JSON

Continutul initial versionat se afla in `data/`. La prima citire, acesta este
folosit drept seed. Modificarile efectuate din `/admin` si formularele publice
sunt salvate in:

```text
storage/data
storage/uploads
```

Aici se afla continutul live, recenziile, solicitarile de proiect, aplicatiile,
abonatii si fisierele incarcate. Un `git pull` nu suprascrie aceste directoare.

## Backup

Include in backupul aaPanel:

```text
/www/wwwroot/greentech/.env
/www/wwwroot/greentech/storage/
```

Repository-ul Git si `dist/` pot fi reconstruite, dar continutul din `storage/`
este date de productie si trebuie salvat periodic.

## Dezvoltare locala

```bash
npm ci
cp .env.example .env
npm run dev
```

Adrese locale:

```text
http://localhost:3000/
http://localhost:3000/admin
```

Pentru un build local de productie:

```bash
npm run build
npm start
```

## Comenzi utile

```bash
pm2 status
pm2 restart GreenTech --update-env
pm2 logs GreenTech --lines 100
tail -f /www/wwwlogs/GreenTech.error.log
nginx -t
```

