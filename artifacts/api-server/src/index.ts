import { loadEnv, createLogger } from "@workspace/config";

const env = loadEnv();
const logger = createLogger("api-server");

import app from "./app";
import { startConsumers } from "./extraction-consumer.js";
import { logExternalSignalsConfig } from "./config/external-signals.js";

const port = env.PORT || Number(process.env["PORT"]) || 8080;

let server: ReturnType<typeof app.listen> | null = null;
let shuttingDown = false;

function gracefulShutdown(reason: string, error: unknown): void {
  if (shuttingDown) return;
  shuttingDown = true;

  logger.fatal({ err: error, reason }, `Fatal: ${reason} — initiating graceful shutdown`);

  const forceExitTimeout = setTimeout(() => {
    logger.error("Graceful shutdown timed out after 15s — forcing exit");
    process.exit(1);
  }, 15_000);
  forceExitTimeout.unref();

  if (server) {
    server.close(() => {
      logger.info("HTTP server closed");
      import("@workspace/db").then(({ pool }) => {
        pool.end().then(() => {
          logger.info("DB pool closed");
          process.exit(1);
        }).catch(() => process.exit(1));
      }).catch(() => process.exit(1));
    });
  } else {
    process.exit(1);
  }
}

process.on("unhandledRejection", (reason) => {
  gracefulShutdown("Unhandled promise rejection", reason);
});

process.on("uncaughtException", (error) => {
  gracefulShutdown("Uncaught exception", error);
});

startConsumers();

server = app.listen(port, () => {
  logger.info({ port }, `Server listening on port ${port}`);
  logExternalSignalsConfig();
});
