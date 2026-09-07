#!/usr/bin/env node
/**
 * Imports the mill's customer registry from an OleaPlus CSV export into the
 * Clienti table, through `convex/gestionale.ts` (ADR-0003).
 *
 *   node scripts/import-oleaplus.mjs <export.csv> [--prod] [--batch 250]
 *
 * The import only ever adds. It never edits a Cliente the counter already has,
 * and it never writes back to OleaPlus. Running it twice over the same export
 * inserts nobody twice, because a Cliente is matched by the Gestionale's own
 * Codice.
 *
 * Every row the import will not decide on its own — a namesake nothing tells
 * apart, a telephone nobody could dial, a record OleaPlus never gave a Codice
 * — comes back in a CSV for the mill, written in Italian and separated with
 * semicolons so that Excel opens it without being asked twice.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { basename } from "node:path";

/**
 * The export is Windows-1252, not UTF-8: read as UTF-8, every accented letter
 * in it turns into a replacement character.
 */
const readExport = (path) =>
  new TextDecoder("windows-1252").decode(readFileSync(path));

/** RFC 4180, which is all this export is: quoted fields, doubled quotes. */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char !== '"') {
        field += char;
      } else if (text[i + 1] === '"') {
        field += '"';
        i++;
      } else {
        quoted = false;
      }
      continue;
    }
    if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((one) => one.some((cell) => cell.trim() !== ""));
}

/** One line of the report, in the mill's own language. */
const REPORT = {
  no_codice: [
    "Senza Codice",
    "La scheda non ha un Codice in OleaPlus: assegnarlo e riesportare.",
  ],
  namesake: [
    "Omonimo",
    "Un altro Cliente si chiama esattamente così. Aggiungere un soprannome che li distingua, poi reimportare.",
  ],
  phone: [
    "Telefono da sistemare",
    "Il numero su OleaPlus non è leggibile, di solito perché nella stessa casella ce ne sono due: correggerlo su OleaPlus, oppure richiederlo al banco.",
  ],
};

const csvCell = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;

function main() {
  const args = process.argv.slice(2);
  const path = args.find((one) => !one.startsWith("--"));
  if (path === undefined) {
    console.error(
      "Usage: node scripts/import-oleaplus.mjs <export.csv> [--prod]",
    );
    process.exit(1);
  }
  const prod = args.includes("--prod");
  const batchSize = Number(
    args.find((one) => one.startsWith("--batch="))?.split("=")[1] ?? 250,
  );

  const [header, ...records] = parseCsv(readExport(path));
  const at = (name) => {
    const index = header.indexOf(name);
    if (index === -1) throw new Error(`The export has no "${name}" column.`);
    return index;
  };
  const columns = {
    codice: at("Codice"),
    cognome: at("Cognome"),
    nome: at("Nome"),
    nascita: at("Data di nascita"),
    localita: at("Località"),
    indirizzo: at("Indirizzo"),
    telefono: at("Telefono"),
  };
  const read = (record) => ({
    record,
    gestionaleId: record[columns.codice].trim(),
    name: [record[columns.cognome], record[columns.nome]]
      .map((one) => one.trim())
      .filter((one) => one !== "")
      .join(" "),
    phone: record[columns.telefono].trim(),
  });

  const rows = records.map(read);
  const keyed = rows.filter((one) => one.gestionaleId !== "");
  const report = rows
    .filter((one) => one.gestionaleId === "")
    .map((one) => ({ ...one, outcome: "no_codice" }));

  console.log(
    `${basename(path)}: ${rows.length} records, ${keyed.length} with a Codice.`,
  );
  console.log(
    `Importing into the ${prod ? "PRODUCTION" : "dev"} deployment, in batches of ${batchSize}.`,
  );

  const tally = { imported: 0, already_present: 0, namesake: 0, phone: 0 };
  const byId = new Map(keyed.map((one) => [one.gestionaleId, one]));
  for (let from = 0; from < keyed.length; from += batchSize) {
    const batch = keyed.slice(from, from + batchSize);
    const stdout = execFileSync(
      "npx",
      [
        "convex",
        "run",
        "gestionale:importRegistry",
        JSON.stringify({
          rows: batch.map(({ gestionaleId, name, phone }) => ({
            gestionaleId,
            name,
            phone,
          })),
        }),
        ...(prod ? ["--prod"] : []),
      ],
      { encoding: "utf8" },
    );
    // The CLI prints its own lines before the return value; the return value is
    // the array, and it is the last thing printed.
    const results = JSON.parse(stdout.slice(stdout.indexOf("[")));
    for (const result of results) {
      tally[result.outcome]++;
      const row = byId.get(result.gestionaleId);
      // A namesake is one line, and so is a telephone nobody could dial. A row
      // can be both, and the mill wants to be told both: the two lists are
      // fixed in different places.
      if (result.outcome === "namesake") {
        report.push({ ...row, outcome: "namesake" });
      }
      if (result.phoneUnreadable) {
        tally.phone++;
        report.push({ ...row, outcome: "phone" });
      }
    }
    console.log(
      `  ${Math.min(from + batchSize, keyed.length)}/${keyed.length}`,
      tally,
    );
  }

  const today = new Date().toISOString().slice(0, 10);
  const reportPath = `client_files/oleaplus-da-sistemare-${today}.csv`;
  const lines = [
    [
      "Codice",
      "Cognome",
      "Nome",
      "Data di nascita",
      "Località",
      "Indirizzo",
      "Telefono",
      "Problema",
      "Cosa fare",
    ],
    ...report.map((one) => [
      one.gestionaleId,
      one.record[columns.cognome],
      one.record[columns.nome],
      one.record[columns.nascita],
      one.record[columns.localita],
      one.record[columns.indirizzo],
      one.record[columns.telefono],
      ...REPORT[one.outcome],
    ]),
  ];
  // A BOM and semicolons, because the mill opens this in Excel.
  writeFileSync(
    reportPath,
    "﻿" + lines.map((line) => line.map(csvCell).join(";")).join("\r\n"),
    "utf8",
  );

  console.log(`\nDone. ${JSON.stringify(tally, null, 0)}`);
  console.log(`${report.length} rows for the mill: ${reportPath}`);
}

main();
