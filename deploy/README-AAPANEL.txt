GREENTECH - AAPANEL PRODUCTION PACKAGE

1. Extract the archive to:
   /www/wwwroot/greentech

2. Install Node.js 24 LTS in aaPanel.

3. Run:
   cd /www/wwwroot/greentech
   bash deploy/install-aapanel.sh

4. Add the PM2 project:
   Startup file: /www/wwwroot/greentech/server.js
   Run directory: /www/wwwroot/greentech
   Node version: 24 LTS
   Run user: www
   Instances: 1
   Memory limit: 512M
   Port: 3000

5. Map the domain through aaPanel to:
   http://127.0.0.1:3000

6. The expected application log contains:
   [Storage] Using local JSON persistence.
   GreenTech server (production) running at http://localhost:3000
   Persistence: json

7. Keep PM2 at one instance. Back up the storage/ directory because it contains
   content, reviews, inquiries, applications and newsletter subscribers.

GIT DEPLOYMENT WITHOUT A SERVER BUILD

Build locally, then commit both source changes and dist/:
   npm ci
   npm run build
   git add -A
   git commit -m "Update website"
   git push

On the server, deploy only with:
   cd /www/wwwroot/greentech
   git pull --ff-only
   npm ci --omit=dev
   pm2 restart greentech --update-env

Do not run npm run build on the server. The tracked dist/ directory is served
directly. Live JSON, CVs and uploads are written to ignored storage/, so they
survive git pull without making the server repository dirty.

SECURITY

The .env file contains private credentials. Never place this archive in a
public directory, Git repository, email attachment or public download URL.
Delete the uploaded archive after extracting it in aaPanel.
