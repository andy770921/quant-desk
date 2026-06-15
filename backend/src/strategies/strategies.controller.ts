import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { StrategyDetail, StrategySummary } from '@repo/shared';
import { StrategiesService } from './strategies.service';

@ApiTags('strategies')
@Controller('api/strategies')
export class StrategiesController {
  constructor(private readonly strategies: StrategiesService) {}

  @Get()
  @ApiOperation({ summary: 'List all available quant strategies' })
  list(): StrategySummary[] {
    return this.strategies.getSummaries();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get full detail for one strategy' })
  detail(@Param('id') id: string): StrategyDetail {
    const detail = this.strategies.getDetail(id);
    if (!detail) throw new NotFoundException(`Unknown strategy: ${id}`);
    return detail;
  }
}
