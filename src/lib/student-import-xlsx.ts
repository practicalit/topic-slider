import * as XLSX from "xlsx";
import { parseStudentRowsFromMatrix, type ParsedStudent } from "@/lib/student-import-parse";

export function parseStudentRowsFromXlsxBuffer(buf: ArrayBuffer): ParsedStudent[] {
  const wb = XLSX.read(buf, { type: "array" });
  const name = wb.SheetNames[0];
  if (!name) return [];
  const sheet = wb.Sheets[name];
  const matrix = XLSX.utils.sheet_to_json<(string | number | undefined)[]>(sheet, {
    header: 1,
    defval: "",
    raw: false,
  }) as string[][];
  const asStrings = matrix.map((row) =>
    (row ?? []).map((cell) => (cell === null || cell === undefined ? "" : String(cell)))
  );
  return parseStudentRowsFromMatrix(asStrings);
}
