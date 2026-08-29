import crypto from 'node:crypto';
import { resolveChannelsForUser } from './channel-resolver.js';
export class ConnectionManager {
    clients = new Set();
    heartbeatInterval;
    constructor() {
        this.startHeartbeat();
    }
    /**
     * Enregistre une nouvelle connexion WebSocket
     */
    handleConnection(socket, jwtVerifyFn) {
        socket.isAlive = true;
        socket.authenticated = false;
        socket.channels = new Set();
        this.clients.add(socket);
        // Timeout de 5 secondes : si pas authentifié, fermer la connexion (code 4401)
        socket.authTimeoutTimer = setTimeout(() => {
            if (!socket.authenticated) {
                socket.close(4401, 'Timeout authentification WS (5s)');
                this.removeSocket(socket);
            }
        }, 5_000);
        // Écoute du pong
        socket.on('pong', () => {
            socket.isAlive = true;
        });
        // Écoute des messages reçus du client
        socket.on('message', (raw) => {
            try {
                const msg = JSON.parse(raw.toString());
                // Authentification dans le 1er message applicatif
                if (!socket.authenticated) {
                    if (msg.type !== 'auth' || !msg.token) {
                        socket.close(4401, 'Authentification requise');
                        return this.removeSocket(socket);
                    }
                    try {
                        const payload = jwtVerifyFn(msg.token);
                        socket.authenticated = true;
                        socket.userId = payload.sub || payload.id;
                        socket.role = payload.role;
                        socket.siteId = payload.siteId;
                        // Résolution automatique des canaux autorisés
                        const channels = resolveChannelsForUser({
                            userId: socket.userId,
                            role: socket.role || 'user',
                            siteId: socket.siteId,
                        });
                        channels.forEach((ch) => socket.channels.add(ch));
                        if (socket.authTimeoutTimer) {
                            clearTimeout(socket.authTimeoutTimer);
                        }
                        socket.send(JSON.stringify({
                            type: 'auth.ok',
                            channels: Array.from(socket.channels),
                            timestamp: new Date().toISOString(),
                        }));
                    }
                    catch (err) {
                        socket.close(4401, 'Token invalide ou expiré');
                        return this.removeSocket(socket);
                    }
                    return;
                }
                // Message de ping applicatif éventuel
                if (msg.type === 'ping') {
                    socket.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
                }
            }
            catch {
                // Ignorer les JSON invalides
            }
        });
        socket.on('close', () => {
            this.removeSocket(socket);
        });
        socket.on('error', () => {
            this.removeSocket(socket);
        });
    }
    /**
     * Diffusion d'un événement Redis à tous les clients abonnés au canal
     */
    broadcastEvent(event) {
        const realtimeMsg = {
            id: crypto.randomUUID(),
            type: event.type,
            channel: event.channel,
            payload: event.payload,
            timestamp: new Date().toISOString(),
        };
        const messageStr = JSON.stringify(realtimeMsg);
        for (const client of this.clients) {
            if (client.authenticated && client.readyState === 1) { // 1 = OPEN
                if (client.channels?.has(event.channel) || event.channel === 'broadcast') {
                    client.send(messageStr);
                }
            }
        }
    }
    /**
     * Heartbeat applicatif (ping toutes les 25 secondes)
     */
    startHeartbeat() {
        this.heartbeatInterval = setInterval(() => {
            for (const client of this.clients) {
                if (client.isAlive === false) {
                    client.terminate();
                    this.clients.delete(client);
                    continue;
                }
                client.isAlive = false;
                client.ping();
            }
        }, 25_000);
    }
    removeSocket(socket) {
        if (socket.authTimeoutTimer) {
            clearTimeout(socket.authTimeoutTimer);
        }
        this.clients.delete(socket);
    }
    getConnectedCount() {
        return this.clients.size;
    }
}
//# sourceMappingURL=connection-manager.js.map