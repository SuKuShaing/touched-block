import 'reflect-metadata';
import { HttpException, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { CoreModule } from '../prisma/core.module';
import { PrismaService } from '../prisma/prisma.service';
import { UsersModule } from '../users/users.module';
import { UsersService } from '../users/users.service';
import { REPORT_REASON_LABELS, REPORT_RESPONSE_HOURS, findUserByUsername, forceRename, listReports, namesFailingFilter, resolvePendingFor, resolveReport } from './admin';
import { runTelegramCli } from './telegram-cli';

/**
 * Moderación desde la línea de comandos (lo mismo que /admin/*, sin ADMIN_TOKEN: quien entra al
 * contenedor ya tiene acceso a la base). Lo llaman scripts/moderation.mjs y
 * scripts/check-usernames.mjs con el código compilado en dist/. Ver docs/despliegue.md, "Moderación".
 */

@Module({ imports: [CoreModule, UsersModule] })
class ModerationCliModule {}

export const MODERATION_USAGE = `Uso: node scripts/moderation.mjs <comando> [opciones]

  reports [--all | --status=resolved|dismissed] [--limit=N]
      Lista los reportes (por defecto, los pendientes: primero los más antiguos).
  resolve <idReporte> [--dismiss] [--note="texto"]
      Marca un reporte como resuelto (o descartado, con --dismiss).
  resolve @usuario [--dismiss] [--note="texto"]
      Cierra todos los reportes pendientes contra ese usuario.
  rename <usuario> [nombre-nuevo] [--dry-run]
      Cambia su nombre (sin nombre nuevo: uno automático tipo jugador1234) y cierra sus reportes.
  delete <usuario> --yes [--dry-run]
      Elimina la cuenta (igual que "Eliminar cuenta") y cierra sus reportes.
  check-names [--rename] [--dry-run]
      Lista los nombres actuales que no pasan el filtro; con --rename les pone uno automático.
  telegram-test [--chat-id]
      Manda un aviso de prueba por Telegram (o, con --chat-id, muestra los chat ids que le escribieron al bot).
`;

interface Parsed {
  args: string[];
  flags: Map<string, string | true>;
}

function parse(argv: string[]): Parsed {
  const args: string[] = [];
  const flags = new Map<string, string | true>();
  for (const a of argv) {
    const m = /^--([a-z-]+)(?:=(.*))?$/.exec(a);
    if (m) flags.set(m[1], m[2] ?? true);
    else args.push(a);
  }
  return { args, flags };
}

const errText = (e: unknown) => {
  if (e instanceof HttpException) {
    const r = e.getResponse();
    if (r && typeof r === 'object' && typeof (r as { message?: unknown }).message === 'string') return (r as { message: string }).message;
  }
  return e instanceof Error ? e.message : String(e);
};

/** Ejecuta un comando. Devuelve el código de salida. */
export async function runModerationCli(argv: string[], log: (m: string) => void = console.log): Promise<number> {
  const { args, flags } = parse(argv);
  const cmd = args.shift();
  if (!cmd || cmd === 'help' || flags.has('help')) {
    log(MODERATION_USAGE);
    return cmd ? 0 : 1;
  }
  if (cmd === 'telegram-test') return runTelegramCli(argv, process.env, log);
  const dryRun = flags.has('dry-run');
  const app = await NestFactory.createApplicationContext(ModerationCliModule, { logger: ['error', 'warn'] });
  const prisma = app.get(PrismaService);
  try {
    switch (cmd) {
      case 'reports': {
        const statusFlag = flags.get('status');
        const status = flags.has('all') ? 'all' : typeof statusFlag === 'string' ? statusFlag : 'pending';
        if (!['pending', 'resolved', 'dismissed', 'all'].includes(status)) throw new Error(`Estado desconocido: ${status}`);
        const limit = Number(flags.get('limit')) || 100;
        const r = await listReports(prisma, { status: status as 'pending', limit });
        log(`Pendientes: ${r.pending} (${r.overdue} con más de ${REPORT_RESPONSE_HOURS} h).`);
        if (!r.reports.length) log('No hay reportes que mostrar.');
        for (const x of r.reports) {
          const now = x.reported ? `@${x.reported.username}` : '(cuenta eliminada)';
          const was = x.reported && x.reported.username === x.reportedUsername ? '' : ` (reportado como @${x.reportedUsername})`;
          log(
            `- ${x.id}  ${x.createdAt.slice(0, 16).replace('T', ' ')} UTC  hace ${x.ageHours} h  [${x.status}]\n` +
              `    ${now}${was} · ${REPORT_REASON_LABELS[x.reason] ?? x.reason} · por ${x.reporter ? '@' + x.reporter.username : '(cuenta eliminada)'}` +
              (x.details ? `\n    "${x.details}"` : '') +
              (x.resolution ? `\n    → ${x.resolution}` : ''),
          );
        }
        return 0;
      }
      case 'resolve': {
        const target = args[0];
        if (!target) throw new Error('Falta el id del reporte o @usuario.');
        const status = flags.has('dismiss') ? 'dismissed' : 'resolved';
        const note = typeof flags.get('note') === 'string' ? (flags.get('note') as string) : null;
        if (target.startsWith('@')) {
          const user = await findUserByUsername(prisma, target);
          const n = await resolvePendingFor(prisma, user.id, note ?? (status === 'dismissed' ? 'Revisado: sin infracción.' : 'Resuelto.'), status);
          log(`${n} reporte(s) pendiente(s) de @${user.username} marcado(s) como ${status === 'dismissed' ? 'descartados' : 'resueltos'}.`);
        } else {
          const r = await resolveReport(prisma, target, { status, resolution: note });
          log(`Reporte ${r.id} marcado como ${r.status}.`);
        }
        return 0;
      }
      case 'rename': {
        const [user, newName] = args;
        if (!user) throw new Error('Falta el usuario.');
        const r = await forceRename(prisma, user, newName, { dryRun });
        log(
          r.dryRun
            ? `(prueba) @${r.from} pasaría a llamarse @${r.to}.`
            : `@${r.from} ahora se llama @${r.to}. Reportes cerrados: ${r.resolvedReports}.`,
        );
        return 0;
      }
      case 'delete': {
        const name = args[0];
        if (!name) throw new Error('Falta el usuario.');
        const user = await findUserByUsername(prisma, name);
        if (dryRun || !flags.has('yes')) {
          log(`(prueba) Se eliminaría la cuenta @${user.username} (${user.id}). Agrega --yes para eliminarla de verdad.`);
          return dryRun ? 0 : 1;
        }
        const n = await resolvePendingFor(prisma, user.id, `Cuenta @${user.username} eliminada por moderación.`);
        await app.get(UsersService).deleteMe(user.id);
        log(`Cuenta @${user.username} eliminada. Reportes cerrados: ${n}.`);
        return 0;
      }
      case 'check-names': {
        const bad = await namesFailingFilter(prisma);
        if (!bad.length) {
          log('Todos los nombres actuales pasan el filtro.');
          return 0;
        }
        log(`${bad.length} nombre(s) no pasan el filtro:`);
        for (const b of bad) log(`- @${b.username}  ${b.problem}`);
        if (!flags.has('rename')) {
          log('\nNo se cambió nada. Para ponerles un nombre automático: --rename (prueba primero con --rename --dry-run).');
          return 0;
        }
        for (const b of bad) {
          const r = await forceRename(prisma, b.username, null, { dryRun });
          log(r.dryRun ? `(prueba) @${r.from} → @${r.to}` : `@${r.from} → @${r.to}`);
        }
        return 0;
      }
      default:
        log(`Comando desconocido: ${cmd}\n\n${MODERATION_USAGE}`);
        return 1;
    }
  } catch (e) {
    log(`Error: ${errText(e)}`);
    return 1;
  } finally {
    await app.close();
  }
}
