import { Module } from '@nestjs/common';
import { MarketDataModule } from '../market-data/market-data.module';
import { StrategiesModule } from '../strategies/strategies.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { SignalsController } from './signals.controller';
import { SignalsService } from './signals.service';
import { SignalScheduler } from './signals.scheduler';

@Module({
  imports: [MarketDataModule, StrategiesModule, NotificationsModule],
  controllers: [SignalsController],
  providers: [SignalsService, SignalScheduler],
  exports: [SignalsService],
})
export class SignalsModule {}
