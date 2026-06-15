import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { MarketOverview, PriceSeries } from '@repo/shared';
import { MarketDataService } from './market-data.service';

@ApiTags('market')
@Controller('api/market')
export class MarketDataController {
  constructor(private readonly marketData: MarketDataService) {}

  @Get('overview')
  @ApiOperation({ summary: 'Snapshot of major US indices, gold and the 10Y yield' })
  getOverview(): MarketOverview {
    return this.marketData.getMarketOverview();
  }

  @Get('series/:symbol')
  @ApiOperation({ summary: 'Monthly close series for a display symbol (charting)' })
  getSeries(@Param('symbol') symbol: string): PriceSeries {
    try {
      return this.marketData.getPriceSeries(symbol.toUpperCase());
    } catch {
      throw new NotFoundException(`Unknown symbol: ${symbol}`);
    }
  }
}
