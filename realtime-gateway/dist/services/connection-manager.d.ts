import type { WebSocket } from 'ws';
export interface RealtimeMessage<T = unknown> {
    id: string;
    type: string;
    channel: string;
    payload: T;
    timestamp: string;
}
export interface UserContext {
    userId: string;
    role: string;
    siteId?: string | undefined;
}
export interface ExtWebSocket extends WebSocket {
    isAlive?: boolean;
    authenticated?: boolean;
    userId?: string;
    role?: string;
    siteId?: string;
    channels?: Set<string>;
    authTimeoutTimer?: NodeJS.Timeout;
}
export declare class ConnectionManager {
    private clients;
    private heartbeatInterval?;
    constructor();
    /**
     * Enregistre une nouvelle connexion WebSocket
     */
    handleConnection(socket: ExtWebSocket, jwtVerifyFn: (token: string) => any): void;
    /**
     * Diffusion d'un événement Redis à tous les clients abonnés au canal
     */
    broadcastEvent(event: {
        type: string;
        channel: string;
        payload: unknown;
    }): void;
    /**
     * Heartbeat applicatif (ping toutes les 25 secondes)
     */
    private startHeartbeat;
    private removeSocket;
    getConnectedCount(): number;
}
//# sourceMappingURL=connection-manager.d.ts.map