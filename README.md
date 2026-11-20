<p align="center"><a href="https://veilops.tech"><img src="https://raw.githubusercontent.com/veilops-protocol/veilops/main/docs/assets/banner.png" alt="VEILOPS: Privacy is not the absence of proof. It's proof without exposure." width="100%"></a></p>

# veilops-sdk

TypeScript SDK for VEILOPS: process a financial operation locally and get a publishable, verifiable record, an encrypted envelope for authorized viewers, and a commitment opening for selective disclosure.

> **Status: experimental.** Implemented and integration-tested in the monorepo; built on proof code that has **not been audited**. Not published to npm. No releases.

**Mirror of** [`veilops-protocol/veilops`](https://github.com/veilops-protocol/veilops) → `packages/sdk/` (see [MIRROR.md](MIRROR.md)). File issues and pull requests on the monorepo.

## What it does

`createClient().process(input, policy)` runs five local stages, `created → encrypted → policy → proof → verified`:

1. seals `{ name, recipient, amount, memo }` with AES-256-GCM for the owner and each viewer (X25519 + HKDF-SHA256 key wraps);
2. evaluates the policy (category, asset and mode rules; amount within the limit); a violation throws `PolicyViolation`;
3. produces a `veilops-range-v1` proof that the committed amount is `≤` the policy limit, and signs the record with Ed25519;
4. verifies its own output with the same `verifyRecord` any third party uses.

No network calls; no key persistence.

## Install

Not on npm. The package depends on `@veilops/shared`, `@veilops/encryption`, `@veilops/policy-engine` and `@veilops/proof-engine`, and its entry point is TypeScript source, so use it from the monorepo:

```bash
git clone https://github.com/veilops-protocol/veilops.git
cd veilops && npm ci
```

## Usage

```ts
import { createClient } from '@veilops/sdk';
import { definePolicy } from '@veilops/policy-engine';

const veil = createClient({ viewers: [auditorPublicKeyHex] });
const { record, envelope, opening } = await veil.process(
  { name: 'Payout', category: 'payroll', recipient: 'contributor-042', amount: 812_345,
    asset: 'USDC', policyLimit: 1_500_000, mode: 'amount-and-recipient' },
  definePolicy({ name: 'payroll', maxAmount: 2_000_000 }),
);
veil.verify(record).valid; // true
```

Public metadata (category, asset, mode, timestamps, policy limit, commitment, envelope digest, and the recipient in `amount-only` mode) is visible to everyone. See the [security model](https://github.com/veilops-protocol/veilops/blob/main/docs/security.md).

License: Apache-2.0.
