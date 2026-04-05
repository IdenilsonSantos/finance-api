import { Controller, Get, Patch, Delete, Body, Param, Query, UseGuards, ParseIntPipe, DefaultValuePipe, ParseBoolPipe } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { GetUser } from '../../auth/decorators/get-user.decorator';
import { NotificationsService } from '../services/notifications.service';
import { UpdateNotificationPrefsDto } from '../dto/notification-prefs.dto';

@ApiTags('Notifications')
@ApiBearerAuth('access-token')
@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'List notifications for current user' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({ name: 'read', required: false, type: Boolean })
  @ApiResponse({ status: 200, description: 'Paginated notifications returned' })
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
  @ApiOperation({ summary: 'Get unread notification count' })
  @ApiResponse({ status: 200, description: 'Unread count returned', schema: { properties: { count: { type: 'number' } } } })
  getUnreadCount(@GetUser('id') userId: string) {
    return this.notificationsService.getUnreadCount(userId).then((count) => ({ count }));
  }

  @Patch('read-all')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  @ApiResponse({ status: 200, description: 'All marked as read' })
  markAllAsRead(@GetUser('id') userId: string) {
    return this.notificationsService.markAllAsRead(userId);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark a notification as read' })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiResponse({ status: 200, description: 'Notification marked as read' })
  markAsRead(@GetUser('id') userId: string, @Param('id') id: string) {
    return this.notificationsService.markAsRead(userId, id);
  }

  @Delete('read')
  @ApiOperation({ summary: 'Delete all read notifications' })
  @ApiResponse({ status: 200, description: 'Read notifications deleted' })
  deleteRead(@GetUser('id') userId: string) {
    return this.notificationsService.deleteRead(userId);
  }

  @Delete('all')
  @ApiOperation({ summary: 'Delete all notifications' })
  @ApiResponse({ status: 200, description: 'All notifications deleted' })
  deleteAll(@GetUser('id') userId: string) {
    return this.notificationsService.deleteAll(userId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a notification by ID' })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiResponse({ status: 200, description: 'Notification deleted' })
  deleteOne(@GetUser('id') userId: string, @Param('id') id: string) {
    return this.notificationsService.deleteOne(userId, id);
  }

  @Patch(':id/unread')
  @ApiOperation({ summary: 'Mark a notification as unread' })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiResponse({ status: 200, description: 'Notification marked as unread' })
  markAsUnread(@GetUser('id') userId: string, @Param('id') id: string) {
    return this.notificationsService.markAsUnread(userId, id);
  }

  @Get('prefs')
  @ApiOperation({ summary: 'Get notification preferences' })
  @ApiResponse({ status: 200, description: 'Preferences returned' })
  getPrefs(@GetUser('id') userId: string) {
    return this.notificationsService.getPrefs(userId);
  }

  @Patch('prefs')
  @ApiOperation({ summary: 'Update notification preferences' })
  @ApiResponse({ status: 200, description: 'Preferences updated' })
  updatePrefs(
    @GetUser('id') userId: string,
    @Body() dto: UpdateNotificationPrefsDto,
  ) {
    return this.notificationsService.updatePrefs(userId, dto);
  }
}
