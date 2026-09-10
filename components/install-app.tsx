"use client";

import { DownloadIcon } from "lucide-react";
import { useRef, useState } from "react";
import { useInstallation } from "@/components/pwa-provider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function InstallApp() {
  const installation = useInstallation();
  const [help, setHelp] = useState(false);
  const [pending, setPending] = useState(false);
  const button = useRef<HTMLButtonElement>(null);

  if (!installation?.available) return null;

  async function install() {
    if (!installation?.prompt || installation.isIOS) {
      setHelp(true);
      return;
    }
    setPending(true);
    try {
      await installation.prompt.prompt();
    } catch {
      setHelp(true);
    } finally {
      // A prompt can only be used once, even when the user dismisses it.
      installation.clearPrompt();
      setPending(false);
    }
  }

  return (
    <>
      <Button
        ref={button}
        variant="ghost"
        className="min-h-12 w-full justify-start"
        disabled={pending}
        onClick={install}
      >
        <DownloadIcon data-icon="inline-start" aria-hidden="true" />
        Installa Pendolino
      </Button>
      <Dialog open={help} onOpenChange={setHelp}>
        <DialogContent
          className="max-h-[calc(100dvh-2rem)] overflow-y-auto"
          onCloseAutoFocus={(event) => {
            // The action remains in the parent Altro dialog.
            event.preventDefault();
            button.current?.focus();
          }}
        >
          <DialogHeader>
            <DialogTitle>Installa Pendolino</DialogTitle>
            <DialogDescription>
              Apri Pendolino dalla schermata Home. Per usarlo serve internet.
            </DialogDescription>
          </DialogHeader>
          {installation.isIOS ? (
            <ol className="flex list-decimal flex-col gap-3 pl-5">
              <li>Apri il menu Condividi del browser.</li>
              <li>Scegli Aggiungi alla schermata Home.</li>
              <li>
                Se disponibile, lascia attivo Apri come app web e tocca
                Aggiungi.
              </li>
            </ol>
          ) : (
            <p>
              Apri il menu del browser e cerca Installa app o Aggiungi alla
              schermata Home. Se la voce non compare, apri Pendolino in Chrome.
            </p>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
