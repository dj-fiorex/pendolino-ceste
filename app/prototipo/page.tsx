import { PrototypeHome } from "@/components/prototype/home";
import type { HomeData } from "@/lib/prototype-home";

/**
 * PROTOTYPE (#shell). Throwaway: the home in the three shells, on invented
 * figures and without a session, so that the shape can be judged on any device
 * without signing in. The real home is `/`.
 */
const madeUp: HomeData = {
  operatore: { name: "Gabriele", role: "admin" },
  disponibili: [
    { portata: 400, count: 38 },
    { portata: 250, count: 21 },
  ],
  fuori: 64,
  attesa: 27,
  dismesse: 3,
  totale: 153,
  clienti: [
    {
      name: "Giuseppe Amato · Turi",
      ceste: 6,
      since: Date.now() - 11 * 86_400_000,
      late: true,
      phone: "+39 340 1234567",
    },
    {
      name: "Salvatore Russo",
      ceste: 4,
      since: Date.now() - 9 * 86_400_000,
      late: true,
      phone: "+39 347 7654321",
    },
    {
      name: "Antonio Greco · Ninuccio",
      ceste: 8,
      since: Date.now() - 5 * 86_400_000,
      late: false,
      phone: null,
    },
    {
      name: "Maria Lombardo",
      ceste: 2,
      since: Date.now() - 3 * 86_400_000,
      late: false,
      phone: "+39 333 2223344",
    },
    {
      name: "Vito Palmisano",
      ceste: 12,
      since: Date.now() - 86_400_000,
      late: false,
      phone: "+39 349 9988776",
    },
    {
      name: "Cosimo Fanelli",
      ceste: 3,
      since: Date.now(),
      late: false,
      phone: null,
    },
  ],
  waiting: [
    {
      cliente: "Giuseppe Amato · Turi",
      ceste: 6,
      oldestRientro: Date.now() - 2 * 86_400_000,
    },
    {
      cliente: "Maria Lombardo",
      ceste: 4,
      oldestRientro: Date.now() - 86_400_000,
    },
    { cliente: "Vito Palmisano", ceste: 9, oldestRientro: Date.now() },
    { cliente: null, ceste: 8, oldestRientro: null },
  ],
};

export default function Prototipo() {
  return <PrototypeHome data={madeUp} />;
}
