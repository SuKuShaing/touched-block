import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateMeDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  username?: string;

  /** ISO 3166-1 alfa-2 (se acepta en minúsculas). */
  @IsOptional()
  @IsString()
  @MaxLength(8)
  country?: string;
}

export class CheckUsernameQuery {
  @IsString()
  @MaxLength(40)
  u: string;
}

export class SearchUsersQuery {
  @IsString()
  @MaxLength(40)
  q: string;
}

/** Datos del usuario con sesión (GET /me y respuestas de login). */
export interface MeDto {
  id: string;
  username: string;
  country: string | null;
  /** Última vez que cambió de país a mano (null = nunca; el primer cambio es libre). */
  countryChangedAt: string | null;
  /** Desde cuándo puede volver a cambiar de país (null = ya puede). */
  nextCountryChangeAt: string | null;
  invitedBy: { id: string; username: string } | null;
  invitedCount: number;
  /** Corazones con que juega: 5 + invitados, máximo 8. */
  maxLives: number;
  followingCount: number;
  followersCount: number;
  createdAt: string;
}

export interface PublicUserDto {
  id: string;
  username: string;
  country: string | null;
}
