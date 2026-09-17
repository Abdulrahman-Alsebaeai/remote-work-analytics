import { UserRole, UserStatus } from '@prisma/client';
import { IsEmail, IsEnum, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
export class CreateUserDto {
  @IsEmail() email!: string;
  @IsString() @MinLength(12) password!: string;
  @IsString() @MinLength(2) @MaxLength(120) displayName!: string;
  @IsEnum(UserRole) role!: UserRole;
  @IsOptional() @IsUUID() departmentId?: string;
  @IsOptional() @IsUUID() teamId?: string;
}
export class UpdateUserDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(120) displayName?: string;
  @IsOptional() @IsEnum(UserRole) role?: UserRole;
  @IsOptional() @IsEnum(UserStatus) status?: UserStatus;
  @IsOptional() @IsUUID() departmentId?: string;
  @IsOptional() @IsUUID() teamId?: string;
}
