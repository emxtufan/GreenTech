GREENTECH - DEPLOY PE UBUNTU CU AAPANEL, NGINX SI PM2

Configuratia curenta:
  Repository: https://github.com/emxtufan/GreenTech.git
  Director: /var/www/greentech
  Aplicatie: http://127.0.0.1:3000
  PM2: GreenTech, o singura instanta
  Nginx: /etc/nginx/sites-enabled/greentechpro.app
  Domenii: greentechpro.app, www.greentechpro.app,
           greentechpro.ro, www.greentechpro.ro

INSTALARE

  cd /var/www
  git clone https://github.com/emxtufan/GreenTech.git greentech
  cd /var/www/greentech
  npm ci --omit=dev
  cp .env.example .env

Completeaza .env, apoi porneste o singura instanta:

  pm2 start server.js --name GreenTech -- --production
  pm2 save

DEPLOY DIN GIT

Buildul se face local si dist/ se trimite in Git. Pe server:

  cd /var/www/greentech
  git fetch origin main
  git pull --ff-only origin main
  npm ci --omit=dev
  pm2 restart GreenTech --update-env

Nu rula npm run build pe server.

CLOUDFLARE

La registrar se folosesc nameserverele oferite de Cloudflare. In fiecare zona
Cloudflare, recordul A pentru @ indica IP-ul public al serverului, iar www este
CNAME catre domeniul principal. Dupa emiterea certificatului, proxy-ul poate fi
activat si SSL/TLS trebuie setat pe Full (strict).

NGINX SI UPLOADURI

Virtual hostul trebuie sa contina toate cele patru domenii, reverse proxy catre
127.0.0.1:3000 si urmatoarele limite:

  client_max_body_size 250M;
  client_body_timeout 600s;
  proxy_request_buffering off;
  proxy_send_timeout 600s;
  proxy_read_timeout 600s;

Verificare si reload:

  sudo nginx -t
  sudo systemctl reload nginx

DATE LIVE

Continutul, traducerile si uploadurile sunt modificabile. Pentru a evita
conflictele Git, foloseste in .env directoare din afara repository-ului:

  DATA_DIR=/var/lib/greentech/data
  UPLOADS_DIR=/var/lib/greentech/uploads
  TRANSLATIONS_DIR=/var/lib/greentech/translations

Pastreaza backup pentru /var/www/greentech/.env si /var/lib/greentech/.
Instructiunile complete, configuratia Nginx si procedura pentru conflicte Git se
afla in README.md.
