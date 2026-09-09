"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  readMovementDraft,
  saveMovementDraft,
  type MovementDrafts,
} from "@/lib/movement-draft";

export function useMovementDraft<K extends keyof MovementDrafts>(
  kind: K,
  draft: MovementDrafts[K] | null,
) {
  const [offer, setOffer] = useState<MovementDrafts[K] | null | undefined>(
    undefined,
  );
  const [storageFailed, setStorageFailed] = useState(false);
  useEffect(() => {
    setOffer(readMovementDraft(kind));
  }, [kind]);
  useEffect(() => {
    if (offer === null) setStorageFailed(!saveMovementDraft(kind, draft));
  }, [kind, offer, draft]);
  return { offer, dismiss: () => setOffer(null), storageFailed };
}

export function MovementResumeOffer({
  name,
  detail,
  onResume,
  onDiscard,
  uncertain = false,
}: {
  name: string;
  detail: string;
  onResume: () => void;
  onDiscard: () => void;
  uncertain?: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Un {name} lasciato a metà</CardTitle>
        <CardDescription>
          {detail}. Controlla la selezione prima di registrare.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {uncertain && <InterruptedConfirmation />}
        <Button className="min-h-12" onClick={onResume}>
          Riprendi {name}
        </Button>
        <Button variant="outline" className="min-h-12" onClick={onDiscard}>
          Ricomincia da capo
        </Button>
      </CardContent>
    </Card>
  );
}

export function DraftStorageError() {
  return (
    <p role="alert" className="text-sm text-destructive">
      Questo dispositivo non riesce a salvare il lavoro. Lascia aperta l’app
      fino alla conferma del Movimento.
    </p>
  );
}

export function InterruptedConfirmation() {
  return (
    <p role="alert" className="text-sm">
      La conferma era in corso quando l’app è stata chiusa. Il Movimento
      potrebbe essere già registrato: verifica lo stato delle Ceste prima di
      ripeterlo.
    </p>
  );
}
