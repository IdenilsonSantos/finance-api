import { Controller, Get, Patch, Delete, Body, Param, Query, UseGuards, ParseIntPipe, DefaultValuePipe, ParseBoolPipe } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { GetUser } from '../../auth/decorators/get-user.decorator';
import { NotificationsService } from '../services/notifications.service';
import { UpdateNotificationPrefsDto } from '../dto/notification-prefs.dto';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  getNotifications(
    @GetUser('id') userId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('read') read?: string,
  ) {
    const readFilter = read === undefined ? undefined : read === 'true';
    return this.notificationsService.getNotifications(userId, page, limit, readFilter);
  }

  @Get('unread-count')
  getUnreadCount(@GetUser('id') userId: string) {
    return this.notificationsService.getUnreadCount(userId).then((count) => ({ count }));
  }

  @Patch('read-all')
  markAllAsRead(@GetUser('id') userId: string) {
    return this.notificationsService.markAllAsRead(userId);
  }

  @Patch(':id/read')
  markAsRead(@GetUser('id') userId: string, @Param('id') id: string) {
    return this.notificationsService.markAsRead(userId, id);
  }

  @Delete('read')
  deleteRead(@GetUser('id') userId: string) {
    return this.notificationsService.deleteRead(userId);
  }

  @Delete('all')
  deleteAll(@GetUser('id') userId: string) {
    return this.notificationsService.deleteAll(userId);
  }

  @Delete(':id')
  deleteOne(@GetUser('id') userId: string, @Param('id') id: string) {
    return this.notificationsService.deleteOne(userId, id);
  }

  @Patch(':id/unread')
  markAsUnread(@GetUser('id') userId: string, @Param('id') id: string) {
    return this.notificationsService.markAsUnread(userId, id);
  }

  @Get('prefs')
  getPrefs(@GetUser('id') userId: string) {
    return this.notificationsService.getPrefs(userId);
  }

  @Patch('prefs')
  updatePrefs(
    @GetUser('id') userId: string,
    @Body() dto: UpdateNotificationPrefsDto,
  ) {
    return this.notificationsService.updatePrefs(userId, dto);
  }
}
