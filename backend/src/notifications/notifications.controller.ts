import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { NotificationChannel, NotificationsService } from './notifications.service';

class SubscribeDto {
  userId: string;
  strategyId: string;
  channels: NotificationChannel[];
  destination: string;
}

@ApiTags('notifications')
@Controller('api/notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Post('subscribe')
  @ApiOperation({
    summary: '[未來功能] 訂閱策略交易提醒 (email / LINE)',
    description:
      'Future feature: subscribe a user to trade alerts for a strategy. Currently stores the ' +
      'subscription and logs alerts only; real email/LINE delivery is wired later.',
  })
  subscribe(@Body() dto: SubscribeDto) {
    return this.notifications.subscribe(dto);
  }
}
