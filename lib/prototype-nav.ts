/**
 * PROTOTYPE (#shell). Throwaway: every screen the app has, as a shell has to
 * offer them. One list, so that the three variants disagree about the chrome
 * and never about what is behind it.
 */
import {
  ArchiveIcon,
  CalendarRangeIcon,
  ClipboardListIcon,
  ListChecksIcon,
  PackageOpenIcon,
  PhoneCallIcon,
  TruckIcon,
  UndoDotIcon,
  UsersIcon,
  UserCogIcon,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  /** What the screen is for, where a shell has room to say it. */
  hint: string;
  icon: LucideIcon;
  adminOnly?: boolean;
};

/** The three Movimenti: what the counter is on the app to do. */
export const movimenti: NavItem[] = [
  {
    href: "/ritiro",
    label: "Ritiro",
    hint: "Chi ritira, e quali Ceste si porta via.",
    icon: TruckIcon,
  },
  {
    href: "/rientro",
    label: "Rientro",
    hint: "Le Ceste tornano cariche di olive.",
    icon: UndoDotIcon,
  },
  {
    href: "/svuotamento",
    label: "Svuotamento",
    hint: "Le Ceste si svuotano e tornano Disponibili.",
    icon: PackageOpenIcon,
  },
];

/** The screens that answer where the Ceste are. */
export const consultazione: NavItem[] = [
  {
    href: "/attesa-molitura",
    label: "Attesa molitura",
    hint: "Al frantoio, ancora piene.",
    icon: ListChecksIcon,
  },
  {
    href: "/recupero",
    label: "Lista di recupero",
    hint: "Chi ha Ceste Fuori, e da quanto.",
    icon: PhoneCallIcon,
  },
  {
    href: "/ceste",
    label: "Le Ceste",
    hint: "Quante ce ne sono, e dove sono.",
    icon: ArchiveIcon,
  },
  {
    href: "/clienti",
    label: "I Clienti",
    hint: "Cerca per nome o per soprannome.",
    icon: UsersIcon,
  },
];

/** An Admin's own: the Registro, le Campagne, chi lavora qui. */
export const amministrazione: NavItem[] = [
  {
    href: "/registro",
    label: "Il Registro",
    hint: "Chi ha fatto cosa, e quando.",
    icon: ClipboardListIcon,
    adminOnly: true,
  },
  {
    href: "/campagne",
    label: "Le Campagne",
    hint: "La stagione a cui appartiene quello che si registra.",
    icon: CalendarRangeIcon,
    adminOnly: true,
  },
  {
    href: "/operatori",
    label: "Gli Operatori",
    hint: "Chi può entrare nell'app.",
    icon: UserCogIcon,
    adminOnly: true,
  },
];

/** Whether a screen is this Operatore's to open. */
export const allowed = (item: NavItem, isAdmin: boolean) =>
  item.adminOnly !== true || isAdmin;
