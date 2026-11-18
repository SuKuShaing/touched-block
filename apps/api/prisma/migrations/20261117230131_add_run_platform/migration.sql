-- AlterTable
-- Solo agrega una columna opcional (no toca datos): desde dónde se jugó cada partida
-- ("app_android" | "app_ios" | "web_mobile" | "web_desktop"). Las partidas anteriores quedan en NULL.
-- Sin índice: solo se usa en consultas de estadística a mano.
ALTER TABLE "Run" ADD COLUMN     "platform" VARCHAR(16);
