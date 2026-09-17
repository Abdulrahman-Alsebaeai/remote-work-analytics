import { IsDateString } from 'class-validator';
export class CreateAiAnalysisDto { @IsDateString() from!: string; @IsDateString() to!: string; }
