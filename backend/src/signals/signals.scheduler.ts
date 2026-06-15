import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MarketDataService } from '../market-data/market-data.service';
import { StrategiesService } from '../strategies/strategies.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SignalsService } from './signals.service';

/**
 * Periodically refreshes live data, re-evaluates every strategy, and dispatches
 * a notification whenever a strategy's target allocation changes (a buy/sell
 * signal). Opt-in and dependency-free (plain setInterval) so the default dev/
 * test run does not hammer the data API.
 *
 * Enable + tune via env:
 *   SIGNALS_LIVE=true            turn the scheduler on
 *   SIGNALS_INTERVAL_MS=3600000  how often to poll (default 1h; 60000 = 1 min)
 *   SIGNALS_DATA_INTERVAL=1d     bar interval: 1d (EOD) | 1h | 1m | 5m
 *   SIGNALS_DATA_RANGE=5d        how much recent data to pull each poll
 */
@Injectable()
export class SignalScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SignalScheduler.name);
  private timer?: ReturnType<typeof setInterval>;
  private running = false;

  constructor(
    private readonly config: ConfigService,
    private readonly marketData: MarketDataService,
    private readonly strategies: StrategiesService,
    private readonly signals: SignalsService,
    private readonly notifications: NotificationsService,
  ) {}

  onModuleInit() {
    if (this.config.get<string>('SIGNALS_LIVE') !== 'true') {
      this.logger.log('Live signal scheduler disabled (set SIGNALS_LIVE=true to enable).');
      return;
    }
    const intervalMs = Number(this.config.get('SIGNALS_INTERVAL_MS') ?? 3_600_000);
    this.logger.log(`Live signal scheduler enabled, polling every ${intervalMs}ms.`);
    // Seed the baseline now, then poll.
    void this.tick();
    this.timer = setInterval(() => void this.tick(), intervalMs);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async tick() {
    if (this.running) return; // skip overlapping polls
    this.running = true;
    try {
      const interval = (this.config.get<string>('SIGNALS_DATA_INTERVAL') ?? '1d') as
        | '1d'
        | '1h'
        | '1m'
        | '5m';
      const range =
        this.config.get<string>('SIGNALS_DATA_RANGE') ?? (interval === '1d' ? '5d' : '1d');
      await this.marketData.refreshFromLive(range, interval);
      this.strategies.clearProfileCache();
      const changes = this.signals.detectChanges();
      for (const c of changes) {
        await this.notifications.dispatch({
          strategyId: c.strategyId,
          date: c.asOf,
          action: '訊號變更',
          detail: `${c.from} → ${c.to}`,
        });
      }
      if (changes.length) this.logger.log(`Dispatched ${changes.length} signal change(s).`);
    } catch (err) {
      this.logger.warn(`Signal tick failed: ${(err as Error).message}`);
    } finally {
      this.running = false;
    }
  }
}
