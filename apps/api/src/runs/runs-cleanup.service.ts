import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { AppConfig } from '../config/app-config';
import { RunsService } from './runs.service';

/** Limpieza periódica (CLEANUP_INTERVAL_MS; 0 la desactiva). */
@Injectable()
export class RunsCleanupService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly log = new Logger('Limpieza');
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly runs: RunsService,
    private readonly config: AppConfig,
  ) {}

  onApplicationBootstrap() {
    const every = this.config.cleanupIntervalMs;
    if (every <= 0) return;
    this.timer = setInterval(() => void this.run(), every);
    this.timer.unref();
  }

  onApplicationShutdown() {
    if (this.timer) clearInterval(this.timer);
  }

  async run() {
    try {
      const r = await this.runs.cleanup();
      if (r.runs || r.refreshTokens) this.log.log(`Borradas ${r.runs} partidas y ${r.refreshTokens} sesiones vencidas`);
    } catch (e) {
      this.log.error(`Falló la limpieza: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
}
