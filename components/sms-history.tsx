"use client";

import { useQuery } from "convex/react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import {
  smsDeliveryLabel,
  smsKindLabel,
  smsWentWrong,
  smsWhen,
} from "@/lib/sms";

/**
 * What the mill has written to this Cliente, newest first, words and all.
 *
 * Readable by every Operatore rather than by an Admin only: these are the mill
 * writing to its own customer about Ceste, and whoever is about to telephone
 * him needs to know what he was already told.
 *
 * Nothing here is a link to send another one — the button for that is on the
 * page above, where an Admin will look for it.
 */
export function SmsHistory({ clienteId }: { clienteId: Id<"clienti"> }) {
  const rows = useQuery(api.sms.byCliente, { clienteId });

  if (rows === undefined || rows.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Gli SMS</CardTitle>
        <CardDescription>
          Quello che gli abbiamo scritto, dall&rsquo;ultimo.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="grid gap-2">
          {rows.map((sms) => (
            <li key={sms._id} className="rounded-lg border bg-card px-4 py-3">
              <p className="text-base whitespace-pre-wrap">{sms.body}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {smsWhen(sms.at)} · {smsKindLabel[sms.kind]} · {sms.operatore}
                {" · "}
                <span
                  className={cn(
                    smsWentWrong(sms.delivery) &&
                      "font-semibold text-amber-700 dark:text-amber-300",
                  )}
                >
                  {smsDeliveryLabel(sms.delivery)}
                </span>
              </p>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
