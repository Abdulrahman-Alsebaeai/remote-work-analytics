import { AgentEventType } from '@prisma/client';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsDateString, IsEnum, IsObject, IsOptional, IsUUID, ValidateNested } from 'class-validator';
export class AgentEventDto {
  @IsUUID() id!: string;
  @IsUUID() sessionId!: string;
  @IsEnum(AgentEventType) type!: AgentEventType;
  @IsDateString() occurredAt!: string;
  @IsOptional() @IsObject() payload?: Record<string, unknown>;
}
export class SyncAgentEventsDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(100) @ValidateNested({ each: true }) @Type(() => AgentEventDto)
  events!: AgentEventDto[];
}
