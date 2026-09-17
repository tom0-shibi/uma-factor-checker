import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const defaultCsvPath = path.join(
  repositoryRoot,
  "data/factor-master/factor-master.csv"
);
const defaultOutputPath = path.join(
  repositoryRoot,
  "assets/js/data/factor-master.js"
);

const EXPECTED_HEADERS = ["No.", "因子名", "因子色", "分類", "備考"];
const ALLOWED_COLORS = ["blue", "red", "green", "white"];
const ALLOWED_TYPES = [
  "status",
  "aptitude",
  "unique",
  "skill",
  "race",
  "scenario",
  "gene",
  "awakening",
  "hidden",
  "other"
];

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < text.length; index++) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        field += '"';
        index++;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
      continue;
    }
    if (character === '"') {
      quoted = true;
    } else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\n") {
      row.push(field.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += character;
    }
  }

  if (quoted) {
    throw new Error("CSV末尾までに引用符が閉じられていません。");
  }
  if (field || row.length > 0) {
    row.push(field.replace(/\r$/, ""));
    rows.push(row);
  }
  return rows;
}

function readAndValidateFactorMaster(csvPath = defaultCsvPath) {
  const text = fs.readFileSync(csvPath, "utf8").replace(/^\uFEFF/, "");
  const rows = parseCsv(text);
  const header = rows.shift() ?? [];
  if (JSON.stringify(header) !== JSON.stringify(EXPECTED_HEADERS)) {
    throw new Error(
      `CSVヘッダーが不正です。期待値: ${EXPECTED_HEADERS.join(",")}`
    );
  }

  const errors = [];
  const names = new Map();
  const entries = [];
  rows.forEach((columns, index) => {
    const rowNumber = index + 2;
    if (columns.length === 1 && columns[0] === "") {
      return;
    }
    if (columns.length !== EXPECTED_HEADERS.length) {
      errors.push(
        `行${rowNumber}: 列数が${columns.length}です（期待値${EXPECTED_HEADERS.length}）。`
      );
      return;
    }
    const [, rawName, rawColor, rawType, rawNote] = columns;
    const name = rawName;
    const color = rawColor;
    const type = rawType;
    const note = rawNote;
    if (!name.trim()) {
      errors.push(`行${rowNumber}: 因子名が空です。`);
    }
    if (!ALLOWED_COLORS.includes(color)) {
      errors.push(`行${rowNumber}: 不正な因子色「${color}」です。`);
    }
    if (!ALLOWED_TYPES.includes(type)) {
      errors.push(`行${rowNumber}: 不正な分類「${type}」です。`);
    }
    if (name) {
      if (names.has(name)) {
        errors.push(
          `行${rowNumber}: 因子名「${name}」が行${names.get(name)}と重複しています。`
        );
      } else {
        names.set(name, rowNumber);
      }
    }
    entries.push({ name, color, type, note });
  });

  if (errors.length > 0) {
    throw new Error(`Factor Master CSV検証エラー:\n${errors.join("\n")}`);
  }
  return entries;
}

function renderFactorMasterModule(entries) {
  const colorLines = ALLOWED_COLORS.map(
    color => `  ${color.toUpperCase()}: ${JSON.stringify(color)}`
  );
  const typeLines = ALLOWED_TYPES.map(
    type => `  ${type.toUpperCase()}: ${JSON.stringify(type)}`
  );
  const entryLines = entries.map(entry =>
    `  ${JSON.stringify(entry)}`
  );
  return `/* =========================================================
  Factor Master（自動生成）

  data/factor-master/factor-master.csv から生成される実行用データ。
  このファイルを直接編集せず、CSV更新後に生成スクリプトを実行する。
  ========================================================= */

const FACTOR_COLORS = Object.freeze({
${colorLines.join(",\n")}
});

const FACTOR_TYPES = Object.freeze({
${typeLines.join(",\n")}
});

const FACTOR_MASTER = Object.freeze([
${entryLines.join(",\n")}
]);

export { FACTOR_COLORS, FACTOR_TYPES, FACTOR_MASTER };
`;
}

function buildFactorMaster({
  csvPath = defaultCsvPath,
  outputPath = defaultOutputPath
} = {}) {
  const entries = readAndValidateFactorMaster(csvPath);
  const output = renderFactorMasterModule(entries);
  fs.writeFileSync(outputPath, output, "utf8");
  return { entries, output, csvPath, outputPath };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  const result = buildFactorMaster();
  console.log(
    `Factor Masterを生成しました: ${result.entries.length}件 -> ` +
    path.relative(repositoryRoot, result.outputPath)
  );
}

export {
  EXPECTED_HEADERS,
  ALLOWED_COLORS,
  ALLOWED_TYPES,
  parseCsv,
  readAndValidateFactorMaster,
  renderFactorMasterModule,
  buildFactorMaster
};
