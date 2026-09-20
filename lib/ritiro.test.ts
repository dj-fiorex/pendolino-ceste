import { afterEach, expect, test, vi } from "vitest";
import type { Id } from "@/convex/_generated/dataModel";
import type { Cliente } from "@/lib/cliente";
import type { FoundCesta } from "@/lib/ceste";
import type { RitiroDraft } from "@/lib/ritiro-draft";
import { Ritiro } from "@/lib/ritiro";
import { upload } from "@/lib/media";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const giuseppe: Cliente = {
  _id: "giuseppe" as Id<"clienti">,
  name: "Giuseppe",
  alias: [],
  phone: null,
  smsOptOut: false,
};
const cesta: FoundCesta = {
  _id: "cesta-17" as Id<"ceste">,
  numero: 17,
  codice: "400-R-017",
  portata: 400,
  state: "disponibile",
  cliente: null,
};
const draft: RitiroDraft = {
  cliente: giuseppe,
  ceste: [cesta],
  notKept: ["signature", "photo"],
};
const antonio: Cliente = {
  ...giuseppe,
  _id: "antonio" as Id<"clienti">,
  name: "Antonio",
};
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

function setup(initial: RitiroDraft | null = null) {
  let stored = initial === null ? null : JSON.stringify(initial);
  const drafts = {
    read: vi.fn((): RitiroDraft | null =>
      stored === null ? null : JSON.parse(stored),
    ),
    write: vi.fn((value: RitiroDraft) => {
      stored = JSON.stringify(value);
    }),
    clear: vi.fn(() => {
      stored = null;
    }),
  };
  const upload = vi.fn(async (_file: Blob) => "uploaded" as Id<"_storage">);
  const record = vi.fn(async () => null);
  const create = () => new Ritiro({ drafts, upload, record });
  return { create, drafts, upload, record, stored: () => stored };
}

test("offers a draft without restoring or overwriting it, then resumes only on request", () => {
  const env = setup(draft);
  const ritiro = env.create();
  expect(ritiro.getSnapshot()).toEqual({ phase: "loading" });
  ritiro.open();
  ritiro.open();
  expect(ritiro.getSnapshot()).toEqual({ phase: "offering", draft });
  expect(env.drafts.read).toHaveBeenCalledTimes(1);
  expect(env.drafts.write).not.toHaveBeenCalled();
  expect(env.drafts.clear).not.toHaveBeenCalled();
  ritiro.resume();
  expect(ritiro.getSnapshot()).toMatchObject({
    phase: "editing",
    cliente: giuseppe,
    ceste: [cesta],
    captured: { signature: null, photo: null },
    toRetake: ["signature", "photo"],
  });
});

test("preserves scans and missing-media reminders through repeated reloads until abandonment", () => {
  const env = setup(draft);
  for (let reload = 0; reload < 3; reload++) {
    const ritiro = env.create();
    ritiro.open();
    expect(ritiro.getSnapshot()).toMatchObject({ phase: "offering", draft });
    ritiro.resume();
    ritiro.addCesta(cesta);
    expect(ritiro.getSnapshot()).toMatchObject({ ceste: [cesta] });
  }
  const ritiro = env.create();
  ritiro.open();
  ritiro.abandon();
  expect(ritiro.getSnapshot()).toMatchObject({
    phase: "editing",
    cliente: null,
    ceste: [],
  });
  const next = env.create();
  next.open();
  expect(next.getSnapshot()).toMatchObject({
    phase: "editing",
    cliente: null,
    ceste: [],
  });
});

test("changing Cliente keeps scans, clears media and reminders, and rejects a late photo", async () => {
  const env = setup(draft);
  const ritiro = env.create();
  ritiro.open();
  ritiro.resume();
  await ritiro.capture("signature", new Blob(["Giuseppe's signature"]));
  const photo = deferred<Blob>();
  const capturing = ritiro.capture("photo", photo.promise);
  ritiro.changeCliente();
  expect(ritiro.getSnapshot()).toMatchObject({
    cliente: null,
    ceste: [cesta],
    captured: { signature: null, photo: null },
    toRetake: [],
  });
  const duringSearch = env.create();
  duringSearch.open();
  expect(duringSearch.getSnapshot()).toMatchObject({
    phase: "offering",
    draft: { cliente: giuseppe, ceste: [cesta] },
  });
  ritiro.chooseCliente(antonio);
  photo.resolve(new Blob(["Giuseppe's photo"]));
  await capturing;
  expect(ritiro.getSnapshot()).toMatchObject({
    cliente: antonio,
    ceste: [cesta],
    captured: { signature: null, photo: null },
    toRetake: [],
  });
  expect(JSON.parse(env.stored()!)).toEqual({
    cliente: antonio,
    ceste: [cesta],
    notKept: [],
  });
});

test("records despite optional upload failure, freezes edits, and clears the draft before success", async () => {
  const env = setup(draft);
  const ritiro = env.create();
  ritiro.open();
  ritiro.resume();
  const signature = new Blob(["signature"]);
  const photo = new Blob(["photo"]);
  await ritiro.capture("signature", signature);
  await ritiro.capture("photo", photo);
  const sending = deferred<Id<"_storage">>();
  env.upload
    .mockImplementationOnce(() => sending.promise)
    .mockRejectedValueOnce(new Error("offline"));
  const onSuccess = vi.fn();
  ritiro.subscribe(() => {
    if (ritiro.getSnapshot().phase === "recorded") onSuccess(env.stored());
  });
  const recording = ritiro.confirm();
  expect(ritiro.confirm()).toBe(recording);
  ritiro.changeCliente();
  ritiro.chooseCliente(antonio);
  ritiro.removeCesta(cesta._id);
  ritiro.abandon();
  await ritiro.capture("signature", new Blob(["wrong"]));
  expect(ritiro.getSnapshot()).toMatchObject({
    phase: "recording",
    cliente: giuseppe,
    ceste: [cesta],
    canConfirm: false,
  });
  expect(env.record).not.toHaveBeenCalled();
  sending.resolve("signature-id" as Id<"_storage">);
  await recording;
  expect(env.record).toHaveBeenCalledExactlyOnceWith({
    clienteId: giuseppe._id,
    cesteIds: [cesta._id],
    campagnaId: undefined,
    signatureId: "signature-id",
    photoId: undefined,
  });
  expect(ritiro.getSnapshot()).toEqual({
    phase: "recorded",
    cliente: giuseppe,
    count: 1,
    notUploaded: ["photo"],
  });
  expect(onSuccess).toHaveBeenCalledWith(null);
  ritiro.chooseCliente(antonio);
  ritiro.addCesta(cesta);
  expect(env.stored()).toBeNull();
  ritiro.startAnother();
  expect(ritiro.getSnapshot()).toMatchObject({
    phase: "editing",
    cliente: null,
    ceste: [],
    captured: { signature: null, photo: null },
    toRetake: [],
    failed: false,
  });
});

test("recording failure retains work and reuses successful uploads while retrying failed files", async () => {
  const env = setup(draft);
  const ritiro = env.create();
  ritiro.open();
  ritiro.resume();
  const signature = new Blob(["signature"]);
  const photo = new Blob(["photo"]);
  await ritiro.capture("signature", signature);
  await ritiro.capture("photo", photo);
  env.upload
    .mockResolvedValueOnce("signature-id" as Id<"_storage">)
    .mockRejectedValueOnce(new Error("photo failed"))
    .mockResolvedValueOnce("photo-id" as Id<"_storage">);
  env.record.mockRejectedValueOnce(new Error("recording failed"));
  await ritiro.confirm();
  expect(ritiro.getSnapshot()).toMatchObject({
    phase: "editing",
    failed: true,
    captured: { signature, photo },
    ceste: [cesta],
  });
  expect(env.stored()).not.toBeNull();
  expect(env.drafts.clear).not.toHaveBeenCalled();
  await ritiro.confirm();
  expect(env.upload.mock.calls.map(([file]) => file)).toEqual([
    signature,
    photo,
    photo,
  ]);
  expect(env.record).toHaveBeenLastCalledWith({
    clienteId: giuseppe._id,
    cesteIds: [cesta._id],
    campagnaId: undefined,
    signatureId: "signature-id",
    photoId: "photo-id",
  });
  expect(ritiro.getSnapshot()).toMatchObject({
    phase: "recorded",
    notUploaded: [],
  });
});

test("enforces Campagna eligibility and snapshots the choice at confirmation", async () => {
  const env = setup(draft);
  const ritiro = env.create();
  ritiro.setCampagna({ mustAsk: true });
  ritiro.open();
  await ritiro.confirm();
  ritiro.resume();
  expect(ritiro.getSnapshot()).toMatchObject({
    mustAsk: true,
    canConfirm: false,
  });
  await ritiro.confirm();
  expect(env.record).not.toHaveBeenCalled();
  const campagnaId = "campagna-2026" as Id<"campagne">;
  ritiro.setCampagna({ mustAsk: false, campagnaId });
  const recording = ritiro.confirm();
  ritiro.setCampagna({ mustAsk: true });
  env.record.mockRejectedValueOnce(new Error("try again"));
  await recording;
  expect(env.record).toHaveBeenCalledWith(
    expect.objectContaining({ campagnaId }),
  );
  expect(ritiro.getSnapshot()).toMatchObject({
    phase: "editing",
    mustAsk: true,
    canConfirm: false,
  });
  ritiro.setCampagna({ mustAsk: false });
  await ritiro.confirm();
  expect(ritiro.getSnapshot()).toMatchObject({ phase: "recorded" });
});

test("removing media invalidates pending captures and uploaded identifiers without erasing restored reminders", async () => {
  const env = setup(draft);
  const ritiro = env.create();
  ritiro.open();
  ritiro.resume();
  const signature = new Blob(["signature"]);
  await ritiro.capture("signature", signature);
  env.record.mockRejectedValueOnce(new Error("failed"));
  await ritiro.confirm();
  const photo = deferred<Blob>();
  const capture = ritiro.capture("photo", photo.promise);
  ritiro.removeMedia("photo");
  ritiro.removeMedia("signature");
  photo.resolve(new Blob(["late photo"]));
  await capture;
  expect(ritiro.getSnapshot()).toMatchObject({
    captured: { signature: null, photo: null },
    toRetake: ["signature", "photo"],
  });
  await ritiro.capture("signature", signature);
  await ritiro.confirm();
  expect(env.upload).toHaveBeenCalledTimes(2);
});

test("a slow upload can finish after twelve seconds without the application aborting it", async () => {
  vi.useFakeTimers();
  // Drive the timeout API with the test clock, rather than Node's native timer.
  vi.spyOn(AbortSignal, "timeout").mockImplementation((milliseconds) => {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), milliseconds);
    return controller.signal;
  });
  const sent = deferred<Response>();
  vi.stubGlobal(
    "fetch",
    vi.fn((_url: string, options: RequestInit) => {
      options.signal?.addEventListener("abort", () =>
        sent.reject(new Error("aborted")),
      );
      return sent.promise;
    }),
  );
  const env = setup(draft);
  const ritiro = new Ritiro({
    drafts: env.drafts,
    record: env.record,
    upload: (file) => upload("https://storage.example/upload", file),
  });
  ritiro.open();
  ritiro.resume();
  await ritiro.capture("photo", new Blob(["slow photo"]));
  const recording = ritiro.confirm();
  await vi.advanceTimersByTimeAsync(13_000);
  expect(ritiro.getSnapshot().phase).toBe("recording");
  expect(env.record).not.toHaveBeenCalled();
  sent.resolve(new Response(JSON.stringify({ storageId: "photo-id" })));
  await recording;
  expect(env.record).toHaveBeenCalledWith(
    expect.objectContaining({ photoId: "photo-id" }),
  );
  expect(ritiro.getSnapshot()).toMatchObject({
    phase: "recorded",
    notUploaded: [],
  });
});

test.each(["read", "write", "clear"] as const)(
  "%s storage failure does not prevent recording",
  async (operation) => {
    const env = setup();
    env.drafts[operation].mockImplementation(() => {
      throw new Error("storage refused");
    });
    const ritiro = env.create();
    ritiro.open();
    ritiro.chooseCliente(giuseppe);
    ritiro.addCesta(cesta);
    await ritiro.confirm();
    expect(ritiro.getSnapshot()).toMatchObject({ phase: "recorded", count: 1 });
    expect(env.record).toHaveBeenCalledTimes(1);
  },
);

test.each(["abandon", "confirm"] as const)(
  "failed removal after %s stays terminal in memory but can offer the old draft after reload",
  async (finish) => {
    const env = setup(draft);
    env.drafts.clear.mockImplementation(() => {
      throw new Error("cannot remove");
    });
    const ritiro = env.create();
    ritiro.open();
    if (finish === "confirm") ritiro.resume();
    await ritiro[finish]();
    expect(ritiro.getSnapshot().phase).toBe(
      finish === "confirm" ? "recorded" : "editing",
    );
    const writes = env.drafts.write.mock.calls.length;
    ritiro.setCampagna({ mustAsk: false });
    expect(env.drafts.write).toHaveBeenCalledTimes(writes);
    const reloaded = env.create();
    reloaded.open();
    expect(reloaded.getSnapshot()).toMatchObject({ phase: "offering" });
  },
);

test("drafts contain only recovery fields, even when selected objects carry extra runtime fields", async () => {
  const env = setup();
  const ritiro = env.create();
  ritiro.open();
  ritiro.chooseCliente({
    ...giuseppe,
    signature: "secret signature",
  } as Cliente);
  ritiro.addCesta({ ...cesta, photo: "secret photo" } as FoundCesta);
  await ritiro.capture("signature", new Blob(["secret signature"]));
  await ritiro.capture("photo", new Blob(["secret photo"]));
  expect(JSON.parse(env.stored()!)).toEqual(draft);
  const reload = env.create();
  reload.open();
  reload.resume();
  expect(reload.getSnapshot()).toMatchObject({
    captured: { signature: null, photo: null },
    toRetake: ["signature", "photo"],
  });
});

test("concurrent captures update only their own media kind and the latest capture wins", async () => {
  const env = setup(draft);
  const ritiro = env.create();
  ritiro.open();
  ritiro.resume();
  const oldPhoto = deferred<Blob>();
  const oldCapture = ritiro.capture("photo", oldPhoto.promise);
  const signature = new Blob(["new signature"]);
  const photo = new Blob(["new photo"]);
  await ritiro.capture("signature", signature);
  await ritiro.capture("photo", photo);
  oldPhoto.resolve(new Blob(["old photo"]));
  await oldCapture;
  expect(ritiro.getSnapshot()).toMatchObject({
    captured: { signature, photo },
    toRetake: [],
  });
});

test.each(["replace", "change Cliente", "abandon", "start another"] as const)(
  "%s invalidates uploaded identifiers",
  async (operation) => {
    const env = setup(draft);
    const ritiro = env.create();
    ritiro.open();
    ritiro.resume();
    const signature = new Blob(["signature"]);
    await ritiro.capture("signature", signature);
    if (operation !== "start another")
      env.record.mockRejectedValueOnce(new Error("retry"));
    await ritiro.confirm();
    if (operation === "change Cliente") ritiro.changeCliente();
    if (operation === "abandon") ritiro.abandon();
    if (operation === "start another") ritiro.startAnother();
    ritiro.chooseCliente(giuseppe);
    ritiro.addCesta(cesta);
    await ritiro.capture("signature", signature);
    await ritiro.confirm();
    expect(env.upload).toHaveBeenCalledTimes(2);
  },
);

test("the last Cesta removed clears the draft and prevents confirmation", async () => {
  const env = setup(draft);
  const ritiro = env.create();
  ritiro.open();
  ritiro.resume();
  ritiro.removeCesta(cesta._id);
  await ritiro.confirm();
  expect(env.stored()).toBeNull();
  expect(env.record).not.toHaveBeenCalled();
});

test.each(["signature", "photo", "both"] as const)(
  "recording succeeds if %s upload fails",
  async (failure) => {
    const env = setup(draft);
    const ritiro = env.create();
    ritiro.open();
    ritiro.resume();
    const signature = new Blob(["signature"]);
    const photo = new Blob(["photo"]);
    await ritiro.capture("signature", signature);
    await ritiro.capture("photo", photo);
    env.upload.mockImplementation(async (file) => {
      if (
        failure === "both" ||
        file === (failure === "signature" ? signature : photo)
      )
        throw new Error("upload failed");
      return "kept" as Id<"_storage">;
    });
    await ritiro.confirm();
    expect(ritiro.getSnapshot()).toMatchObject({
      phase: "recorded",
      notUploaded: failure === "both" ? ["signature", "photo"] : [failure],
    });
  },
);

test("callers cannot edit a snapshot behind the module's lifecycle rules", () => {
  const env = setup(draft);
  const ritiro = env.create();
  ritiro.open();
  ritiro.resume();
  const snapshot = ritiro.getSnapshot();
  if (snapshot.phase !== "editing") throw new Error("Expected editable Ritiro");
  expect(() => {
    snapshot.cliente!.name = "Antonio";
  }).toThrow();
  expect(() => {
    snapshot.ceste[0].codice = "wrong";
  }).toThrow();
  expect(() => {
    snapshot.cliente!.alias.push("wrong");
  }).toThrow();
  expect(ritiro.getSnapshot()).toMatchObject({
    cliente: giuseppe,
    ceste: [cesta],
  });
});
