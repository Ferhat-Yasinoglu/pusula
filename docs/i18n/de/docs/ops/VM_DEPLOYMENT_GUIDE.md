# Pusula — Deployment Guide on VM with Cloudflare (Deutsch)

🌐 **Languages:** 🇺🇸 [English](../../../../ops/VM_DEPLOYMENT_GUIDE.md) · 🇮🇷 [fa](../../../fa/docs/ops/VM_DEPLOYMENT_GUIDE.md) · 🇹🇷 [tr](../../../tr/docs/ops/VM_DEPLOYMENT_GUIDE.md)

---

🌐 **Languages:** 🇺🇸 [English](../../../../ops/VM_DEPLOYMENT_GUIDE.md) · 🇮🇷 [fa](../../../fa/docs/ops/VM_DEPLOYMENT_GUIDE.md) · 🇹🇷 [tr](../../../tr/docs/ops/VM_DEPLOYMENT_GUIDE.md)

Vollständige Anleitung zur Installation und Konfiguration von Pusula auf einer VM (VPS) mit einer über Cloudflare verwalteten Domain.

---

## Voraussetzungen

| Komponente         | Minimum                    | Empfohlen        |
| ------------------ | -------------------------- | ---------------- |
| **CPU**            | 1 vCPU                     | 2 vCPU           |
| **RAM**            | 1 GB                       | 2 GB             |
| **Festplatte**     | 10 GB SSD                  | 25 GB SSD        |
| **Betriebssystem** | Ubuntu 22.04 LTS           | Ubuntu 24.04 LTS |
| **Domain**         | Bei Cloudflare registriert | —                |
| **Docker**         | Docker Engine 24+          | Docker 27+       |

**Getestete Anbieter**: Akamai (Linode), DigitalOcean, Vultr, Hetzner, AWS Lightsail.

---

## 1. VM konfigurieren

### 1.1 Instanz erstellen

Bei Ihrem bevorzugten VPS-Anbieter:

- Ubuntu 24.04 LTS auswählen
- Den kleinsten Tarif auswählen (1 vCPU / 1 GB RAM)
- Ein sicheres Root-Passwort festlegen oder einen SSH-Schlüssel konfigurieren
- Die **öffentliche IP-Adresse** notieren (z. B. `203.0.113.10`)

### 1.2 Über SSH verbinden

```bash
ssh root@203.0.113.10
```

### 1.3 System aktualisieren

```bash
apt update && apt upgrade -y
```

### 1.4 Docker installieren

```bash
# Abhängigkeiten installieren
apt install -y ca-certificates curl gnupg

# Offizielles Docker-Repository hinzufügen
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $ (. /etc/os-release && echo "$VERSION_CODENAME") stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
```

### 1.5 nginx installieren

```bash
apt install -y nginx
```

### 1.6 Firewall (UFW) konfigurieren

```bash
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP (Weiterleitung)
ufw allow 443/tcp   # HTTPS
ufw enable
```

> **Tipp**: Beschränken Sie für maximale Sicherheit die Ports 80 und 443 ausschließlich auf Cloudflare-IP-Adressen. Weitere Informationen finden Sie im Abschnitt [Erweiterte Sicherheit](#advanced-security).

---

## 2. Pusula installieren

### 2.1 Konfigurationsverzeichnis erstellen

```bash
mkdir -p /opt/pusula
```

### 2.2 Datei mit Umgebungsvariablen erstellen

```bash
cat > /opt/pusula/.env << 'EOF'
# === Sicherheit ===
JWT_SECRET=CHANGE-TO-A-UNIQUE-64-CHAR-SECRET-KEY
INITIAL_PASSWORD=YourSecurePassword123!
API_KEY_SECRET=REPLACE-WITH-ANOTHER-SECRET-KEY
STORAGE_ENCRYPTION_KEY=REPLACE-WITH-THIRD-SECRET-KEY
STORAGE_ENCRYPTION_KEY_VERSION=v1
MACHINE_ID_SALT=CHANGE-TO-A-UNIQUE-SALT
PUSULA_WS_BRIDGE_SECRET=REPLACE-WITH-WS-BRIDGE-SECRET  # In der Produktionsumgebung ERFORDERLICH: wird von der Codex Responses WS Bridge verwendet

# === Anwendung ===
PORT=20128
NODE_ENV=production
HOSTNAME=0.0.0.0
DATA_DIR=/app/data
APP_LOG_TO_FILE=true
AUTH_COOKIE_SECURE=true
REQUIRE_API_KEY=false

# === URLs (an Ihre Domain anpassen) ===
# Interne Basis-URL für Server-zu-Server-Verbindungen, geplante Aufgaben und Selbstabrufe.
BASE_URL=http://127.0.0.1:20128
# Browserseitige URL für OAuth-Callbacks, Dashboard-Links und generierte öffentliche URLs.
NEXT_PUBLIC_BASE_URL=https://llms.seudominio.com
# Optionale explizite Überschreibung des öffentlichen Ursprungs für generierte öffentliche Asset-URLs.
# PUSULA_PUBLIC_BASE_URL=https://llms.seudominio.com

# === Cloud-Synchronisierung (optional) ===
# CLOUD_URL=https://cloud.pusula.example.com
# NEXT_PUBLIC_CLOUD_URL=https://cloud.pusula.example.com
EOF
```

> ⚠️ **WICHTIG**: Generieren Sie eindeutige geheime Schlüssel! Verwenden Sie für jeden Schlüssel `openssl rand -hex 32`.

### 2.3 Container starten

```bash
docker pull ferhat-yasinoglu/pusula:latest

docker run -d \
  --name pusula \
  --restart unless-stopped \
  --env-file /opt/pusula/.env \
  -p 20128:20128 \
  -v pusula-data:/app/data \
  ferhat-yasinoglu/pusula:latest
```

### 2.4 Ausführung überprüfen

```bash
docker ps | grep pusula
docker logs pusula --tail 20
```

Folgendes sollte angezeigt werden: `[DB] SQLite database ready` und `listening on port 20128`.

---

## 3. nginx konfigurieren (Reverse-Proxy)

### 3.1 SSL-Zertifikat generieren (Cloudflare Origin)

Im Cloudflare-Dashboard:

1. Navigieren Sie zu **SSL/TLS → Origin Server**
2. Klicken Sie auf **Create Certificate**
3. Behalten Sie die Standardeinstellungen bei (15 Jahre, \*.yourdomain.com)
4. Kopieren Sie das **Origin Certificate** und den **Private Key**

```bash
mkdir -p /etc/nginx/ssl

# Zertifikat einfügen
nano /etc/nginx/ssl/origin.crt

# Privaten Schlüssel einfügen
nano /etc/nginx/ssl/origin.key

chmod 600 /etc/nginx/ssl/origin.key
```

### 3.2 Nginx-Konfiguration

```bash
cat > /etc/nginx/sites-available/pusula << 'NGINX'
# Standardserver — blockiert den direkten Zugriff über die IP-Adresse
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    listen 443 ssl default_server;
    listen [::]:443 ssl default_server;
    ssl_certificate     /etc/nginx/ssl/origin.crt;
    ssl_certificate_key /etc/nginx/ssl/origin.key;
    server_name _;
    return 444;
}

# Pusula — HTTPS
server {
    listen 443 ssl;
    listen [::]:443 ssl;
    server_name llms.yourdomain.com;  # In Ihre Domain ändern

    ssl_certificate     /etc/nginx/ssl/origin.crt;
    ssl_certificate_key /etc/nginx/ssl/origin.key;
    ssl_protocols TLSv1.2 TLSv1.3;

    client_max_body_size 100M;

    location / {
        proxy_pass http://127.0.0.1:20128;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket-Unterstützung
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        # SSE (Server-Sent Events) — Streaming von KI-Antworten
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 600s;
        proxy_send_timeout 600s;
    }
}

# HTTP → HTTPS-Weiterleitung
server {
    listen 80;
    listen [::]:80;
    server_name llms.yourdomain.com;
    return 301 https://$server_name$request_uri;
}
NGINX
```

Stimmen Sie die Stream-Zeitüberschreitungen des Reverse-Proxys mit den Timeout-Umgebungsvariablen von Pusula ab. Wenn Sie
`FETCH_TIMEOUT_MS` / `STREAM_IDLE_TIMEOUT_MS` erhöhen, erhöhen Sie `proxy_read_timeout` / `proxy_send_timeout`
über denselben Schwellenwert hinaus.

Pusula verwendet `NEXT_PUBLIC_BASE_URL` als kanonischen, browserseitig erreichbaren Ursprung für OAuth-
Callbacks und generierte öffentliche Links. Authentifizierte Schreibvorgänge im Dashboard verwenden Same-Origin-Anfragen
sowie sitzungsgebundenen CSRF-Schutz und benötigen daher keine statische öffentliche Basis-URL. Die oben aufgeführten
`X-Forwarded-*`-Header sind weiterhin nützliche Routing-Metadaten, ersetzen jedoch nicht
die Festlegung der expliziten öffentlichen URL, wenn OAuth oder generierte Browserlinks eine solche benötigen. Aktivieren Sie
`PUSULA_TRUST_PROXY` nur, wenn Pusula für Clients nicht direkt erreichbar ist und Ihr Proxy
eingehende Forwarded-Header entfernt und neu erstellt.

### 3.3 Aktivieren und testen

```bash
# Standardkonfiguration entfernen
rm -f /etc/nginx/sites-enabled/default

# Pusula aktivieren
ln -sf /etc/nginx/sites-available/pusula /etc/nginx/sites-enabled/pusula

# Testen und neu laden
nginx -t && systemctl reload nginx
```

---

## 4. Cloudflare-DNS konfigurieren

### 4.1 DNS-Eintrag hinzufügen

Im Cloudflare-Dashboard → DNS:

| Typ | Name   | Inhalt                 | Proxy              |
| --- | ------ | ---------------------- | ------------------ |
| A   | `llms` | `203.0.113.10` (VM-IP) | ✅ Proxy aktiviert |

### 4.2 SSL konfigurieren

Unter **SSL/TLS → Übersicht**:

- Modus: **Vollständig (strikt)**

Unter **SSL/TLS → Edge-Zertifikate**:

- HTTPS immer verwenden: ✅ Ein
- TLS-Mindestversion: TLS 1.2
- Automatische HTTPS-Umschreibungen: ✅ Ein

### 4.3 Testen

```bash
curl -sI https://llms.seudominio.com/health
# Sollte HTTP/2 200 zurückgeben
```

---

## 5. Betrieb und Wartung

### Auf eine neue Version aktualisieren

```bash
docker pull ferhat-yasinoglu/pusula:latest
docker stop pusula && docker rm pusula
docker run -d --name pusula --restart unless-stopped \
  --env-file /opt/pusula/.env \
  -p 20128:20128 \
  -v pusula-data:/app/data \
  ferhat-yasinoglu/pusula:latest
```

### Protokolle anzeigen

```bash
docker logs -f pusula          # Echtzeit-Ausgabe
docker logs pusula --tail 50   # Letzte 50 Zeilen
```

### Manuelle Datenbanksicherung

```bash
# Daten aus dem Volume auf den Host kopieren
docker cp pusula:/app/data ./backup-$(date +%F)

# Oder das gesamte Volume komprimieren
docker run --rm -v pusula-data:/data -v $(pwd):/backup \
  alpine tar czf /backup/pusula-data-$(date +%F).tar.gz /data
```

### Aus einer Sicherung wiederherstellen

```bash
docker stop pusula
docker run --rm -v pusula-data:/data -v $(pwd):/backup \
  alpine sh -c "rm -rf /data/* && tar xzf /backup/pusula-data-YYYY-MM-DD.tar.gz -C /"
docker start pusula
```

---

## 6. Erweiterte Sicherheit

### nginx auf Cloudflare-IPs beschränken

```bash
cat > /etc/nginx/cloudflare-ips.conf << 'CF'
# Cloudflare-IPv4-Bereiche — regelmäßig aktualisieren
# https://www.cloudflare.com/ips-v4/
set_real_ip_from 173.245.48.0/20;
set_real_ip_from 103.21.244.0/22;
set_real_ip_from 103.22.200.0/22;
set_real_ip_from 103.31.4.0/22;
set_real_ip_from 141.101.64.0/18;
set_real_ip_from 108.162.192.0/18;
set_real_ip_from 190.93.240.0/20;
set_real_ip_from 188.114.96.0/20;
set_real_ip_from 197.234.240.0/22;
set_real_ip_from 198.41.128.0/17;
set_real_ip_from 162.158.0.0/15;
set_real_ip_from 104.16.0.0/13;
set_real_ip_from 104.24.0.0/14;
set_real_ip_from 172.64.0.0/13;
set_real_ip_from 131.0.72.0/22;
real_ip_header CF-Connecting-IP;
CF
```

Fügen Sie Folgendes innerhalb des Blocks `http {}` zu `nginx.conf` hinzu:

```nginx
include /etc/nginx/cloudflare-ips.conf;
```

### fail2ban installieren

```bash
apt install -y fail2ban
systemctl enable fail2ban
systemctl start fail2ban

# Status überprüfen
fail2ban-client status sshd
```

### Direkten Zugriff auf den Docker-Port blockieren

```bash
# Direkten externen Zugriff auf Port 20128 verhindern
iptables -I DOCKER-USER -p tcp --dport 20128 -j DROP
iptables -I DOCKER-USER -i lo -p tcp --dport 20128 -j ACCEPT

# Regeln dauerhaft speichern
apt install -y iptables-persistent
netfilter-persistent save
```

---

## 7. Bereitstellung auf Cloudflare Workers (optional)

Für den Remotezugriff über Cloudflare Workers, ohne die VM direkt zugänglich zu machen:

```bash
# Im lokalen Repository
cd pusulaCloud
npm install
npx wrangler login
npx wrangler deploy
```

Eine Anleitung zu Cloudflare Tunnel innerhalb des Repositorys finden Sie außerdem in [TUNNELS_GUIDE.md](./TUNNELS_GUIDE.md). Der eigenständige Worker `pusulaCloud/` befindet sich in einem separaten Begleit-Repository.

---

## Portübersicht

| Port  | Dienst      | Zugriff                    |
| ----- | ----------- | -------------------------- |
| 22    | SSH         | Öffentlich (mit fail2ban)  |
| 80    | nginx HTTP  | Weiterleitung → HTTPS      |
| 443   | nginx HTTPS | Über Cloudflare Proxy      |
| 20128 | Pusula   | Nur localhost (über nginx) |

## Optimierung für wenig Arbeitsspeicher / kleine VPS-Instanzen

Für Bereitstellungen auf kleinen VPS-Instanzen (1 GB RAM oder weniger):

- **Hintergrunddienste deaktivieren** — setzen Sie `PUSULA_DISABLE_BACKGROUND_SERVICES=1`, um den Scheduler, den MCP-Server und regelmäßige Wartungsaufgaben zu überspringen. Siehe `docs/reference/ENVIRONMENT.md`.
- **SQLite-WAL-Modus verwenden** — ist standardmäßig aktiviert und reduziert den maximalen Speicherverbrauch bei gleichzeitigen Lesevorgängen.
- **V8-Heap begrenzen** — setzen Sie `PUSULA_MEMORY_MB` (z. B. `512`), damit die Laufzeitumgebung keinen Grenzwert ermittelt, der größer als die VM ist. Siehe `docs/reference/ENVIRONMENT.md`.
- **Die Zulassung ressourcenintensiver Anfragen skaliert automatisch mit der Heap-Begrenzung** -- sobald `PUSULA_MEMORY_MB` wie oben beschrieben festgelegt ist, wird das Byte-Budget für die Aufnahme (`PUSULA_CHAT_MAX_INFLIGHT_BYTES`) von demselben Grenzwert abgeleitet. Dadurch erhält eine VM mit begrenztem Arbeitsspeicher ohne zusätzliche Feinabstimmung automatisch ein kleineres Budget für gleichzeitige Anfragen; überzählige Anfragen erhalten eine wiederholbare `503`-Antwort mit `Retry-After`, anstatt um Arbeitsspeicher zu konkurrieren. Legen Sie die ältere, anzahlbasierte Obergrenze `PUSULA_CHAT_MAX_HEAVY_IN_FLIGHT` nur fest, wenn Sie zusätzlich eine harte Begrenzung benötigen.
- **`next build` auf dem VPS vermeiden** — erstellen Sie den Build lokal und stellen Sie die eigenständige Ausgabe (`.next/standalone/`) bereit.
- **Mit `top` / `free -m` überwachen** — Pusula verwendet auf einer VM mit 1 GB im Leerlauf normalerweise 200–400 MB RSS.
