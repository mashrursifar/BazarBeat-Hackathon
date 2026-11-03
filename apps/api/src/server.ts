import { app } from "./app.js";
import { env } from "./config/env.js";
import { connectDatabase } from "./shared/db.js";
import { logger } from "./shared/logger.js";

app.listen(env.PORT, () => logger.info({ port: env.PORT }, "BazarBeat API listening"));

void connectDatabase().catch((error: unknown) => {
  logger.warn({ err: error }, "Database connection unavailable; health endpoint will report disconnected");
});
