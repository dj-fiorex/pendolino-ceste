import {
  ArchiveIcon,
  CalendarRangeIcon,
  ContainerIcon,
  ClipboardListIcon,
  FactoryIcon,
  HomeIcon,
  ListChecksIcon,
  MessageSquareTextIcon,
  PackageOpenIcon,
  PhoneCallIcon,
  TruckIcon,
  UndoDotIcon,
  UserCogIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react";

/**
 * Every screen the app has, as the shell has to offer it. One list, so that
 * the tab bar on the phone, the sidebar on the PC and the "Altro" menu never
 * disagree about what the app is made of.
 */
export type NavItem = {
  href: string;
  label: string;
  /** What the screen is for, where a shell has room to say it. */
  hint: string;
  icon: LucideIcon;
  adminOnly?: boolean;
};

/** The home: the figures of the day, and the way back to them. */
export const home: NavItem = {
  href: "/",
  label: "Il banco",
  hint: "Come sta il frantoio adesso.",
  icon: HomeIcon,
};

const ritiro: NavItem = {
  href: "/ritiro",
  label: "Ritiro",
  hint: "Chi ritira, e quali Ceste si porta via.",
  icon: TruckIcon,
};

const rientro: NavItem = {
  href: "/rientro",
  label: "Rientro",
  hint: "Le Ceste tornano cariche di olive.",
  icon: UndoDotIcon,
};

const svuotamento: NavItem = {
  href: "/svuotamento",
  label: "Svuotamento",
  hint: "Le Ceste si svuotano e tornano Disponibili.",
  icon: PackageOpenIcon,
};

const attesaMolitura: NavItem = {
  href: "/attesa-molitura",
  label: "Attesa molitura",
  hint: "Al frantoio, ancora piene.",
  icon: ListChecksIcon,
};

const recupero: NavItem = {
  href: "/recupero",
  label: "Lista di recupero",
  hint: "Chi ha Ceste Fuori, e da quanto.",
  icon: PhoneCallIcon,
};

const ceste: NavItem = {
  href: "/ceste",
  label: "Le Ceste",
  hint: "Quante ce ne sono, e dove sono.",
  icon: ArchiveIcon,
};

const clienti: NavItem = {
  href: "/clienti",
  label: "I Clienti",
  hint: "Cerca per nome o per soprannome.",
  icon: UsersIcon,
};

const conferimentoInFrantoio: NavItem = {
  href: "/conferimento-in-frantoio",
  label: "Conferimento in frantoio",
  hint: "Le olive riempiono le Ceste già in frantoio.",
  icon: ContainerIcon,
};

/** The Movimenti recorded at the counter. */
export const movimenti: NavItem[] = [
  ritiro,
  rientro,
  conferimentoInFrantoio,
  svuotamento,
];

/** The screens that answer where the Ceste are. */
export const lookups: NavItem[] = [attesaMolitura, recupero, ceste, clienti];

/** An Admin's own: the Registro, le Campagne, chi lavora qui, il frantoio. */
export const administration: NavItem[] = [
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
    href: "/sms",
    label: "Gli SMS",
    hint: "Cosa scriviamo ai Clienti, e cosa è partito.",
    icon: MessageSquareTextIcon,
    adminOnly: true,
  },
  {
    href: "/operatori",
    label: "Gli Operatori",
    hint: "Chi può entrare nell'app.",
    icon: UserCogIcon,
    adminOnly: true,
  },
  // Last, because it is the screen an Admin fills in once and then forgets,
  // which is the opposite of the Registro at the top. What belongs on it is a
  // rule and not a habit: a setting whose effect you can watch while you
  // change it stays on the screen that shows it (ADR-0011).
  {
    href: "/frantoio",
    label: "Il frantoio",
    hint: "Come ci chiamiamo, e come ci si trova.",
    icon: FactoryIcon,
    adminOnly: true,
  },
];

/** Every screen, in the order the sidebar and the "Altro" menu run through. */
export const everyScreen: NavItem[] = [
  ...movimenti,
  ...lookups,
  ...administration,
];

/**
 * The screens the thumb reaches on the phone, shortened to what fits under an
 * icon. Three, because the fourth place in the bottom bar is "Altro" and a bar
 * of more than four is a bar nobody hits (#32).
 */
export const tabs: NavItem[] = [
  { ...home, label: "Banco" },
  ceste,
  { ...recupero, label: "Recupero" },
];

/** Whether a screen is this Operatore's to open. */
export const allowed = (item: NavItem, isAdmin: boolean) =>
  item.adminOnly !== true || isAdmin;
