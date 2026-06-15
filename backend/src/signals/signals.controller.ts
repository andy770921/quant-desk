import { Controller, Get, NotFoundException, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { CurrentSignal } from '@repo/shared';
import { MarketDataService } from '../market-data/market-data.service';
import { StrategiesService } from '../strategies/strategies.service';
import { SignalsService } from './signals.service';

@ApiTags('signals')
@Controller('api/signals')
export class SignalsController {
  constructor(
    private readonly signals: SignalsService,
    private readonly marketData: MarketDataService,
    private readonly strategies: StrategiesService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Live current buy/sell signal (target allocation) for every strategy' })
  getAll(): CurrentSignal[] {
    return this.signals.getAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Live current signal for one strategy' })
  getOne(@Param('id') id: string): CurrentSignal {
    const sig = this.signals.getById(id);
    if (!sig) throw new NotFoundException(`Unknown strategy: ${id}`);
    return sig;
  }

  @Post('refresh')
  @ApiOperation({
    summary: 'Pull the latest prices, re-evaluate signals, and report any changes',
    description:
      'Fetches the latest bars from Yahoo, rebuilds the data, and re-evaluates every strategy. ' +
      'interval=1d for end-of-day; 1h/1m (with a short range like 1d) for intraday.',
  })
  @ApiQuery({ name: 'interval', required: false, enum: ['1d', '1h', '1m', '5m'] })
  @ApiQuery({ name: 'range', required: false, example: '5d' })
  async refresh(@Query('interval') interval?: string, @Query('range') range?: string) {
    const ivl = (interval as '1d' | '1h' | '1m' | '5m') ?? '1d';
    const rng = range ?? (ivl === '1d' ? '5d' : '1d');
    const { updated, asOf } = await this.marketData.refreshFromLive(rng, ivl);
    this.strategies.clearProfileCache();
    const changes = this.signals.detectChanges();
    return { asOf, updated, changedCount: changes.length, changes };
  }
}
