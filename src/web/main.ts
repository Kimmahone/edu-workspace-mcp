import { webConfig } from "./config.js";
import { createWebServer } from "./server.js";
const config = webConfig();
const { server, store } = await createWebServer(config);
server.listen(config.port, config.hosted ? "0.0.0.0" : "127.0.0.1", () => console.log(`Workspace Lab: ${config.origin} (${config.hosted ? "배포" : "로컬"})`));
for (const signal of ["SIGTERM", "SIGINT"] as const) process.once(signal, () => { server.close(() => { void store.close().then(() => process.exit(0)); }); setTimeout(() => process.exit(1), 10000).unref(); });
