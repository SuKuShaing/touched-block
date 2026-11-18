-- AlterTable
-- Solo agrega una columna opcional (no toca datos): el refresh token de Sign in with Apple, cifrado,
-- para revocarlo al eliminar la cuenta (guía 5.1.1(v) de Apple). Las identidades existentes quedan en NULL.
ALTER TABLE "AuthIdentity" ADD COLUMN     "providerRefreshToken" TEXT;
