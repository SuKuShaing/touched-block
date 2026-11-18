import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export const REPORT_REASONS = ['offensive_name', 'impersonation', 'other'] as const;
export type ReportReasonName = (typeof REPORT_REASONS)[number];

/** Máximo del texto opcional de un reporte. */
export const REPORT_DETAILS_MAX = 200;

export class ReportDto {
  @IsIn(REPORT_REASONS)
  reason: ReportReasonName;

  @IsOptional()
  @IsString()
  @MaxLength(REPORT_DETAILS_MAX)
  details?: string;
}

export const REPORT_STATUSES = ['pending', 'resolved', 'dismissed', 'all'] as const;

export class AdminReportsQuery {
  @IsOptional()
  @IsIn(REPORT_STATUSES)
  status?: (typeof REPORT_STATUSES)[number];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;
}

export class AdminResolveDto {
  @IsOptional()
  @IsIn(['resolved', 'dismissed'])
  status?: 'resolved' | 'dismissed';

  @IsOptional()
  @IsString()
  @MaxLength(200)
  resolution?: string;
}

export class AdminRenameDto {
  /** Nombre nuevo; sin él se asigna uno automático tipo "jugador1234". */
  @IsOptional()
  @IsString()
  @MaxLength(40)
  username?: string;
}
