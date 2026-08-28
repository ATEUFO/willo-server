import { Bonjour } from "bonjour-service";
import os from "node:os";
const bonjour = new Bonjour();
export function publishServerPresence() {
    bonjour.publish({
        name: `willo-server-${os.hostname()}`,
        type: "willo-server",
        port: 5030,
        txt: {
            siteName: process.env.SITE_NAME ?? "willo",
            apiVersion: "1.0",
            caFingerprint: process.env.CA_FINGERPRINT,
        },
    });
}
//# sourceMappingURL=publish.js.map