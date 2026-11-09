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

export class RefreshDto {
  @IsString()
  @Length(10, 200)
  refreshToken: string;
}
