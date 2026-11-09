import * as XLSX from "xlsx";

export interface StationImportRow {
  code: string;
  name: string;
  plusSequence: number | null;
  minusSequence: number | null;
  active: boolean;
  rowNumber: number;
}

export interface ImportValidation {
  rows: StationImportRow[];
  errors: string[];
}

const REQUIRED_HEADERS = [
  "station_code",
  "station_name",
  "plus_sequence",
  "minus_sequence",
  "active_status",
] as const;

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const input = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (inQuotes) {
      if (char === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char === "\r") {
      // handled by \n
    } else {
      field += char;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

export function spreadsheetRows(buffer: Buffer, filename: string): string[][] {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".csv") || lower.endsWith(".txt")) {
    return parseCsv(buffer.toString("utf8"));
  }
  if (lower.endsWith(".xlsx") || lower.endsWith(".xls") || lower.endsWith(".xlsm")) {
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) throw new Error("The workbook has no worksheets.");
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: "" }) as unknown[][];
    return rows
      .map((r) => r.map((cell) => (cell == null ? "" : String(cell))))
      .filter((r) => r.some((c) => c.trim() !== ""));
  }
  throw new Error("Unsupported file type. Upload a .csv, .xlsx or .xls file.");
}

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, "_").replace(/^\uFEFF/, "");
}

function parseActive(value: string): boolean | null {
  const v = value.trim().toLowerCase();
  if (!v) return true;
  if (["true", "1", "active", "yes", "y", "enabled", "enable"].includes(v)) return true;
  if (["false", "0", "inactive", "no", "n", "disabled", "disable"].includes(v)) return false;
  return null;
}

export function validateStationRows(rows: string[][]): ImportValidation {
  const errors: string[] = [];
  if (rows.length < 2) {
    return { rows: [], errors: ["The file contains no data rows."] };
  }
  const header = rows[0].map(normalizeHeader);
  const missing = REQUIRED_HEADERS.filter((h) => !header.includes(h));
  if (missing.length) {
    return { rows: [], errors: [`Missing required column(s): ${missing.join(", ")}`] };
  }
  if (rows.length > 301) {
    return { rows: [], errors: ["The file has more than 300 stations. Split the import."] };
  }

  const index = Object.fromEntries(REQUIRED_HEADERS.map((h) => [h, header.indexOf(h)]));
  const parsed: StationImportRow[] = [];
  const codes = new Map<string, number>();
  const names = new Map<string, number>();
  const plusSeqs = new Map<number, number>();
  const minusSeqs = new Map<number, number>();

  rows.slice(1).forEach((raw, i) => {
    const rowNumber = i + 2;
    if ((raw[0] ?? "").trim().startsWith("#")) return;
    const get = (key: (typeof REQUIRED_HEADERS)[number]) => (raw[index[key]] ?? "").trim();
    const code = get("station_code").toUpperCase();
    const name = get("station_name");
    const plusRaw = get("plus_sequence");
    const minusRaw = get("minus_sequence");
    const activeRaw = get("active_status");

    if (!code && !name && !plusRaw && !minusRaw && !activeRaw) return;
    if (!code) {
      errors.push(`Row ${rowNumber}: station_code is required.`);
      return;
    }
    if (!/^[A-Z0-9_-]{2,12}$/.test(code)) {
      errors.push(`Row ${rowNumber}: station_code "${code}" must be 2–12 letters, digits, hyphen or underscore.`);
      return;
    }
    if (!name) {
      errors.push(`Row ${rowNumber}: station_name is required.`);
      return;
    }
    if (name.length > 90) {
      errors.push(`Row ${rowNumber}: station_name is too long (max 90 characters).`);
      return;
    }
    const active = parseActive(activeRaw);
    if (active === null) {
      errors.push(`Row ${rowNumber}: active_status must be active/inactive, true/false or 1/0.`);
      return;
    }
    const parseSeq = (value: string, dir: string): number | null | "invalid" => {
      if (!value) return null;
      const n = Number(value);
      if (!Number.isInteger(n) || n < 1 || n > 500) {
        errors.push(`Row ${rowNumber}: ${dir}_sequence must be a whole number between 1 and 500.`);
        return "invalid";
      }
      return n;
    };
    const plus = parseSeq(plusRaw, "plus");
    const minus = parseSeq(minusRaw, "minus");
    if (plus === "invalid" || minus === "invalid") return;

    if (active && (plus === null || minus === null)) {
      errors.push(`Row ${rowNumber}: active station "${code}" needs both plus_sequence and minus_sequence.`);
      return;
    }
    if (codes.has(code)) {
      errors.push(`Row ${rowNumber}: duplicate station_code "${code}" (also on row ${codes.get(code)}).`);
      return;
    }
    const nameKey = name.toLowerCase();
    if (names.has(nameKey)) {
      errors.push(`Row ${rowNumber}: duplicate station_name "${name}" (also on row ${names.get(nameKey)}).`);
      return;
    }
    codes.set(code, rowNumber);
    names.set(nameKey, rowNumber);

    if (plus !== null) {
      if (plusSeqs.has(plus)) {
        errors.push(`Row ${rowNumber}: duplicate plus_sequence ${plus} (also on row ${plusSeqs.get(plus)}).`);
        return;
      }
      plusSeqs.set(plus, rowNumber);
    }
    if (minus !== null) {
      if (minusSeqs.has(minus)) {
        errors.push(`Row ${rowNumber}: duplicate minus_sequence ${minus} (also on row ${minusSeqs.get(minus)}).`);
        return;
      }
      minusSeqs.set(minus, rowNumber);
    }

    parsed.push({ code, name, plusSequence: plus, minusSequence: minus, active, rowNumber });
  });

  if (!parsed.length && !errors.length) errors.push("No valid station rows were found.");
  return { rows: parsed, errors };
}

export const STATION_CSV_TEMPLATE = `station_code,station_name,plus_sequence,minus_sequence,active_status
AVH,Anand Vihar ISBT,1,38,active
IPE,IP Extension,2,37,active
LPN,Lajpat Nagar,11,28,active
# Add every verified Pink Line station, one per row.
# plus_sequence / minus_sequence define the order in each circular direction (1 = first station).
# active_status accepts active/inactive, true/false or 1/0.
`;
