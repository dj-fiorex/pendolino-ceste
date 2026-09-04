import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation, type QueryCtx } from "./_generated/server";
import { requireOperatore } from "./operatori";
import { mediaOn, type Action, type MediaLinks } from "./schema";

/** Neither of the two, which is what most actions carried. */
export const NO_MEDIA: MediaLinks = { signature: null, photo: null };

/**
 * Where a Ritiro's signature and photograph can be looked at, read off the
 * action that says where they were put. Every other kind of action carried
 * neither, and says so.
 *
 * A file that is no longer in storage reads as one that was never taken:
 * nothing anywhere deletes one, so the two cases are the same to whoever is
 * looking (ADR-0004).
 */
export async function linksToMedia(
  ctx: QueryCtx,
  action: Action,
): Promise<MediaLinks> {
  const held = mediaOn(action);
  const linkTo = async (id: Id<"_storage"> | undefined) =>
    id === undefined ? null : await ctx.storage.getUrl(id);
  return {
    signature: await linkTo(held.signatureId),
    photo: await linkTo(held.photoId),
  };
}

/**
 * Somewhere to put a signature or a photograph. The device asks for this, POSTs
 * the file straight at it, and carries the id that comes back into the Ritiro
 * it is confirming (#25).
 *
 * The file goes up on its own rather than inside the Ritiro, because a
 * photograph of a trailer is several hundred kilobytes after the device has
 * downscaled it and a mutation's arguments are not the place for that.
 *
 * Whoever is at the counter can ask for one: this is the Ritiro's own path,
 * and every Operatore records Ritiri (CONTEXT.md).
 */
export const uploadUrl = mutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    await requireOperatore(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});
