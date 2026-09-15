"use client";

import { HashIcon } from "lucide-react";
import { NumeroKeypad } from "@/components/numero-keypad";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { FoundCesta } from "@/lib/ceste";

/** Shared manual entry for Ritiro, Rientro and Svuotamento. */
export function NumeroKeypadDialog({
  title = "Aggiungi per numero",
  description,
  submitLabel = "Aggiungi",
  onCesta,
}: {
  title?: string;
  description: string;
  submitLabel?: string;
  onCesta: (cesta: FoundCesta) => string | null;
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" className="h-16 px-5 text-lg">
          <HashIcon data-icon="inline-start" aria-hidden="true" />
          Numero
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <NumeroKeypad submitLabel={submitLabel} onCesta={onCesta} />
      </DialogContent>
    </Dialog>
  );
}
