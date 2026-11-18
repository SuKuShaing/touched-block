import { IsOptional, IsString, Length, MaxLength } from 'class-validator';

export class GoogleLoginDto {
  @IsString()
  @Length(10, 8192)
  idToken: string;

  /** ISO-2 sacado de la región del navegador (opcional). Si no es un país válido se ignora. */
  @IsOptional()
  @IsString()
  @MaxLength(8)
  country?: string;
}

export class AppleLoginDto {
  @IsString()
  @Length(10, 8192)
  identityToken: string;

  /**
   * Código de autorización de un solo uso (vence en 5 min). La API lo canjea por el refresh token
   * de Apple y lo guarda cifrado para revocarlo al eliminar la cuenta. Opcional: sin él, el login
   * funciona igual pero no habrá token que revocar.
   */
  @IsOptional()
  @IsString()
  @Length(1, 1024)
  authorizationCode?: string;

  /** Nombre completo (Apple solo lo entrega la primera vez). */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  fullName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  country?: string;
}

/** Cuerpo de las notificaciones servidor a servidor de Sign in with Apple. */
export class AppleNotificationDto {
  @IsString()
  @Length(10, 16384)
  payload: string;
}

export class RefreshDto {
  @IsString()
  @Length(10, 200)
  refreshToken: string;
}
