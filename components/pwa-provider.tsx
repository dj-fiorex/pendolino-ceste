"use client";

import { useConvexConnectionState } from "convex/react";
import { DownloadIcon } from "lucide-react";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  installInstructions,
  installPlatform,
  type InstallPlatform,
} from "@/lib/pwa";

type InstallPrompt = Event & {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};
type Activity = { dirty: boolean; pending: boolean; recoverable: boolean };
type PwaContextValue = {
  connected: boolean;
  installed: boolean;
  showInstall: () => void;
  setActivity: (activity: Activity) => void;
};
const PwaContext = createContext<PwaContextValue | null>(null);
const IDLE: Activity = { dirty: false, pending: false, recoverable: true };

function subscribeOnline(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}
const onlineSnapshot = () => navigator.onLine;
const serverOnlineSnapshot = () => true;

export function useMovementConnection() {
  return useContext(PwaContext)?.connected ?? true;
}

/** Keeps update controls aware of uploads as well as Convex requests. */
export function useMovementActivity(
  dirty: boolean,
  pending: boolean,
  recoverable = true,
) {
  const setActivity = useContext(PwaContext)?.setActivity;
  useEffect(() => {
    setActivity?.({ dirty, pending, recoverable });
    return () => setActivity?.(IDLE);
  }, [dirty, pending, recoverable, setActivity]);
}

export function InstallButton() {
  const pwa = useContext(PwaContext);
  if (!pwa || pwa.installed) return null;
  return (
    <Button
      type="button"
      variant="outline"
      className="min-h-12 w-full"
      onClick={pwa.showInstall}
    >
      <DownloadIcon data-icon="inline-start" aria-hidden="true" />
      Installa Pendolino
    </Button>
  );
}

export function PwaProvider({ children }: { children: ReactNode }) {
  const connection = useConvexConnectionState();
  const online = useSyncExternalStore(
    subscribeOnline,
    onlineSnapshot,
    serverOnlineSnapshot,
  );
  const connected = online && connection.isWebSocketConnected;
  const [activity, setActivity] = useState(IDLE);
  const [installed, setInstalled] = useState(false);
  const [installOpen, setInstallOpen] = useState(false);
  const [platform, setPlatform] = useState<InstallPlatform>("desktop");
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [installing, setInstalling] = useState(false);
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const [updating, setUpdating] = useState(false);
  const [updateOpen, setUpdateOpen] = useState(false);
  const [workerError, setWorkerError] = useState(false);
  const reloadRequested = useRef(false);
  const pending =
    activity.pending ||
    connection.inflightMutations > 0 ||
    connection.inflightActions > 0;

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)");
    const detectInstalled = () =>
      setInstalled(
        standalone.matches ||
          (navigator as Navigator & { standalone?: boolean }).standalone ===
            true,
      );
    detectInstalled();
    setPlatform(installPlatform(navigator.userAgent, navigator.maxTouchPoints));
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPrompt);
    };
    const onInstalled = () => {
      setInstalled(true);
      setPrompt(null);
      setInstallOpen(false);
    };
    standalone.addEventListener("change", detectInstalled);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      standalone.removeEventListener("change", detectInstalled);
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    let disposed = false;
    let registration: ServiceWorkerRegistration | undefined;
    const cleanups: (() => void)[] = [];
    const discover = () => {
      if (registration?.waiting && !disposed) setWaiting(registration.waiting);
    };
    const updateFound = () => {
      const worker = registration?.installing;
      if (!worker) return;
      const changed = () => {
        if (worker.state === "installed") discover();
      };
      worker.addEventListener("statechange", changed);
      cleanups.push(() => worker.removeEventListener("statechange", changed));
    };
    const controllerChanged = () => {
      if (reloadRequested.current) window.location.reload();
      // A different tab can activate the worker. Never reload this tab for it.
      else setWaiting(null);
    };
    const check = () => {
      if (document.visibilityState === "visible" && navigator.onLine) {
        void registration?.update().catch(() => {
          /* Retry on the next check. */
        });
        discover();
      }
    };
    navigator.serviceWorker.addEventListener(
      "controllerchange",
      controllerChanged,
    );
    void navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .then((result) => {
        if (disposed) return;
        registration = result;
        discover();
        updateFound();
        registration.addEventListener("updatefound", updateFound);
        setWorkerError(false);
      })
      .catch(() => {
        if (!disposed) setWorkerError(true);
      });
    document.addEventListener("visibilitychange", check);
    window.addEventListener("online", check);
    const interval = window.setInterval(check, 60_000);
    return () => {
      disposed = true;
      window.clearInterval(interval);
      registration?.removeEventListener("updatefound", updateFound);
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        controllerChanged,
      );
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("online", check);
      cleanups.forEach((cleanup) => cleanup());
    };
  }, []);

  const install = async () => {
    if (!prompt || installing) return;
    setInstalling(true);
    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      if (choice.outcome === "accepted") setInstallOpen(false);
    } catch {
      // The device-specific instructions remain available if the prompt fails.
    } finally {
      setPrompt(null);
      setInstalling(false);
    }
  };
  const applyUpdate = () => {
    if (pending || !online || updating || !activity.recoverable) return;
    reloadRequested.current = true;
    setUpdating(true);
    if (waiting?.state === "installed")
      waiting.postMessage({ type: "APPLY_UPDATE" });
    else window.location.reload();
  };

  return (
    <PwaContext.Provider
      value={{
        connected,
        installed,
        showInstall: () => setInstallOpen(true),
        setActivity,
      }}
    >
      <div className="pwa-safe-area">
        {(!online ||
          (!connected &&
            (connection.hasEverConnected ||
              connection.connectionRetries > 0))) && (
          <p
            role="status"
            className="border-b bg-secondary px-4 py-3 text-sm text-secondary-foreground"
          >
            Connessione assente.{" "}
            {pending
              ? "Conferma in attesa del server: lascia aperta l’app. Non ripetere il Movimento."
              : "Attendi la riconnessione prima di registrare un Movimento. I dati mostrati potrebbero non essere aggiornati."}
          </p>
        )}
        {workerError && (
          <p role="status" className="border-b bg-secondary px-4 py-3 text-sm">
            Preparazione dell’apertura offline non riuscita. Riprova ricaricando
            quando hai una connessione.
          </p>
        )}
        {waiting && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-card px-4 py-3">
            <p role="status" className="text-sm">
              Aggiornamento disponibile
              {pending ? ": attendi la conferma del Movimento." : "."}
            </p>
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              disabled={pending || !online || updating || !activity.recoverable}
              onClick={() =>
                activity.dirty ? setUpdateOpen(true) : applyUpdate()
              }
            >
              {updating ? "Aggiornamento…" : "Aggiorna"}
            </Button>
          </div>
        )}
        {children}
      </div>
      <Dialog open={installOpen} onOpenChange={setInstallOpen}>
        <DialogContent className="max-h-[calc(100dvh-3rem)] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Installa Pendolino</DialogTitle>
            <DialogDescription>
              Apri l’app dalla sua icona. Per registrare i Movimenti serve una
              connessione.
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm leading-relaxed">
            {installInstructions[platform]}
          </p>
          {prompt && (
            <Button
              type="button"
              className="min-h-12"
              disabled={installing}
              onClick={install}
            >
              {installing ? "Un attimo…" : "Installa"}
            </Button>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={updateOpen} onOpenChange={setUpdateOpen}>
        <DialogContent className="max-h-[calc(100dvh-3rem)] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Aggiornare adesso?</DialogTitle>
            <DialogDescription>
              Hai un Movimento in corso. Dopo l’aggiornamento potrai riprendere
              la selezione salvata. Foto e firma vanno acquisite di nuovo.
            </DialogDescription>
          </DialogHeader>
          <Button
            type="button"
            className="min-h-12"
            disabled={pending || !online || updating || !activity.recoverable}
            onClick={applyUpdate}
          >
            Aggiorna e ricarica
          </Button>
          <Button
            type="button"
            variant="outline"
            className="min-h-12"
            onClick={() => setUpdateOpen(false)}
          >
            Continua a lavorare
          </Button>
        </DialogContent>
      </Dialog>
    </PwaContext.Provider>
  );
}
