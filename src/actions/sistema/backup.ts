"use server";

import { mkdir, realpath, writeFile } from "node:fs/promises";
import path from "node:path";
import { getTableColumns, getTableName, is } from "drizzle-orm";
import { getTableConfig, PgTable } from "drizzle-orm/pg-core";
import { db, schema } from "@/db";
import { secureAction } from "@/lib/secure-action";

function sqlLiteral(v: unknown): string {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "number" || typeof v === "bigint") return String(v);
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  if (v instanceof Date) return `'${v.toISOString()}'`;
  if (typeof v === "object") return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
  return `'${String(v).replace(/'/g, "''")}'`;
}

/** Genera respaldo JSON estructurado + script SQL (INSERTs) de todas las tablas del esquema. */
export const crearRespaldo = secureAction(
  { permission: "sistema:backup", module: "sistema", action: "backup" },
  async () => {
    const configuredDir = path.resolve(process.env.BACKUP_DIR ?? "./backups");
    await mkdir(configuredDir, { recursive: true, mode: 0o700 });
    const dir = await realpath(configuredDir);
    // Resolver enlaces evita publicar respaldos que contienen credenciales y sesiones.
    const publicDir = await realpath(path.resolve("public"));
    const relativeToPublic = path.relative(publicDir, dir);
    if (!relativeToPublic || (!relativeToPublic.startsWith(`..${path.sep}`) && relativeToPublic !== ".." && !path.isAbsolute(relativeToPublic))) {
      throw new Error("El directorio de respaldos no puede estar dentro de public.");
    }
    const tables = (Object.values(schema) as unknown[]).filter((t): t is PgTable => is(t, PgTable));
    const ordered: PgTable[] = [];
    const visited = new Set<PgTable>();
    const visiting = new Set<PgTable>();
    function visit(table: PgTable) {
      if (visited.has(table)) return;
      if (visiting.has(table)) throw new Error("El esquema contiene un ciclo de claves foráneas.");
      visiting.add(table);
      for (const foreignKey of getTableConfig(table).foreignKeys) {
        const dependency = foreignKey.reference().foreignTable;
        visit(dependency);
      }
      visiting.delete(table);
      visited.add(table);
      ordered.push(table);
    }
    tables.forEach(visit);
    const { json, sqlOut } = await db.transaction(async (tx) => {
      const json: Record<string, unknown[]> = {};
      let sqlOut = `-- Respaldo Almacenes AGBC ${new Date().toISOString()}\nBEGIN;\nSET LOCAL standard_conforming_strings = on;\n`;

      for (const table of ordered) {
        const name = getTableName(table);
        const rows = (await tx.select().from(table)) as Record<string, unknown>[];
        json[name] = rows;
        const cols = Object.entries(getTableColumns(table));
        for (const row of rows) {
          const names = cols.map(([, c]) => `"${c.name}"`).join(", ");
          const vals = cols.map(([key]) => sqlLiteral(row[key])).join(", ");
          sqlOut += `INSERT INTO "${name}" (${names}) VALUES (${vals});\n`;
        }
      }
      sqlOut += "COMMIT;\n";
      return { json, sqlOut };
    }, { isolationLevel: "repeatable read", accessMode: "read only" });

    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const jsonFile = path.join(dir, `backup-${stamp}.json`);
    const sqlFile = path.join(dir, `backup-${stamp}.sql`);
    await writeFile(jsonFile, JSON.stringify({ generatedAt: new Date(), tables: json }, null, 2), { mode: 0o600, flag: "wx" });
    await writeFile(sqlFile, sqlOut, { mode: 0o600, flag: "wx" });
    return { jsonFile, sqlFile, tables: Object.keys(json).length };
  },
);
