import Link from "next/link";
import { redirect } from "next/navigation";
import { EtichetteSheet, type Selection } from "@/components/etichette-sheet";
import { api } from "@/convex/_generated/api";
import { fetchAuthQuery, signedInOperatore } from "@/lib/auth-server";

type SearchParams = { [key: string]: string | string[] | undefined };

/** A query-string parameter, which Next hands over repeated or not at all. */
const queryValue = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

/** A numero out of the query string, or null when there is no usable one. */
const parseNumero = (value: string | undefined) => {
  const numero = Number(value);
  return value !== undefined &&
    value !== "" &&
    Number.isInteger(numero) &&
    numero > 0
    ? numero
    : null;
};

/**
 * Which Ceste the Admin arrived to print: the rows ticked on the fleet screen,
 * or the run of numeri a Censimento has just created. Null when neither says,
 * and the screen falls back to the whole fleet — which is what the mill prints
 * once, before its first Campagna.
 */
function selectionFrom(searchParams: SearchParams): Selection | null {
  const ticked = (queryValue(searchParams.numeri) ?? "")
    .split(",")
    .map((value) => parseNumero(value.trim()))
    .filter((numero): numero is number => numero !== null);
  if (ticked.length > 0) {
    return { kind: "numeri", numeri: ticked };
  }
  const from = parseNumero(queryValue(searchParams.from));
  const to = parseNumero(queryValue(searchParams.to));
  if (from !== null && to !== null) {
    return { kind: "range", from: String(from), to: String(to) };
  }
  return null;
}

/**
 * The Etichette screen: the labels the print shop prints, and the settings
 * that decide what they say. Reserved to an Admin, like the fleet it prints
 * from (spec #1).
 */
export default async function Etichette({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { signedIn, operatore } = await signedInOperatore();
  if (!signedIn) {
    redirect("/accedi");
  }
  if (operatore === null || operatore.role !== "admin") {
    redirect("/ceste");
  }

  const [ceste, settings, params] = await Promise.all([
    fetchAuthQuery(api.ceste.list, {}),
    fetchAuthQuery(api.etichette.settings, {}),
    searchParams,
  ]);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col gap-6 p-6">
      <div className="space-y-2">
        <Link
          href="/ceste"
          className="text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          ← Le Ceste
        </Link>
        <h1 className="font-display text-3xl font-bold tracking-tight">
          Etichette
        </h1>
      </div>

      <EtichetteSheet
        ceste={ceste.map((cesta) => ({
          numero: cesta.numero,
          codice: cesta.codice,
        }))}
        initialSelection={selectionFrom(params)}
        initialSettings={settings}
      />
    </main>
  );
}
