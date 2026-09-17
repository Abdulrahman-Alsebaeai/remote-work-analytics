import { TaskPriority, TaskStatus } from '@prisma/client';
import { IsDateString, IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength } from 'class-validator';
export class CreateTaskDto {
  @IsString() @MinLength(2) @MaxLength(180) title!: string;
  @IsOptional() @IsString() @MaxLength(5000) description?: string;
  @IsEnum(TaskPriority) priority!: TaskPriority;
  @IsOptional() @IsDateString() deadline?: string;
  @IsUUID() assigneeId!: string;
}
export class UpdateTaskDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(180) title?: string;
  @IsOptional() @IsString() @MaxLength(5000) description?: string;
  @IsOptional() @IsEnum(TaskPriority) priority?: TaskPriority;
  @IsOptional() @IsDateString() deadline?: string;
  @IsOptional() @IsUUID() assigneeId?: string;
  @IsOptional() @IsEnum(TaskStatus) status?: TaskStatus;
  @IsOptional() @IsInt() @Min(0) @Max(100) progress?: number;
}
export class UpdateProgressDto {
  @IsInt() @Min(0) @Max(100) progress!: number;
  @IsOptional() @IsEnum(TaskStatus) status?: TaskStatus;
}
export class AddTaskNoteDto { @IsString() @MinLength(1) @MaxLength(2000) content!: string; }
