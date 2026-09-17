import { IsDateString, IsIn, IsOptional, IsUUID } from 'class-validator';

export class AnalyticsRangeDto {
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
  @IsOptional() @IsUUID() employeeId?: string;
}

export class ReportQueryDto extends AnalyticsRangeDto {
  @IsIn(['csv', 'xlsx', 'pdf']) format!: 'csv' | 'xlsx' | 'pdf';
}
