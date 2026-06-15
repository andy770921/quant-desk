import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { BacktestMode, BacktestResult } from '@repo/shared';
import { BacktestService } from './backtest.service';

@ApiTags('backtest')
@Controller('api/backtest')
export class BacktestController {
  constructor(private readonly backtest: BacktestService) {}

  @Get()
  @ApiOperation({
    summary: 'Run a backtest for a strategy with the chosen contribution mode',
    description:
      'Supports two modes: "dca" (fixed monthly contribution) and "lumpsum" (single up-front investment). ' +
      'Returns the strategy equity curve plus QQQ and VOO benchmarks on the same schedule.',
  })
  @ApiQuery({ name: 'strategyId', example: 'nasdaq-3x-20dma' })
  @ApiQuery({ name: 'mode', enum: ['dca', 'lumpsum'], required: false })
  @ApiQuery({ name: 'start', example: '1990-01', description: 'Inclusive start month YYYY-MM' })
  @ApiQuery({
    name: 'monthly',
    required: false,
    example: 2000,
    description: 'Monthly amount (dca)',
  })
  @ApiQuery({ name: 'lump', required: false, example: 100000, description: 'Lump sum (lumpsum)' })
  run(
    @Query('strategyId') strategyId: string,
    @Query('start') start: string,
    @Query('mode') mode?: string,
    @Query('monthly') monthly?: string,
    @Query('lump') lump?: string,
  ): BacktestResult {
    return this.backtest.run({
      strategyId,
      mode: (mode as BacktestMode) ?? 'dca',
      start: start ?? '1990-01',
      monthlyAmount: monthly ? Number(monthly) : undefined,
      lumpSum: lump ? Number(lump) : undefined,
    });
  }
}
