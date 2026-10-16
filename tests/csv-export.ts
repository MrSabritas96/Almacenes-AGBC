import assert from "node:assert/strict";
import { csvCell } from "../src/lib/csv";

for (const payload of ["=1+1", "+1+1", "-1+1", "@SUM(1)", "\t=1+1", "\r=1+1", "\n=1+1", "   =1+1", "＝1+1", "＋1+1", "－1+1", "＠SUM(1)"]) {
  assert.equal(csvCell(payload), `"'${payload}"`, `Must neutralize ${JSON.stringify(payload)}`);
}
assert.equal(csvCell('Material, "especial"\r\nOtra línea'), '"Material, ""especial""\r\nOtra línea"');
assert.equal(csvCell(null), '""');
assert.equal(csvCell(42), '"42"');
assert.equal(csvCell("MAT-001"), '"MAT-001"');
console.log("OK: CSV neutraliza fórmulas, controles y variantes Unicode; conserva campos y comillas.");
