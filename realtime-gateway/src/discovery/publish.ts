import { Bonjour, type Service } from 'bonjour-service';
import os from 'node:os';

let bonjourInstance: Bonjour | null = null;
let publishedService: Service | null = null;

export function publishServerPresence(log?: { info: (msg: string) => void; warn: (msg: string) => void; error: (msg: string) => void }) {
  try {
    if (!bonjourInstance) {
      bonjourInstance = new Bonjour();
    }

    const port = Number(process.env.PROXY_PORT || process.env.PORT) || 5030;
    const hostname = os.hostname();
    const siteName = process.env.SITE_NAME || 'Centre de Santé Willo';
    const caFingerprint = process.env.CA_FINGERPRINT || 'default-sha256-fingerprint';

    publishedService = bonjourInstance.publish({
      name: `willo-server-${hostname}`,
      type: 'willo',
      protocol: 'tcp',
      port,
      txt: {
        siteName,
        apiVersion: '1.0',
        caFingerprint,
        authPort: process.env.AUTH_PORT || '3001',
        wsPort: process.env.REALTIME_PORT || '3011',
        proxyPort: String(port),
      },
    });

    log?.info(`📢 Annonce Bonjour/mDNS (ZeroConf) active sur le réseau LAN (Service: willo-server-${hostname}, Port: ${port})`);
  } catch (err: any) {
    log?.warn(`⚠️ Publication Bonjour/mDNS non disponible sur cette interface réseau : ${err.message}`);
  }
}

export function stopServerPresence(log?: { info: (msg: string) => void }) {
  try {
    if (publishedService) {
      publishedService.stop?.(() => {
        log?.info('🛑 Annonce Bonjour/mDNS arrêtée');
      });
      publishedService = null;
    }
    if (bonjourInstance) {
      bonjourInstance.destroy();
      bonjourInstance = null;
    }
  } catch {
    // Ignorer les erreurs d'arrêt
  }
}