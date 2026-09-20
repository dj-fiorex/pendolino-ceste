"use client";

import { useMutation } from "convex/react";
import { createContext, useState, type ReactNode } from "react";
import { api } from "@/convex/_generated/api";
import { upload } from "@/lib/media";
import { Ritiro } from "@/lib/ritiro";
import { forgetDraft, readDraft, writeDraft } from "@/lib/ritiro-draft";

export const RitiroContext = createContext<Ritiro | null>(null);

/** A pending confirmation belongs to the signed-in app, not one page mount. */
export function RitiroProvider({ children }: { children: ReactNode }) {
  const record = useMutation(api.movimenti.ritiro);
  const uploadUrl = useMutation(api.media.uploadUrl);
  const [ritiro] = useState(
    () =>
      new Ritiro({
        drafts: { read: readDraft, write: writeDraft, clear: forgetDraft },
        upload: async (file) => upload(await uploadUrl({}), file),
        record,
      }),
  );
  return (
    <RitiroContext.Provider value={ritiro}>{children}</RitiroContext.Provider>
  );
}
