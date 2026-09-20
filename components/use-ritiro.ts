"use client";

import { useContext, useEffect, useSyncExternalStore } from "react";
import { useCampagnaChoice } from "@/components/campagna-bar";
import { RitiroContext } from "@/components/ritiro-provider";

/** Connect React and the device to a Ritiro; lifecycle decisions stay in the module. */
export function useRitiro() {
  const ritiro = useContext(RitiroContext);
  if (ritiro === null) throw new Error("RitiroFlow requires RitiroProvider");
  const { campagnaId, mustAsk } = useCampagnaChoice();
  const state = useSyncExternalStore(
    ritiro.subscribe,
    ritiro.getSnapshot,
    ritiro.getSnapshot,
  );

  useEffect(() => {
    ritiro.setCampagna({ campagnaId, mustAsk });
  }, [ritiro, campagnaId, mustAsk]);
  useEffect(() => {
    ritiro.open();
    return ritiro.close;
  }, [ritiro]);

  return { ritiro, state };
}
