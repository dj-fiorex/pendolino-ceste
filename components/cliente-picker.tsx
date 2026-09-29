"use client";

import { useMutation, usePaginatedQuery } from "convex/react";
import { useEffect, useState } from "react";
import { ClienteForm } from "@/components/cliente-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/convex/_generated/api";
import {
  comparableName,
  MAX_SEARCH_CANDIDATES,
  MAX_SEARCH_RESULTS,
} from "@/convex/schema";
import { clienteLabel, type Cliente } from "@/lib/cliente";

/**
 * Finding whoever is at the counter: search by name or by Soprannome, and
 * enter them on the spot when they have never been here before. Both the
 * Ritiro and the registry start here, and either way the answer is one Cliente.
 */
export function ClientePicker({
  onPick,
  pickLabel,
  creating: controlledCreating,
  onCreatingChange,
  showCreateAction = true,
}: {
  onPick: (cliente: Cliente) => void;
  /** What choosing a Cliente does next, for whoever reads the screen. */
  pickLabel: string;
  /** Lets a screen place its own create action without changing the flow. */
  creating?: boolean;
  onCreatingChange?: (creating: boolean) => void;
  showCreateAction?: boolean;
}) {
  const [term, setTerm] = useState("");
  const [localCreating, setLocalCreating] = useState(false);
  const createCliente = useMutation(api.clienti.create);
  const creating = controlledCreating ?? localCreating;
  const setCreating = (next: boolean) => {
    setLocalCreating(next);
    onCreatingChange?.(next);
  };

  if (creating) {
    return (
      <ClienteForm
        initial={{ name: term, alias: [], phone: "", smsOptOut: false }}
        submitLabel="Crea il Cliente"
        onPickNamesake={onPick}
        onCancel={() => setCreating(false)}
        onSubmit={async (fields) => {
          // A Cliente entered at the counter receives the mill's SMS: nobody
          // has asked not to yet, and the switch that says so is on their own
          // page rather than on this form.
          const cliente = await createCliente({
            name: fields.name,
            alias: fields.alias,
            phone: fields.phone,
          });
          onPick(cliente);
        }}
      />
    );
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor="cliente-search">Cerca il Cliente</Label>
        <Input
          id="cliente-search"
          name="term"
          type="search"
          autoComplete="off"
          placeholder="Nome o soprannome"
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          className="h-12 text-base"
        />
      </div>

      <ClienteSearchResults
        key={comparableName(term)}
        term={comparableName(term)}
        onPick={onPick}
        pickLabel={pickLabel}
      />

      {showCreateAction ? (
        <Button
          variant="outline"
          className="h-12 text-base"
          onClick={() => setCreating(true)}
        >
          Nuovo Cliente
        </Button>
      ) : null}
    </div>
  );
}

// Ten pages target 200 candidates before asking the Operatore to continue.
// Convex may resize/split reactive pages; each backend request also has a cap.
const AUTO_SEARCH_PAGES = 10;

/** A new search term remounts this component, discarding its pages and budget. */
function ClienteSearchResults({
  term,
  onPick,
  pickLabel,
}: {
  term: string;
  onPick: (cliente: Cliente) => void;
  pickLabel: string;
}) {
  const { results, status, loadMore } = usePaginatedQuery(
    api.clienti.search,
    { term },
    { initialNumItems: MAX_SEARCH_RESULTS },
  );
  const [requestedPages, setRequestedPages] = useState(1);
  const [pageBudget, setPageBudget] = useState(AUTO_SEARCH_PAGES);
  const unique = [
    ...new Map(
      results
        .filter((cliente) => cliente !== null)
        .map((cliente) => [cliente._id, cliente]),
    ).values(),
  ];
  const found = unique
    .slice(0, MAX_SEARCH_RESULTS)
    .sort((one, other) =>
      comparableName(one.name).localeCompare(comparableName(other.name)),
    );
  const needsMore = found.length < MAX_SEARCH_RESULTS;
  // Native search can report isDone after only its first 1024 candidates.
  // Null placeholders retain the rejected-candidate count without their data.
  const searchLimitReached =
    term !== "" && results.length >= MAX_SEARCH_CANDIDATES && needsMore;
  const canContinue =
    status === "CanLoadMore" && needsMore && !searchLimitReached;
  const continueAutomatically = canContinue && requestedPages < pageBudget;

  useEffect(() => {
    if (continueAutomatically) {
      loadMore(MAX_SEARCH_RESULTS);
      setRequestedPages(requestedPages + 1);
    }
  }, [continueAutomatically, loadMore, requestedPages]);

  const searching =
    status === "LoadingFirstPage" ||
    status === "LoadingMore" ||
    continueAutomatically;
  const paused = canContinue && !continueAutomatically;
  const moreResults =
    !needsMore &&
    (status !== "Exhausted" || unique.length > MAX_SEARCH_RESULTS);

  return (
    <div className="grid gap-4" aria-busy={searching}>
      {found.length > 0 && (
        <ul className="grid gap-2">
          {found.map((cliente) => (
            <li key={cliente._id}>
              <button
                type="button"
                aria-label={`${pickLabel}: ${clienteLabel(cliente)}`}
                onClick={() => onPick(cliente)}
                className="w-full rounded-lg border bg-card px-4 py-3 text-left transition-colors hover:bg-accent"
              >
                <p className="font-display text-lg font-bold">
                  {clienteLabel(cliente)}
                </p>
                <p className="text-sm text-muted-foreground">
                  {cliente.phone ?? "Telefono non lo sappiamo"}
                </p>
              </button>
            </li>
          ))}
        </ul>
      )}
      <div role="status" className="text-sm text-muted-foreground">
        {searching ? (
          <p>Cerco i Clienti…</p>
        ) : searchLimitReached ? (
          <p>
            Ricerca troppo ampia. Scrivi un nome o un soprannome più preciso.
          </p>
        ) : paused ? (
          <p>
            Ricerca non completata. Continua a cercare o scrivi qualche lettera
            in più.
          </p>
        ) : found.length === 0 ? (
          <p>Nessun Cliente con questo nome.</p>
        ) : moreResults ? (
          <p>Mostro i primi 20 risultati: scrivi qualche lettera in più.</p>
        ) : null}
      </div>
      {paused && !searchLimitReached && (
        <Button
          type="button"
          variant="outline"
          className="h-12"
          onClick={() => setPageBudget(pageBudget + AUTO_SEARCH_PAGES)}
        >
          Continua a cercare
        </Button>
      )}
    </div>
  );
}
