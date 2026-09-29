# Use the saved Cliente after creation

Status: agreed and implemented.

## Agreed scope

After an Operatore creates a Cliente, the screen must use the values saved by
the backend. The picker currently rebuilds the Cliente from typed fields, so
the selected name and Alias can differ from the saved values.

This change covers selection immediately after creation. It does not add live
updates to a selected Cliente or change how a Ritiro draft is restored.
The existing name and telephone rules in ADR-0010 and ADR-0009 still apply.

## Agreed interface

The creation module returns the saved Cliente, including its identifier, name,
Alias, telephone and Sms preference. It uses the existing public projection.
The picker passes this result to selection without rebuilding any fields.
Callers that need only the identifier take it from the returned Cliente.

Returning the saved values with creation avoids a separate read before the
Operatore can continue.

## Verification for implementation

- Compare the returned Cliente with a subsequent read, including name casing,
  Alias whitespace, telephone normalization and default Sms preference.
- Verify that the picker passes the returned Cliente to selection unchanged.
- Update callers and tests that currently expect creation to return only an
  identifier, then run the relevant tests and type checks.

## Verification result

All 258 tests pass, including the creation result and picker selection checks.
Type checking passes. The backend was pushed successfully to the development
deployment `agile-shrimp-281`. Production was not deployed.

The return type changes from an identifier to a Cliente. Release the updated
picker with the backend change; an older picker expects the previous result.
