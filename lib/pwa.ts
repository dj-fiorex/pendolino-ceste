export type InstallPlatform = "ios" | "android" | "mac" | "desktop";

export function installPlatform(
  userAgent: string,
  touchPoints: number,
): InstallPlatform {
  if (
    /iPhone|iPad|iPod/.test(userAgent) ||
    (/Macintosh/.test(userAgent) && touchPoints > 1)
  )
    return "ios";
  if (/Android/.test(userAgent)) return "android";
  if (/Macintosh/.test(userAgent)) return "mac";
  return "desktop";
}

export const installInstructions: Record<InstallPlatform, string> = {
  ios: 'Apri il menu Condividi del browser e scegli "Aggiungi alla schermata Home", poi conferma. Se non trovi la voce, apri questo indirizzo in Safari.',
  android:
    'Apri il menu di Chrome o Samsung Internet e scegli "Installa app" oppure "Aggiungi a schermata Home". In altri browser potrebbe essere disponibile solo un collegamento.',
  mac: "In Safari scegli File → Aggiungi al Dock. In Chrome o Edge usa la voce per installare la pagina come app nel menu del browser.",
  desktop:
    "Apri questo indirizzo in Chrome o Edge e usa la voce per installare la pagina come app nel menu del browser. Se il tuo browser non offre l’installazione, puoi continuare a usare Pendolino qui.",
};
