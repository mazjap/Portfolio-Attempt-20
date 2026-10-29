import 'dotenv/config';
import { allowedOrigins, createApp } from './app.js';
import { mediaDir } from './lib/files.js';
import { flushLogs, logger } from './lib/logger.js';
import { checkConfiguration, ensureStorage } from './lib/bootstrap.js';

const PORT = process.env.PORT ?? 3001;
const app = createApp();

checkConfiguration();

ensureStorage()
  .catch(err => logger.error(`Storage setup failed: ${err}`))
  .finally(() => {
    const server = app.listen(PORT, () => {
      logger.info(`Server started on port ${PORT}`);
      logger.info(`Allowed origins: ${allowedOrigins.join(', ')}`);
      logger.info(`Media dir: ${mediaDir}`);
    });

    // Stop accepting connections, let in-flight requests (and the writes they're waiting on)
    // finish, flush the log, then exit. Give up after 10 seconds.
    let shuttingDown = false;
    const shutdown = (signal: string) => {
      if (shuttingDown) return;
      shuttingDown = true;
      logger.info(`${signal} received; shutting down`);
      setTimeout(() => {
        logger.error('Shutdown timed out; exiting with requests still open');
        process.exit(1);
      }, 10_000).unref();
      server.close(async () => {
        await flushLogs();
        process.exit(0);
      });
      server.closeIdleConnections();
    };
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  });
