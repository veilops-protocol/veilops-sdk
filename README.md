# @veilops/sdk

**Status: implemented, integration-tested.** Builds on experimental proof code; not audited. Not published to npm.

The application entry point. `process()` runs the five-stage lifecycle `created → encrypted → policy → proof → verified` locally. No network calls, no key persistence.

```ts
import { createClient, PolicyViolation } from '@veilops/sdk';
import { definePolicy } from '@veilops/policy-engine';

const veil = createClient({ viewers: [auditorPublicKeyHex] }); // signingKey / owner default to fresh keys
const policy = definePolicy({ name: 'payroll', maxAmount: 2_000_000 });

const { record, envelope, opening, verification, stages } = await veil.process(
  { name: 'Payout', category: 'payroll', recipient: 'contributor-042', amount: 812_345,
    asset: 'USDC', policyLimit: 1_500_000, mode: 'amount-and-recipient' },
  policy,
  { onStage: e => console.log(e.stage, e.detail) },
);
```

- `record`: `PublicRecord`, safe to publish (the recipient is included only in `amount-only` mode).
- `envelope`: encrypted `{ name, recipient, amount, memo }` for the owner and viewers.
- `opening`: `{ value, blinding }` of the amount commitment; private.
- The effective limit is `min(policy.maxAmount, input.policyLimit)`.
- A failing rule throws `PolicyViolation` (with `.result`), and no proof is produced.

The client also returns `verify`, `signingPublicKey`, `ownerPublicKey` and `owner`. The package re-exports `@veilops/shared` and the namespaces `encryption`, `policy`, `proofs`, plus `pseudonym(recipient, salt)`.

Runnable examples: [`examples/`](../../examples). License: Apache-2.0.
