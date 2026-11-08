# 0001: Edit content streams, no overlays

## Context
The product promise is real PDF editing, not whiteout plus new text.

## Decision
Rewrite operators in page content streams and update font resources.

## Consequences
We need our own interpreter and font handling. Export is harder, output is correct.
