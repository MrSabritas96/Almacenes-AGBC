"use server";

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { getTableColumns, getTableName, is } from "drizzle-orm";
import { PgTable } from "drizzle-orm/pg-core";
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
  async (_: void) => {
    const tables = (Object.values(schema) as unknown[]).filter((t): t is PgTable => is(t, PgTable));
    const json: Record<string, unknown[]> = {};
    let sqlOut = `-- Respaldo Almacenes AGBC ${new Date().toISOString()}\nBEGIN;\n`;

    for (const table of tables) {
      const name = getTableName(table);
      const rows = (await db.select().from(table)) as Record<string, unknown>[];
      json[name] = rows;
      const cols = Object.entries(getTableColumns(table));
      for (const row of rows) {
        const names = cols.map(([, c]) => `"${c.name}"`).join(", ");
        const vals = cols.map(([key]) => sqlLiteral(row[key])).join(", ");
        sqlOut += `INSERT INTO "${name}" (${names}) VALUES (${vals});\n`;
      }
    }
    sqlOut += "COMMIT;\n";

    const dir = path.resolve(process.env.BACKUP_DIR ?? "./backups");
    await mkdir(dir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const jsonFile = path.join(dir, `backup-${stamp}.json`);
    const sqlFile = path.join(dir, `backup-${stamp}.sql`);
    await writeFile(jsonFile, JSON.stringify({ generatedAt: new Date(), tables: json }, null, 2));
    await writeFile(sqlFile, sqlOut);
    return { jsonFile, sqlFile, tables: Object.keys(json).length };
  },
);



