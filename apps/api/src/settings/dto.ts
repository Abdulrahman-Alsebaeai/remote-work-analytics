import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

export const supportedFonts = ['cairo', 'almarai', 'droid-kufi', 'noto-kufi', 'readex-pro'] as const;
export type SupportedFont = typeof supportedFonts[number];
export const supportedTypographyScales = ['compact', 'standard', 'comfortable', 'large'] as const;
export type SupportedTypographyScale = typeof supportedTypographyScales[number];

export class UpdateSettingsDto {
  @IsOptional()
  @IsIn(supportedFonts)
  fontKey?: SupportedFont;

  @IsOptional()
  @IsIn(supportedTypographyScales)
  typographyScale?: SupportedTypographyScale;

  @IsOptional()
  @IsInt()
  @Min(10)
  @Max(3600)
  screenshotIntervalSeconds?: number;
}
