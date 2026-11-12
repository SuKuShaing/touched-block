import type { TapInput } from '@tb/engine';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsIn, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { PERIODS, type Period } from '../leaderboards/periods';
import { RUN_MODES, type RunModeName } from '../stats/stats.service';
import { MAX_INPUTS } from './run-verification';

export class CreateRunDto {
  /** Ancho del campo en unidades lógicas (px de CSS). En los retos es el de la pantalla real. */
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(160)
  @Max(4096)
  fieldW: number;

  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(160)
  @Max(4096)
  fieldH: number;

  /** Modo de la partida (por defecto `normal`). */
  @IsOptional()
  @IsIn(RUN_MODES)
  mode?: RunModeName;

  /** Código del reto al que se une (solo `mode: 'duel'`; sin él se crea un reto nuevo). */
  @IsOptional()
  @IsString()
  @MaxLength(32)
  challenge?: string;

  /** Fecha local del jugador 'AAAA-MM-DD' (obligatoria con `mode: 'daily'`). */
  @IsOptional()
  @IsString()
  @MaxLength(10)
  date?: string;
}

export class FinishRunDto {
  /** Toques [tick, x, y] en orden; se validan con el motor. */
  @IsArray()
  @ArrayMaxSize(MAX_INPUTS)
  inputs: TapInput[];

  @IsInt()
  @Min(0)
  @Max(1_000_000)
  killed: number;

  @IsInt()
  @Min(0)
  @Max(1_000_000)
  missed: number;

  /** Obligatorio para partidas de invitado. */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  claimToken?: string;
}

export class ClaimRunDto {
  @IsString()
  @MaxLength(200)
  claimToken: string;
}

export class MyRunsQuery {
  @IsOptional()
  @IsIn(PERIODS)
  period?: Period;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
