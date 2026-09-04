import { SetPasswordForm } from "@/components/set-password-form";

/**
 * The page an emailed link opens: where somebody chooses their own password,
 * whether they are arriving for the first time on an invitation or replacing
 * one they forgot (ADR-0008).
 *
 * The one page in the app that asks nobody to be signed in — its whole reason
 * for existing is the people who cannot be. What it shows is settled on the
 * device from the link itself, which is why nothing is read here.
 */
export default async function Password({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-8 p-6">
      <div className="space-y-2">
        <h1 className="font-display text-3xl font-bold tracking-tight">
          Pendolino Ceste
        </h1>
        <p className="text-muted-foreground">Le Ceste del frantoio.</p>
      </div>
      <SetPasswordForm token={token} />
    </main>
  );
}
