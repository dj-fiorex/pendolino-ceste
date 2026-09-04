import { redirect } from "next/navigation";
import { PrototypeHome } from "@/components/prototype/home";
import { SignOutButton } from "@/components/sign-out-button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { api } from "@/convex/_generated/api";
import { fetchAuthQuery, signedInOperatore } from "@/lib/auth-server";
import { inRitardo } from "@/lib/ceste";
import { clienteLabel } from "@/lib/cliente";
import type { HomeData } from "@/lib/prototype-home";

/**
 * PROTOTYPE (#shell). The home, in three shapes on one set of figures. What
 * ships is one of them; the switcher at the bottom picks which.
 */
export default async function Home() {
  const { signedIn, operatore } = await signedInOperatore();
  if (!signedIn) {
    redirect("/accedi");
  }

  if (operatore === null) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-col justify-center gap-8 p-6">
        <Card>
          <CardHeader>
            <CardTitle>Questo account non è abilitato</CardTitle>
            <CardDescription>
              Chiedi a un Admin del frantoio di riattivarti, poi rientra.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SignOutButton />
          </CardContent>
        </Card>
      </main>
    );
  }

  const [ceste, disponibili, recupero, waiting] = await Promise.all([
    fetchAuthQuery(api.ceste.list, {}),
    fetchAuthQuery(api.ceste.disponibiliByPortata, {}),
    fetchAuthQuery(api.recupero.list, {}),
    fetchAuthQuery(api.ceste.attesaMolituraByCliente, {}),
  ]);

  const data: HomeData = {
    operatore: { name: operatore.name, role: operatore.role },
    disponibili,
    fuori: ceste.filter((cesta) => cesta.state === "fuori").length,
    attesa: ceste.filter((cesta) => cesta.state === "attesa_molitura").length,
    dismesse: ceste.filter((cesta) => cesta.state === "dismessa").length,
    totale: ceste.length,
    clienti: recupero.clienti.map((row) => ({
      name: clienteLabel(row.cliente),
      ceste: row.ceste.length,
      since: row.since,
      late: inRitardo(row.since, recupero.sogliaRitardo),
      phone: row.cliente.phone,
    })),
    waiting: waiting.map((group) => ({
      cliente: group.cliente === null ? null : clienteLabel(group.cliente),
      ceste: group.ceste.length,
      oldestRientro: group.oldestRientro,
    })),
  };

  return <PrototypeHome data={data} />;
}
