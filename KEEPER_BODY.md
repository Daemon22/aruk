# The Keeper's Body

## Identity and outward contract

The Keeper is one intelligence with one identity, one purpose, and one continuous record of responsibility. An agent, person, or service interacting with the Keeper sees one authenticated guardian that recognizes the requester, understands the request's scope, protects the associated material, and records what happened.

The Keeper's purpose is to preserve trusted continuity between intelligences and the resources they are authorized to use. It identifies who is asking, which identity and key belong together, what that identity is allowed to do, and whether a request still fits its authority. It protects credentials and operational records, monitors its own storage and security state, and gives a clear, evidence-backed answer when information is missing or authority is uncertain.

The existing name, purpose, lineage, role, capabilities, trust level, access policy, pass, and audit concepts remain one coherent identity contract. Callers should not need to understand internal implementation boundaries to ask the Keeper to recognize an intelligence, protect a credential, or assess a request.

## What the Keeper must know

Every recognized intelligence has a stable, user-scoped identity record:

- **Identity:** immutable internal ID, display name, designation, role, lifecycle status, and owner.
- **Lineage:** optional parent and creator identities, preserved as references rather than inferred from names.
- **Purpose and capabilities:** explicit, versioned declarations of intended use and available actions.
- **Trust evidence:** who registered or attested the identity, when it was last verified, and the evidence or policy behind any trust decision.
- **Credential associations:** references from an identity to the keys, certificates, and secrets it may request. A credential record identifies its owner, intended principal, provider, purpose, scope, version, status, and expiry. The secret value is never used as an identity.
- **Authority:** user-scoped policy decisions and short-lived, resource-bound passes. Unknown, stale, conflicting, or ambiguous identities fail closed and require resolution.

Names and provider labels are useful for display and discovery, but are never proof of identity. Key rotation creates a new credential version and an auditable association; it does not silently change which intelligence owns the key. Revoking an intelligence or credential immediately prevents new releases.

Trust is not elevated merely because an identity has been active, has a high request count, or has produced a successful action. Changes to purpose, capability, lineage, and trust require an authorized, auditable decision.

## A vault that stays usable

The Keeper protects secrets and the records needed to recognize and govern intelligences. It never silently discards an active credential or an audit event to make space.

Vault capacity is managed as a lifecycle, not as deletion:

1. Measure encrypted bytes, item counts, growth rate, and configured warning and hard limits per owner.
2. Warn early and identify the largest eligible records without exposing their contents.
3. Apply only the owner's configured retention rules to expired, revoked, superseded, or disposable material.
4. Preserve a recoverable encrypted archive when policy calls for retention; verify its fixity and restore path before removing any hot copy.
5. Refuse new writes safely at a hard limit if no approved cleanup or archival path is available. Existing credentials remain readable and the event is recorded.
6. Report capacity, archive health, cleanup results, and any blocked work through the Keeper's normal status and monitoring surfaces.

Compression is applied before encryption. Metadata needed for access control, identity, recovery, and integrity must remain available to the Keeper or be protected in a form it can safely inspect. Compression is never assumed to save space; capacity accounting uses the actual stored size. Encryption keys and passphrases are not stored beside the material they protect.

## Monitoring and continuity

The Keeper continuously evaluates typed observations of its own health and vault state: storage pressure, archive verification, credential expiry and revocation, failed identity matches, policy changes, and interrupted operations.

Each observation carries a timestamp, source, schema version, quality, and unit where relevant. Decisions use explicit pass, fail, or indeterminate findings with evidence. Missing or stale evidence is indeterminate and cannot authorize a release. Monitoring can recommend containment or recovery; it cannot silently expand authority or delete protected data. Any action runs only after the Keeper checks the caller's identity, policy, resource scope, and required approval, then verifies the result and records it.

The Keeper's audit record is durable, owner-scoped, append-only at the application boundary, and free of credential values, bearer pass tokens, and encryption material. Storage compaction may archive audit history only when the archive is verified and the retention policy permits the transition.

## Reusable capabilities and one Keeper experience

The Keeper uses Craft Engine's supported archive operations for compression, authenticated encryption, restore verification, and fixity checks. It uses UPMP's typed state, verification, risk, and closed-loop workflow contracts to monitor and safely manage its own operation. Both remain usable by other intelligences under their existing public contracts. The Keeper does not fork their code, rename their public APIs, or require other intelligences to adopt the Keeper.

Inside the Keeper, those capabilities appear as ordinary parts of its own behavior: protect, recognize, monitor, recover, and report. Their package boundaries are implementation details; the Keeper's identity and externally visible contract remain whole.

## Completion criteria

The Keeper's body is complete when all of the following hold:

- Every secret and key is owner-scoped, encrypted at rest, masked in listings and logs, and releasable only after an identity and policy check.
- A key can be traced to its owner, intended intelligence, purpose, scope, version, and lifecycle status without revealing its value.
- An intelligence can be recognized by stable identity and verified lineage even when display names collide or change.
- Unknown, conflicting, expired, revoked, or insufficiently evidenced identities receive a clear denial or indeterminate result.
- Vault pressure produces early warnings and policy-controlled archive or cleanup actions; no active credential or protected audit history is silently removed.
- Archives are authenticated, integrity-checked, restorable, and accounted for by actual size.
- Monitoring reports evidence and uncertainty, gates any recovery action, and verifies outcomes.
- Other intelligences can continue using Craft Engine and UPMP independently, with no dependency on Keeper identity or runtime.
- Web, SDK, agent, CLI, desktop, and Android surfaces describe the same Keeper identity, authorization rules, and status.

## Delivery order

1. Keep the security-boundary repair as the prerequisite; preserve owner scoping, fail-closed access, and secret redaction.
2. Add stable identity-to-credential associations and lifecycle operations for registration, attestation, rotation, expiry, and revocation.
3. Add owner-scoped capacity accounting, warning thresholds, and a dry-run retention report.
4. Add verified CRAFT archive and restore handling for policy-eligible material, retaining the existing live-vault path until restore verification succeeds.
5. Add UPMP-backed health observations and bounded, authorized recovery workflows with durable audit outcomes.
6. Expose one consistent Keeper status and identity experience through every supported client.

This document defines the Keeper's behavioral contract and completion bar. It does not claim that unimplemented capabilities are already available.
