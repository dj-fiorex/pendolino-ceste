import { redirect } from "next/navigation";
import { HomeDashboard, type HomeData } from "@/components/home-dashboard";
import { AccountDisabled } from "@/components/account-disabled";
import { api } from "@/convex/_generated/api";
import { fetchAuthQuery, signedInOperatore } from "@/lib/auth-server";
import { inRitardo } from "@/lib/ceste";
import { clienteLabel } from "@/lib/cliente";

/**
 * The home: how the frantoio stands right now — how many Ceste are Disponibili,
 * how many are Fuori, how many wait to be milled, and who is over the Soglia —
 * with the three Movimenti beside it (#32).
 *
 * The figures are read here, on the server, so that the counter opening the app
 * on a peak morning gets them with the page rather than after it.
 */
export default async function Home() {
  const { signedIn, operatore } = await signedInOperatore();
  if (!signedIn) {
    redirect("/accedi");
  }

  if (operatore === null) {
    return <AccountDisabled />;
  }

  const [ceste, disponibili, recupero] = await Promise.all([
    fetchAuthQuery(api.ceste.list, {}),
    fetchAuthQuery(api.ceste.disponibiliByPortata, {}),
    fetchAuthQuery(api.recupero.list, {}),
  ]);

  const data: HomeData = {
    operatore: { name: operatore.name },
    disponibili,
    fuori: ceste.filter((cesta) => cesta.state === "fuori").length,
    attesa: ceste.filter((cesta) => cesta.state === "attesa_molitura").length,
    clienti: recupero.clienti.map((row) => ({
      name: clienteLabel(row.cliente),
      ceste: row.ceste.length,
      since: row.since,
      late: inRitardo(row.since, recupero.sogliaRitardo),
      phone: row.cliente.phone,
    })),
  };

  return (
    <main className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-4 lg:px-8 lg:py-6">
      <HomeDashboard data={data} />
    </main>
  );
}
