"use client";

import { SerwistProvider } from "@serwist/next/react";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

interface InstallPromptEvent extends Event {
  prompt(): Promise<{ outcome: "accepted" | "dismissed" }>;
}

declare global {
  interface WindowEventMap {
    beforeinstallprompt: InstallPromptEvent;
  }
}

type Installation = {
  available: boolean;
  isIOS: boolean;
  prompt: InstallPromptEvent | null;
  clearPrompt: () => void;
};

const InstallationContext = createContext<Installation | null>(null);

export function useInstallation() {
  return useContext(InstallationContext);
}

export function PwaProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);

  // Listen before Altro opens so a one-shot browser event is not lost.
  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)");
    const appleStandalone =
      "standalone" in navigator && navigator.standalone === true;
    setIsIOS(
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1),
    );
    setInstalled(standalone.matches || appleStandalone);
    setReady(true);

    const beforeInstall = (event: InstallPromptEvent) => {
      event.preventDefault();
      setPrompt(event);
    };
    const appInstalled = () => {
      setInstalled(true);
      setPrompt(null);
    };
    const displayChanged = () =>
      setInstalled(standalone.matches || appleStandalone);
    window.addEventListener("beforeinstallprompt", beforeInstall);
    window.addEventListener("appinstalled", appInstalled);
    standalone.addEventListener("change", displayChanged);
    return () => {
      window.removeEventListener("beforeinstallprompt", beforeInstall);
      window.removeEventListener("appinstalled", appInstalled);
      standalone.removeEventListener("change", displayChanged);
    };
  }, []);

  return (
    <SerwistProvider
      swUrl="/sw.js"
      disable={process.env.NODE_ENV === "development"}
      cacheOnNavigation={false}
      reloadOnOnline={false}
    >
      <InstallationContext.Provider
        value={{
          available: ready && !installed,
          isIOS,
          prompt,
          clearPrompt: () => setPrompt(null),
        }}
      >
        {children}
      </InstallationContext.Provider>
    </SerwistProvider>
  );
}
