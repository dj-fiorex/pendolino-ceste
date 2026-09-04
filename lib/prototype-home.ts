/**
 * PROTOTYPE (#shell). Throwaway: what the three home screens are all built
 * from, read once on the server so the variants disagree about the layout and
 * never about the numbers.
 */
import type { Role } from "@/convex/schema";

export type HomeCliente = {
  name: string;
  /** How many Ceste this Cliente is holding, and since when the oldest. */
  ceste: number;
  since: number | null;
  late: boolean;
  phone: string | null;
};

export type HomeWaiting = {
  /** Whose name the paper tape carries, where the app knows it. */
  cliente: string | null;
  ceste: number;
  oldestRientro: number | null;
};

export type HomeData = {
  operatore: { name: string; role: Role };
  disponibili: { portata: number; count: number }[];
  fuori: number;
  attesa: number;
  dismesse: number;
  totale: number;
  /** Everybody holding Ceste, worst first: the head of the Lista di recupero. */
  clienti: HomeCliente[];
  /** The loads waiting to be milled, oldest first. */
  waiting: HomeWaiting[];
};

/** How many of the Ceste the mill owns are ready to hand out. */
export const disponibiliTotal = (data: HomeData) =>
  data.disponibili.reduce((sum, { count }) => sum + count, 0);
