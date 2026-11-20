/**
 * @veilops/sdk — the TypeScript entry point for applications.
 *
 *   const veil = createClient({ signingKey, viewers: [auditorPublicKey] });
 *   const result = await veil.process(input, policy, { onStage });
 *   // result.record   → safe to publish (no plaintext amount, no plaintext recipient under private modes)
 *   // result.envelope → encrypted payload for the owner and authorized viewers
 *   // result.opening  → commitment opening, share only for selective disclosure
 *
 * Everything runs locally. The SDK makes no network calls and never persists keys.
 */
import { PROTOCOL_VERSION, randomId, sha256Hex, type OperationInput, type PublicRecord } from '@veilops/shared';
import { seal, envelopeDigest, generateViewingKeyPair, type Envelope, type KeyPair } from '@veilops/encryption';
import { evaluate, policyId, validatePolicy, type Policy, type PolicyResult } from '@veilops/policy-engine';
import { provePolicy, attest, encodeProof, verifyRecord, generateSigningKey, PROOF_SYSTEM, type SigningKey, type RecordVerification } from '@veilops/proof-engine';

export * from '@veilops/shared';
export * as encryption from '@veilops/encryption';
export * as policy from '@veilops/policy-engine';
export * as proofs from '@veilops/proof-engine';

export type StageName = 'created' | 'encrypted' | 'policy' | 'proof' | 'verified';
export interface StageEvent { stage: StageName; at: string; ms: number; detail: string; ok: boolean }

export interface ProcessResult {
  operationId: string;
  record: PublicRecord;
  envelope: Envelope;
  policy: PolicyResult;
  verification: RecordVerification;
  opening: { value: string; blinding: string };
  stages: StageEvent[];
}

export class PolicyViolation extends Error {
  constructor(public result: PolicyResult) {
    super('Operation violates policy: ' + result.checks.filter(c => !c.passed).map(c => c.rule).join(', '));
  }
}

export interface ClientOptions {
  signingKey?: SigningKey;
  owner?: KeyPair;
  /** Additional X25519 public keys that may decrypt the envelope (auditors, finance). */
  viewers?: string[];
}

export function createClient(opts: ClientOptions = {}) {
  const signingKey = opts.signingKey ?? generateSigningKey();
  const owner = opts.owner ?? generateViewingKeyPair();
  const viewers = opts.viewers ?? [];

  async function process(input: OperationInput, pol: Policy, hooks: { onStage?: (e: StageEvent) => void | Promise<void> } = {}): Promise<ProcessResult> {
    const stages: StageEvent[] = [];
    let last = Date.now();
    const emit = async (stage: StageName, detail: string, ok = true) => {
      const t = Date.now();
      const e = { stage, at: new Date(t).toISOString(), ms: t - last, detail, ok };
      last = t;
      stages.push(e);
      await hooks.onStage?.(e);
    };

    if (!Number.isSafeInteger(input.policyLimit) || input.policyLimit <= 0) throw new Error('policyLimit must be a positive integer (minor units)');
    if (!Number.isSafeInteger(input.amount) || input.amount < 0) throw new Error('amount must be a non-negative integer (minor units)');
    const operationId = randomId('op');
    const createdAt = new Date().toISOString();
    await emit('created', `operation ${operationId} created`);

    const envelope = await seal(
      JSON.stringify({ name: input.name, recipient: input.recipient, amount: input.amount, memo: input.memo ?? null }),
      [owner.publicKey, ...viewers],
      `${PROTOCOL_VERSION}|${operationId}`,
    );
    await emit('encrypted', `AES-256-GCM envelope sealed for ${envelope.keys.length} key(s)`);

    const effective: Policy = { ...pol, maxAmount: Math.min(pol.maxAmount, input.policyLimit) };
    validatePolicy(effective);
    const result = evaluate(effective, input);
    await emit('policy', `${result.checks.filter(c => c.passed).length}/${result.checks.length} rules passed`, result.passed);
    if (!result.passed) throw new PolicyViolation(result);

    const prover = provePolicy({
      operationId, policyId: policyId(effective), maxAmount: effective.maxAmount, rangeBits: effective.rangeBits,
      asset: input.asset, category: input.category, amount: input.amount,
    });
    await emit('proof', `${PROOF_SYSTEM} proof ${prover.proofId} generated in ${prover.timings.proveMs} ms`);

    const recipientPublic = input.mode === 'amount-only';
    const record = attest({
      version: PROTOCOL_VERSION,
      operationId,
      proofId: prover.proofId,
      createdAt,
      category: input.category,
      asset: input.asset,
      mode: input.mode,
      policy: { id: prover.publicInputs.policyId, maxAmount: effective.maxAmount, rangeBits: effective.rangeBits },
      amountCommitment: prover.publicInputs.amountCommitment,
      envelopeDigest: envelopeDigest(envelope),
      ...(recipientPublic ? { recipient: input.recipient } : {}),
      proofSystem: PROOF_SYSTEM,
      proof: encodeProof(prover.proof),
    }, signingKey);

    const verification = verifyRecord(record);
    await emit('verified', verification.valid ? `independent verification passed in ${verification.verifyMs} ms` : 'verification FAILED', verification.valid);

    return { operationId, record, envelope, policy: result, verification, opening: prover.opening, stages };
  }

  return { process, verify: verifyRecord, signingPublicKey: signingKey.publicKey, ownerPublicKey: owner.publicKey, owner };
}

/** Hash of a recipient identifier, for apps that want a stable pseudonym instead of a public address. */
export const pseudonym = (recipient: string, salt: string) => 'rcp_' + sha256Hex(salt + '|' + recipient).slice(0, 16);
