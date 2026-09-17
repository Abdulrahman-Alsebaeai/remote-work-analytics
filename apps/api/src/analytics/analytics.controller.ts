import { Controller, Get, Query, Req, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Response } from 'express';
import { TaskActor } from '../tasks/tasks.service';
import { AnalyticsService } from './analytics.service';
import { AnalyticsRangeDto, ReportQueryDto } from './dto';
import { ReportsService } from './reports.service';

@Controller() @UseGuards(AuthGuard('jwt'))
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService, private readonly reports: ReportsService) {}
  @Get('analytics/dashboard') dashboard(@Query() query: AnalyticsRangeDto, @Req() req: { user: TaskActor }) { return this.analytics.dashboard(query, req.user); }
  @Get('reports/export') async report(@Query() query: ReportQueryDto, @Req() req: { user: TaskActor }, @Res() response: Response) { const report = await this.reports.export(query, req.user); response.set({ 'content-type': report.contentType, 'content-disposition': `attachment; filename="${report.filename}"`, 'content-length': report.bytes.length, 'cache-control': 'private, no-store', 'x-content-type-options': 'nosniff' }); response.send(report.bytes); }
}
