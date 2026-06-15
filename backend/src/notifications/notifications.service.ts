import { Injectable, Logger } from '@nestjs/common';

/**
 * FUTURE WORK — trade alerting.
 *
 * Roadmap (requirement #6): once a user logs in and subscribes to a strategy,
 * every time that strategy generates a trade signal we notify them by email
 * and/or LINE. This service defines the channel abstraction and a safe in-memory
 * subscription store so the API shape is stable; the real Email (e.g. SES /
 * Resend) and LINE Messaging API integrations are wired later behind env-based
 * credentials. Nothing here sends real messages yet — it only logs.
 */

export type NotificationChannel = 'email' | 'line';

export interface AlertSubscription {
  id: string;
  /** Authenticated user id (placeholder until auth is added). */
  userId: string;
  strategyId: string;
  channels: NotificationChannel[];
  /** Email address or LINE user id, depending on channel. */
  destination: string;
  createdAt: string;
}

export interface TradeAlert {
  strategyId: string;
  date: string;
  action: string;
  detail: string;
}

interface ChannelSender {
  channel: NotificationChannel;
  send(destination: string, message: string): Promise<void>;
}

/** Placeholder senders — log only. Replace with SES/Resend + LINE Messaging API. */
class LoggingSender implements ChannelSender {
  constructor(
    public readonly channel: NotificationChannel,
    private readonly logger: Logger,
  ) {}
  async send(destination: string, message: string): Promise<void> {
    this.logger.log(`[${this.channel}] → ${destination}: ${message}`);
  }
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly subscriptions = new Map<string, AlertSubscription>();
  private readonly senders: Record<NotificationChannel, ChannelSender> = {
    email: new LoggingSender('email', this.logger),
    line: new LoggingSender('line', this.logger),
  };

  subscribe(input: Omit<AlertSubscription, 'id' | 'createdAt'>): AlertSubscription {
    const id = `sub_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const sub: AlertSubscription = { ...input, id, createdAt: new Date().toISOString() };
    this.subscriptions.set(id, sub);
    this.logger.log(
      `New subscription ${id} for strategy ${sub.strategyId} via ${sub.channels.join(', ')}`,
    );
    return sub;
  }

  listForUser(userId: string): AlertSubscription[] {
    return [...this.subscriptions.values()].filter((s) => s.userId === userId);
  }

  unsubscribe(id: string): boolean {
    return this.subscriptions.delete(id);
  }

  /** Called by the (future) signal scheduler whenever a subscribed strategy trades. */
  async dispatch(alert: TradeAlert): Promise<void> {
    const targets = [...this.subscriptions.values()].filter(
      (s) => s.strategyId === alert.strategyId,
    );
    const message = `策略「${alert.strategyId}」於 ${alert.date} ${alert.action}：${alert.detail}`;
    await Promise.all(
      targets.flatMap((sub) =>
        sub.channels.map((ch) => this.senders[ch].send(sub.destination, message)),
      ),
    );
  }
}
