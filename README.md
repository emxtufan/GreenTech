# Greentech Professionals

Website React/Vite cu scene Three.js, server Express, panou de administrare la
`/admin`, continut JSON si traduceri automate.

## Arhitectura de productie

Configuratia folosita in productie este:

```text
Vizitator
  -> Cloudflare DNS si proxy
  -> Nginx pe Ubuntu (HTTPS)
  -> Node.js / PM2 pe 127.0.0.1:3000
  -> dist/ + datele JSON si uploadurile din storage/
```

- repository: `https://github.com/emxtufan/GreenTech.git`
- director pe server: `/var/www/greentech`
- proces PM2: `GreenTech`
- port intern: `3000`
- domenii: `greentechpro.app`, `www.greentechpro.app`, `greentechpro.ro` si
  `www.greentechpro.ro`
- configuratie Nginx activa: `/etc/nginx/sites-enabled/greentechpro.app`
- SSL: Certbot / Let's Encrypt
- `dist/` este versionat in Git; buildul se face local, nu pe server
- o singura instanta PM2, deoarece persistenta este bazata pe fisiere JSON

aaPanel poate fi folosit pentru administrarea procesului Node, a fisierelor si
a backupurilor. Traficul public trece prin configuratia Nginx de mai sus.

## 1. Domenii si Cloudflare

Pentru fiecare domeniu adaugat in Cloudflare:

1. Adauga domeniul ca zona noua in Cloudflare.
2. Inlocuieste la registrar nameserverele vechi cu nameserverele oferite de
   Cloudflare.
3. In Cloudflare DNS adauga un record `A` pentru `@`, cu IP-ul public al
   serverului Ubuntu.
4. Adauga `www` ca `CNAME` catre domeniul principal sau ca record `A` catre
   acelasi IP.
5. Activeaza proxy-ul Cloudflare pentru recordurile web dupa emiterea
   certificatului SSL.
6. In `SSL/TLS`, foloseste `Full (strict)` dupa ce certificatul de pe server
   include toate cele patru nume.

In recordul `A` se introduce IP-ul public al serverului de origine, nu un IP
Cloudflare. Cand proxy-ul este activ, vizitatorii vor primi automat IP-urile
Cloudflare.

Nu sterge recordurile `MX`, `TXT`, `DKIM` sau alte recorduri folosite pentru
email. Nu configura reguli de tip `Cache Everything` pentru `/admin*` sau
`/api*`.

Verificari DNS:

```bash
dig +short greentechpro.app
dig +short greentechpro.ro
dig NS greentechpro.ro +short
```

## 2. Instalare initiala

Cerinte:

- Ubuntu
- Nginx
- Git
- Node.js 24 LTS
- PM2
- Certbot cu modulul Nginx

Instalare:

```bash
cd /var/www
git clone https://github.com/emxtufan/GreenTech.git greentech
cd /var/www/greentech
npm ci --omit=dev
cp .env.example .env
```

Daca NVM raporteaza un `prefix` incompatibil din `.npmrc`:

```bash
nvm use --delete-prefix v24.18.1 --silent
```

Genereaza o cheie privata pentru sesiuni:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Completeaza `.env` doar pe server:

```dotenv
ADMIN_PASSWORD=parola-admin-puternica
SESSION_SECRET=cheie-lunga-si-aleatoare
DATA_DIR=storage/data
UPLOADS_DIR=storage/uploads
TRANSLATIONS_DIR=storage/translations
DEEPL_API_KEY=cheia-privata-deepl
CONTENT_SOURCE_LOCALE=ro
TRANSLATION_LOCALES=en,it,es
GEOCODER_USER_AGENT="GreentechProfessionalsAdmin/1.0 (+https://greentechpro.ro)"
PORT=3000
HOST=0.0.0.0
```

Protejeaza fisierul:

```bash
chmod 600 /var/www/greentech/.env
```

Nu urca niciodata `.env` in Git. Parola de admin, cheia de sesiune si cheia
DeepL sunt secrete de productie.

## 3. Datele live

Configuratia existenta foloseste:

```text
storage/data
storage/uploads
storage/translations
```

Acest repository contine in prezent si snapshoturi versionate din `storage/`.
Din acest motiv, modificarile facute din admin pe server pot aparea in
`git status` si pot bloca un `git pull`.

### Varianta recomandata

Pentru ca datele live sa ramana complet in afara checkoutului Git, muta-le o
singura data intr-un director separat:

```bash
sudo mkdir -p /var/lib/greentech/data
sudo mkdir -p /var/lib/greentech/uploads
sudo mkdir -p /var/lib/greentech/translations

sudo cp -a /var/www/greentech/storage/data/. /var/lib/greentech/data/
sudo cp -a /var/www/greentech/storage/uploads/. /var/lib/greentech/uploads/
sudo cp -a /var/www/greentech/storage/translations/. /var/lib/greentech/translations/
```

Afla utilizatorul procesului Node si acorda-i drepturi pe noul director:

```bash
ps -eo user,pid,cmd | grep '[n]ode .*server.js'
sudo chown -R UTILIZATOR_PM2:UTILIZATOR_PM2 /var/lib/greentech
sudo chmod -R u+rwX,g+rwX,o-rwx /var/lib/greentech
```

Inlocuieste `UTILIZATOR_PM2` cu utilizatorul afisat, apoi schimba `.env`:

```dotenv
DATA_DIR=/var/lib/greentech/data
UPLOADS_DIR=/var/lib/greentech/uploads
TRANSLATIONS_DIR=/var/lib/greentech/translations
```

Reporneste aplicatia si verifica adminul inainte sa stergi orice copie veche:

```bash
pm2 restart GreenTech --update-env
pm2 logs GreenTech --lines 100
```

## 4. PM2

Pornire din terminal:

```bash
cd /var/www/greentech
pm2 start server.js --name GreenTech -- --production
pm2 save
pm2 startup
```

Daca proiectul este creat din PM2 Manager in aaPanel, foloseste:

| Camp | Valoare |
| --- | --- |
| Name | `GreenTech` |
| Run directory | `/var/www/greentech` |
| Startup file | `/var/www/greentech/server.js` |
| Arguments | `--production` |
| Node version | `24 LTS` |
| Environment | `NODE_ENV=production` |
| Port | `3000` |
| Instances | `1` |

Serverul incarca automat `.env` din radacina proiectului. Verificare:

```bash
pm2 status
pm2 logs GreenTech --lines 100
curl -I http://127.0.0.1:3000/
curl -I http://127.0.0.1:3000/admin
```

## 5. Nginx

Configuratia finala pentru ambele domenii se afla in:

```text
/etc/nginx/sites-enabled/greentechpro.app
```

Continut recomandat:

```nginx
server {
    listen 80;
    listen [::]:80;

    server_name greentechpro.app www.greentechpro.app
                greentechpro.ro www.greentechpro.ro;

    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    listen [::]:443 ssl;

    server_name greentechpro.app www.greentechpro.app
                greentechpro.ro www.greentechpro.ro;

    ssl_certificate /etc/letsencrypt/live/greentechpro.app/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/greentechpro.app/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    # Uploaduri video din admin.
    client_max_body_size 250M;
    client_body_timeout 600s;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        # Trimite uploadul catre Node pe masura ce este primit.
        proxy_request_buffering off;
        proxy_connect_timeout 30s;
        proxy_send_timeout 600s;
        proxy_read_timeout 600s;
    }
}
```

Verifica intotdeauna configuratia inainte de reload:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

Pentru a vedea ce fisier Nginx foloseste efectiv:

```bash
sudo nginx -T 2>&1 | grep -n "server_name.*greentechpro"
```

## 6. SSL pentru ambele domenii

Dupa ce DNS-ul celor doua domenii ajunge la server, extinde certificatul
existent:

```bash
sudo certbot --nginx --cert-name greentechpro.app \
  -d greentechpro.app \
  -d www.greentechpro.app \
  -d greentechpro.ro \
  -d www.greentechpro.ro
```

Verificare:

```bash
sudo certbot certificates
sudo nginx -t
sudo systemctl reload nginx
curl -I https://greentechpro.app
curl -I https://greentechpro.ro
```

Abia dupa emiterea corecta a certificatului seteaza recordurile pe `Proxied` si
modul Cloudflare SSL pe `Full (strict)`.

## 7. Deploy prin Git

### Pe calculatorul de dezvoltare

Buildul de productie se genereaza local si se trimite impreuna cu sursele:

```bash
npm ci
npm run build
git status --short
git add -p
git add dist
git status --short
git commit -m "Update website"
git push origin main
```

Adauga separat orice fisier nou care nu apare in modul interactiv `git add -p`.
Verifica apoi `git status` inainte de commit. Nu adauga `.env`, arhive mari,
exporturi temporare, CV-uri sau documente private.

### Pe server

```bash
cd /var/www/greentech
git status -sb
git fetch origin main
git pull --ff-only origin main
npm ci --omit=dev
pm2 restart GreenTech --update-env
```

Nu rula `npm run build` pe server. Express serveste buildul versionat din
`dist/`.

### Daca `git pull` este blocat de `storage/`

Mai intai creeaza un backup, apoi pastreaza temporar modificarile live:

```bash
cd /var/www/greentech
tar -czf "/root/greentech-storage-$(date +%Y%m%d-%H%M%S).tar.gz" storage
git stash push -m "runtime inainte de deploy" -- storage
git pull --ff-only origin main
git restore --source='stash@{0}' --worktree -- storage
git stash drop 'stash@{0}'
npm ci --omit=dev
pm2 restart GreenTech --update-env
```

Aceasta procedura pastreaza versiunea live din admin. Dupa migrarea directoarelor
runtime in `/var/lib/greentech`, acest conflict nu ar mai trebui sa apara.

Verifica revizia si fisierele servite:

```bash
git log -1 --oneline
grep -oE 'assets/home-[A-Za-z0-9_-]+\.(js|css)' dist/index.html
grep -oE 'assets/admin-[A-Za-z0-9_-]+\.(js|css)' dist/admin.html
pm2 status
```

## 8. Continut si traduceri

- `data/` contine seedul versionat al aplicatiei.
- `DATA_DIR` contine continutul live, recenziile, solicitarile, aplicatiile si
  abonatii.
- `UPLOADS_DIR` contine imaginile, videoclipurile si alte fisiere incarcate.
- `TRANSLATIONS_DIR` contine snapshoturile RO/EN/IT/ES si cache-ul de fraze.
- limba sursa este romana; EN, IT si ES sunt generate pe server prin DeepL.
- preferinta vizitatorului este salvata in `localStorage`.

Dupa modificarea `.env`:

```bash
pm2 restart GreenTech --update-env
```

Promovarea manuala a continutului romanesc versionat peste continutul live se
face numai cand acest lucru este intentionat:

```bash
pm2 stop GreenTech
npm run promote:romanian-content
pm2 restart GreenTech --update-env
```

## 9. Backup

Backupul trebuie sa includa:

```text
/var/www/greentech/.env
/var/lib/greentech/
```

Daca nu ai facut migrarea recomandata, salveaza in schimb:

```text
/var/www/greentech/storage/
```

`dist/` si sursele pot fi recuperate din Git. Continutul live si uploadurile nu
pot fi reconstruite si trebuie salvate periodic.

## 10. Dezvoltare locala

```bash
npm ci
cp .env.example .env
npm run dev
```

Adrese:

```text
http://localhost:3000/
http://localhost:3000/admin
```

Build local de productie:

```bash
npm run build
npm start
```

## Comenzi utile

```bash
pm2 status
pm2 restart GreenTech --update-env
pm2 logs GreenTech --lines 100
sudo nginx -t
sudo systemctl reload nginx
sudo systemctl status nginx --no-pager
sudo certbot certificates
```

## Referinte

- Nginx server names: https://nginx.org/en/docs/http/server_names.html
- Certbot, schimbarea domeniilor unui certificat:
  https://eff-certbot.readthedocs.io/en/stable/using.html#changing-a-certificate-s-domains
