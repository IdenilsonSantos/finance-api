import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
  UseGuards,
  Inject,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { DRIZZLE } from '../../db/database.module';
import * as schema from '../../db/schema';

@Controller('category-rules')
@UseGuards(JwtAuthGuard)
export class CategoryRulesController {
  constructor(
    @Inject(DRIZZLE) private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  @Get()
  async findAll(): Promise<Record<string, { id: string; keyword: string }[]>> {
    const rows = await this.db.select().from(schema.categoryRule);

    const grouped: Record<string, { id: string; keyword: string }[]> = {};
    for (const row of rows) {
      if (!grouped[row.category]) grouped[row.category] = [];
      grouped[row.category].push({ id: row.id, keyword: row.keyword });
    }

    return grouped;
  }

  @Post()
  create(@Body() body: { category: string; keyword: string }) {
    return this.db
      .insert(schema.categoryRule)
      .values({ category: body.category, keyword: body.keyword })
      .returning()
      .then((rows) => rows[0]);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.db
      .delete(schema.categoryRule)
      .where(eq(schema.categoryRule.id, id));
  }
}
