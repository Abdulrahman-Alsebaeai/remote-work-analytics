import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import XlsxPopulate from 'xlsx-populate';
import { AuditService } from '../audit/audit.service';
import { TaskActor } from '../tasks/tasks.service';
import { AnalyticsService } from './analytics.service';
import { ReportQueryDto } from './dto';

interface ReportFile { bytes: Buffer; contentType: string; filename: string }

@Injectable()
export class ReportsService {
  constructor(private readonly analytics: AnalyticsService, private readonly audit: AuditService) {}

  async export(query: ReportQueryDto, actor: TaskActor): Promise<ReportFile> {
    const data = await this.analytics.dashboard(query, actor);
    const result = query.format === 'csv' ? this.csv(data) : query.format === 'xlsx' ? await this.xlsx(data) : await this.pdf(data);
    await this.audit.record({ organizationId: actor.organizationId, actorId: actor.id, action: 'REPORT_EXPORTED', targetType: 'ProductivityReport', result: 'SUCCESS', metadata: { format: query.format, from: data.range.from, to: data.range.to } });
    return { ...result, filename: `productivity-${data.range.from}-${data.range.to}.${query.format}` };
  }

  private csv(data: Awaited<ReturnType<AnalyticsService['dashboard']>>) {
    const escape = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;
    const lines = [['Employee', 'Productivity Score', 'Focus Score', 'Tracked Seconds', 'Active Seconds', 'Idle Seconds'].map(escape).join(',')];
    for (const row of data.ranking) lines.push([row.displayName, row.productivityScore, row.focusScore, row.trackedSeconds, row.activeSeconds, row.idleSeconds].map(escape).join(','));
    return { bytes: Buffer.from(`\uFEFF${lines.join('\r\n')}`, 'utf8'), contentType: 'text/csv; charset=utf-8' };
  }

  private async xlsx(data: Awaited<ReturnType<AnalyticsService['dashboard']>>) {
    const workbook = await XlsxPopulate.fromBlankAsync(); const sheet = workbook.sheet(0).name('Productivity');
    const rows: Array<Array<string | number>> = [['Employee', 'Productivity Score', 'Focus Score', 'Tracked Seconds', 'Active Seconds', 'Idle Seconds'], ...data.ranking.map(row => [row.displayName, row.productivityScore, row.focusScore, row.trackedSeconds, row.activeSeconds, row.idleSeconds])];
    sheet.cell('A1').value(rows); sheet.range('A1:F1').style({ bold: true, fill: '3157D5', fontColor: 'FFFFFF' }); sheet.freezePanes(1, 1); sheet.column('A').width(30); for (const column of ['B', 'C', 'D', 'E', 'F']) sheet.column(column).width(18);
    return { bytes: Buffer.from(await workbook.outputAsync()), contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' };
  }

  private pdf(data: Awaited<ReturnType<AnalyticsService['dashboard']>>): Promise<Omit<ReportFile, 'filename'>> {
    return new Promise((resolve, reject) => {
      const document = new PDFDocument({ margin: 42, size: 'A4', info: { Title: 'Productivity Report', Author: 'Remote Work Analytics' } });
      const chunks: Buffer[] = []; document.on('data', chunk => chunks.push(Buffer.from(chunk))); document.on('error', reject); document.on('end', () => resolve({ bytes: Buffer.concat(chunks), contentType: 'application/pdf' }));
      document.registerFont('Report', require.resolve('@fontsource/noto-sans-arabic/files/noto-sans-arabic-arabic-400-normal.woff')).font('Report');
      document.fontSize(20).text('Productivity Report'); document.fontSize(10).text(`${data.range.from} — ${data.range.to} (UTC)`); document.moveDown();
      document.fontSize(12).text(`Overall productivity: ${data.summary.productivityScore}%    Focus: ${data.summary.focusScore}%`); document.text(`Active: ${data.summary.activeSeconds}s    Idle: ${data.summary.idleSeconds}s`); document.moveDown();
      for (const row of data.ranking) { if (document.y > 740) document.addPage(); document.fontSize(11).text(row.displayName, { continued: true }).text(`   Productivity ${row.productivityScore}%   Focus ${row.focusScore}%`, { align: 'right' }); }
      document.end();
    });
  }
}
