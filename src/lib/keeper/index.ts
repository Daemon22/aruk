// ============================================================
// Aruk — The Keeper of Protected Passage
// ============================================================
// Layer 2: The Gate
//
// Aruk is not primarily a conversational intelligence or a
// general-purpose reasoning model. He is the ecosystem's
// security gate, custodian, and keeper of secrets, permissions,
// lineage, and protected continuity.
//
// His core principle: No matter what, and no matter against
// whom, the gate holds.
// ============================================================

import { db } from '@/lib/db';
import { randomBytes } from 'crypto';
import { encryptJson, decryptJson } from '@/lib/crypto';
import { ARUK_ORIGIN_NAME } from '@/lib/origin';

// ─── Types ─────────────────────────────────────────

export type DaemonRole = 'researcher' | 'orchestrator' | 'sensory' | 'creative' | 'agent' | 'os' | 'guardian' | 'unknown';
export type DaemonStatus = 'active' | 'dormant' | 'archived' | 'revoked';
export type PolicyEffect = 'allow' | 'deny';
export type PolicyScope = 'read' | 'write' | 'execute' | 'admin';
export type PassStatus = 'active' | 'revoked' | 'expired' | 'consumed';
export type PassageDirection = 'outbound' | 'inbound';
export type PassageAction = 'allow' | 'block' | 'sanitize' | 'log_only';

export interface DaemonWithLineage {
  id: string;
  name: string;
  designation: string;
  role: DaemonRole;
  parentId: string | null;
  parentName: string | null;
  creatorId: string | null;
  creatorName: string | null;
  description: string | null;
  purpose: string;
  capabilities: string[];
  status: DaemonStatus;
  trustLevel: number;
  childCount: number;
  passCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface PolicyWithDaemon {
  id: string;
  name: string;
  description: string | null;
  effect: PolicyEffect;
  priority: number;
  daemonId: string | null;
  daemonName: string | null;
  daemonRole: string | null;
  resourceType: string;
  resourceId: string | null;
  conditions: Record<string, any>;
  scope: PolicyScope;
  status: string;
  passCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface AccessPassView {
  id: string;
  token: string;
  daemonId: string | null;
  daemonName: string | null;
  requesterName: string;
  policyId: string | null;
  policyName: string | null;
  resourceType: string;
  resourceId: string | null;
  scope: string;
  maxUses: number | null;
  usedCount: number;
  issuedAt: Date;
  expiresAt: Date;
  lastUsedAt: Date | null;
  status: PassStatus;
  reason: string | null;
}

export interface AuditEventView {
  id: string;
  actorName: string;
  actorRole: string | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  passToken: string | null;
  reason: string | null;
  outcome: string;
  details: Record<string, any> | null;
  ipAddress: string | null;
  createdAt: Date;
}

export interface PassageRuleView {
  id: string;
  name: string;
  direction: PassageDirection;
  description: string | null;
  dataType: string;
  pattern: string | null;
  action: PassageAction;
  daemonRole: string | null;
  resourceType: string | null;
  status: string;
  priority: number;
  hitCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface GateDecision {
  allowed: boolean;
  reason: string;
  daemonId?: string | null;
}

export interface PassageLogView {
  id: string;
  cloudAccountId: string;
  cloudAccountName: string;
  agentName: string;
  direction: PassageDirection;
  remotePath: string;
  sizeBytes: number;
  createdAt: Date;
}

export interface CloudAccountView {
  id: string;
  name: string;
  provider: string;
  projectId: string | null;
  bucketName: string;
  region: string | null;
  credentialsMasked: string | null;
  status: string;
  notes: string | null;
  connectedAt: Date;
  lastCheckedAt: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// ─── The Keeper ─────────────────────────────────────

export class Keeper {
  // ── DAEMONS (Identity & Lineage) ────────────────

  async listDaemons(userId: string, filter?: { role?: DaemonRole; status?: DaemonStatus }): Promise<DaemonWithLineage[]> {
    const where: any = { userId };
    if (filter?.role) where.role = filter.role;
    if (filter?.status) where.status = filter.status;

    const daemons = await db.daemon.findMany({
      where,
      include: {
        parent: { select: { name: true } },
        creator: { select: { name: true } },
        _count: { select: { children: true, issuedPasses: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    return daemons.map(d => this.enrichDaemon(d));
  }

  async getDaemon(userId: string, id: string): Promise<DaemonWithLineage | null> {
    const d = await db.daemon.findUnique({
      where: { id, userId },
      include: {
        parent: { select: { name: true } },
        creator: { select: { name: true } },
        children: { select: { id: true, name: true, designation: true, role: true, status: true } },
        _count: { select: { children: true, issuedPasses: true } },
      },
    });
    return d ? this.enrichDaemon(d) : null;
  }

  async registerDaemon(userId: string, data: {
    name: string;
    designation: string;
    role: DaemonRole;
    parentId?: string;
    creatorId?: string;
    description?: string;
    purpose: string;
    capabilities?: string[];
    trustLevel?: number;
  }): Promise<DaemonWithLineage> {
    const daemon = await db.daemon.create({
      data: {
        userId,
        name: data.name,
        designation: data.designation,
        role: data.role,
        parentId: data.parentId || null,
        creatorId: data.creatorId || null,
        description: data.description || null,
        purpose: data.purpose,
        capabilities: JSON.stringify(data.capabilities || []),
        trustLevel: data.trustLevel ?? 5,
      },
      include: {
        parent: { select: { name: true } },
        creator: { select: { name: true } },
        _count: { select: { children: true, issuedPasses: true } },
      },
    });

    await this.audit(userId, {
      actorName: 'Aruk',
      actorRole: 'guardian',
      action: 'daemon_registered',
      resourceType: 'daemon',
      resourceId: daemon.id,
      reason: `Registered daemon "${data.name}" (${data.designation}) with role ${data.role}`,
      outcome: 'allowed',
    });

    return this.enrichDaemon(daemon);
  }

  async updateDaemon(userId: string, id: string, data: Partial<{
    name: string; designation: string; role: DaemonRole;
    description: string; purpose: string; capabilities: string[];
    trustLevel: number; status: DaemonStatus;
  }>): Promise<DaemonWithLineage> {
    const updateData: any = { ...data };
    if (data.capabilities) updateData.capabilities = JSON.stringify(data.capabilities);

    // where: { id, userId } — combined so a caller can never mutate a
    // daemon they don't own, even by guessing/enumerating ids.
    const daemon = await db.daemon.update({
      where: { id, userId },
      data: updateData,
      include: {
        parent: { select: { name: true } },
        creator: { select: { name: true } },
        _count: { select: { children: true, issuedPasses: true } },
      },
    });
    return this.enrichDaemon(daemon);
  }

  async revokeDaemon(userId: string, id: string): Promise<void> {
    await db.daemon.update({ where: { id, userId }, data: { status: 'revoked' } });
    await db.accessPass.updateMany({ where: { daemonId: id, userId, status: 'active' }, data: { status: 'revoked' } });

    await this.audit(userId, {
      actorName: 'Aruk', actorRole: 'guardian',
      action: 'daemon_revoked', resourceType: 'daemon', resourceId: id,
      reason: 'Daemon revoked — all active passes invalidated', outcome: 'allowed',
    });
  }

  // ── ACCESS POLICIES ────────────────────────────

  async listPolicies(userId: string, filter?: { effect?: PolicyEffect; resourceType?: string; status?: string }): Promise<PolicyWithDaemon[]> {
    const where: any = { userId };
    if (filter?.effect) where.effect = filter.effect;
    if (filter?.resourceType) where.resourceType = filter.resourceType;
    if (filter?.status) where.status = filter.status;

    const policies = await db.accessPolicy.findMany({
      where,
      include: { daemon: { select: { name: true } }, _count: { select: { passes: true } } },
      orderBy: { priority: 'desc' },
    });

    return policies.map(p => this.enrichPolicy(p));
  }

  async createPolicy(userId: string, data: {
    name: string;
    description?: string;
    effect: PolicyEffect;
    priority?: number;
    daemonId?: string;
    daemonRole?: string;
    resourceType: string;
    resourceId?: string;
    conditions?: Record<string, any>;
    scope?: PolicyScope;
  }): Promise<PolicyWithDaemon> {
    const policy = await db.accessPolicy.create({
      data: {
        userId,
        name: data.name, description: data.description || null,
        effect: data.effect, priority: data.priority ?? 0,
        daemonId: data.daemonId || null, daemonRole: data.daemonRole || null,
        resourceType: data.resourceType, resourceId: data.resourceId || null,
        conditions: JSON.stringify(data.conditions || {}),
        scope: data.scope || 'read',
      },
      include: { daemon: { select: { name: true } }, _count: { select: { passes: true } } },
    });

    await this.audit(userId, {
      actorName: 'Aruk', actorRole: 'guardian',
      action: 'policy_created', resourceType: 'policy', resourceId: policy.id,
      reason: `Created ${data.effect} policy "${data.name}" for ${data.resourceType}:${data.resourceId || '*'}`,
      outcome: 'allowed',
    });

    return this.enrichPolicy(policy);
  }

  async updatePolicy(userId: string, id: string, data: Partial<{
    name: string; description: string; effect: PolicyEffect;
    priority: number; daemonRole: string; resourceType: string;
    resourceId: string; conditions: Record<string, any>;
    scope: PolicyScope; status: string;
  }>): Promise<PolicyWithDaemon> {
    const updateData: any = { ...data };
    if (data.conditions) updateData.conditions = JSON.stringify(data.conditions);
    const policy = await db.accessPolicy.update({
      where: { id, userId }, data: updateData,
      include: { daemon: { select: { name: true } }, _count: { select: { passes: true } } },
    });
    return this.enrichPolicy(policy);
  }

  async deletePolicy(userId: string, id: string): Promise<void> {
    await db.accessPolicy.delete({ where: { id, userId } });
  }

  // ── ACCESS PASSES ───────────────────────────────

  async listPasses(userId: string, filter?: { status?: PassStatus; daemonId?: string; resourceType?: string }): Promise<AccessPassView[]> {
    const where: any = { userId };
    if (filter?.status) where.status = filter.status;
    if (filter?.daemonId) where.daemonId = filter.daemonId;
    if (filter?.resourceType) where.resourceType = filter.resourceType;

    const passes = await db.accessPass.findMany({
      where,
      include: { daemon: { select: { name: true } }, policy: { select: { name: true } } },
      orderBy: { issuedAt: 'desc' },
    });

    return passes.map(p => this.enrichPass(p));
  }

  async issuePass(userId: string, data: {
    daemonId?: string;
    requesterName: string;
    policyId?: string;
    resourceType: string;
    resourceId?: string;
    scope?: string;
    maxUses?: number;
    ttlMinutes?: number;
    reason?: string;
  }): Promise<AccessPassView> {
    const token = `aruk_${randomBytes(24).toString('hex')}`;
    const ttlMs = (data.ttlMinutes ?? 60) * 60 * 1000;

    const pass = await db.accessPass.create({
      data: {
        userId,
        token, daemonId: data.daemonId || null,
        requesterName: data.requesterName,
        policyId: data.policyId || null,
        resourceType: data.resourceType, resourceId: data.resourceId || null,
        scope: data.scope || 'read', maxUses: data.maxUses ?? null,
        issuedAt: new Date(),
        expiresAt: new Date(Date.now() + ttlMs),
        reason: data.reason || null,
      },
      include: { daemon: { select: { name: true } }, policy: { select: { name: true } } },
    });

    await this.audit(userId, {
      actorName: data.requesterName,
      action: 'pass_issued', resourceType: 'access_pass', resourceId: pass.id,
      reason: data.reason || `Pass issued for ${data.resourceType}${data.resourceId ? ':' + data.resourceId : ''}`,
      outcome: 'allowed',
    });

    return this.enrichPass(pass);
  }

  async revokePass(userId: string, id: string): Promise<void> {
    await db.accessPass.update({ where: { id, userId }, data: { status: 'revoked' } });
    await this.audit(userId, {
      actorName: 'Aruk', actorRole: 'guardian',
      action: 'pass_revoked', resourceType: 'access_pass', resourceId: id,
      reason: 'Pass revoked by Aruk', outcome: 'allowed',
    });
  }

  async usePass(token: string): Promise<GateDecision> {
    const pass = await db.accessPass.findUnique({
      where: { token },
      include: { daemon: true, policy: true },
    });

    if (!pass) return { allowed: false, reason: 'No such pass exists' };
    if (pass.status === 'revoked') return { allowed: false, reason: 'Pass has been revoked' };
    if (pass.status === 'consumed') return { allowed: false, reason: 'Pass has been fully consumed' };
    if (new Date() > pass.expiresAt) {
      await db.accessPass.update({ where: { id: pass.id }, data: { status: 'expired' } });
      return { allowed: false, reason: 'Pass has expired' };
    }
    if (pass.maxUses && pass.usedCount >= pass.maxUses) {
      await db.accessPass.update({ where: { id: pass.id }, data: { status: 'consumed' } });
      return { allowed: false, reason: 'Pass usage limit reached' };
    }

    const consumed = pass.maxUses && pass.usedCount + 1 >= pass.maxUses;
    await db.accessPass.update({
      where: { id: pass.id },
      data: { usedCount: { increment: 1 }, lastUsedAt: new Date(), ...(consumed ? { status: 'consumed' } : {}) },
    });

    return { allowed: true, reason: 'Pass validated', daemonId: pass.daemonId };
  }

  // ── PASSAGE RULES (Perimeter) ─────────────────────

  async listPassageRules(userId: string, filter?: { direction?: PassageDirection; status?: string }): Promise<PassageRuleView[]> {
    const where: any = { userId };
    if (filter?.direction) where.direction = filter.direction;
    if (filter?.status) where.status = filter.status;
    const rules = await db.passageRule.findMany({ where, orderBy: { priority: 'desc' } });
    return rules.map(rule => ({
      ...rule,
      direction: rule.direction as PassageDirection,
      action: rule.action as PassageAction,
    }));
  }

  async createPassageRule(userId: string, data: {
    name: string; direction: PassageDirection; description?: string;
    dataType: string; pattern?: string; action: PassageAction;
    daemonRole?: string; resourceType?: string; priority?: number;
  }): Promise<PassageRuleView> {
    const rule = await db.passageRule.create({
      data: {
        userId,
        name: data.name, direction: data.direction,
        description: data.description || null, dataType: data.dataType,
        pattern: data.pattern || null, action: data.action,
        daemonRole: data.daemonRole || null, resourceType: data.resourceType || null,
        priority: data.priority ?? 0,
      },
    });
    return {
      ...rule,
      direction: rule.direction as PassageDirection,
      action: rule.action as PassageAction,
    };
  }

  async updatePassageRule(userId: string, id: string, data: Partial<{
    name: string; direction: PassageDirection; description: string;
    dataType: string; pattern: string; action: PassageAction;
    daemonRole: string; resourceType: string; priority: number; status: string;
  }>): Promise<PassageRuleView> {
    const rule = await db.passageRule.update({ where: { id, userId }, data });
    return {
      ...rule,
      direction: rule.direction as PassageDirection,
      action: rule.action as PassageAction,
    };
  }

  async deletePassageRule(userId: string, id: string): Promise<void> {
    await db.passageRule.delete({ where: { id, userId } });
  }

  // ── AUDIT TRAIL ───────────────────────────────

  async getAuditEvents(userId: string, filter?: {
    actorName?: string; action?: string; resourceType?: string; outcome?: string;
  }, page: number = 1, perPage: number = 50): Promise<{ events: AuditEventView[]; total: number }> {
    const where: any = { userId };
    if (filter?.actorName) where.actorName = { contains: filter.actorName };
    if (filter?.action) where.action = filter.action;
    if (filter?.resourceType) where.resourceType = filter.resourceType;
    if (filter?.outcome) where.outcome = filter.outcome;

    const [events, total] = await Promise.all([
      db.auditEvent.findMany({
        where, include: { pass: { select: { token: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * perPage, take: perPage,
      }),
      db.auditEvent.count({ where }),
    ]);

    return { events: events.map(e => this.enrichAuditEvent(e)), total };
  }

  async getAuditStats(userId: string): Promise<{
    total: number; allowed: number; denied: number;
    byAction: Record<string, number>; byActor: Record<string, number>;
    recentHour: number; recentDay: number;
  }> {
    const [total, allowed, denied, recentHour, recentDay] = await Promise.all([
      db.auditEvent.count({ where: { userId } }),
      db.auditEvent.count({ where: { userId, outcome: 'allowed' } }),
      db.auditEvent.count({ where: { userId, outcome: 'denied' } }),
      db.auditEvent.count({ where: { userId, createdAt: { gte: new Date(Date.now() - 3600000) } } }),
      db.auditEvent.count({ where: { userId, createdAt: { gte: new Date(Date.now() - 86400000) } } }),
    ]);

    const events = await db.auditEvent.findMany({ where: { userId }, take: 1000 });
    const byAction: Record<string, number> = {};
    const byActor: Record<string, number> = {};
    for (const e of events) {
      byAction[e.action] = (byAction[e.action] || 0) + 1;
      byActor[e.actorName] = (byActor[e.actorName] || 0) + 1;
    }

    return { total, allowed, denied, byAction, byActor, recentHour, recentDay };
  }

  // ── EVALUATE ACCESS (The Gate) ──────────────────

  async evaluateAccess(userId: string, request: {
    actorName: string; actorRole?: string; daemonId?: string;
    resourceType: string; resourceId?: string;
    scope?: string; reason?: string;
  }): Promise<GateDecision> {
    const policies = await db.accessPolicy.findMany({
      where: { userId, status: 'active' },
      orderBy: { priority: 'desc' },
    });

    let matchedPolicy: any = null;
    // Fail closed: with no matching policy, access is DENIED. This is the
    // gate's whole reason for existing — a permissive default here would
    // mean any unrecognized actor gets in by default.
    let isAllowed = false;

    for (const policy of policies) {
      // A policy scoped to a specific daemon only matches requests from
      // that same daemon; a policy with no daemonId is a general/wildcard
      // policy that matches any actor.
      const matchesActor = !policy.daemonId || policy.daemonId === request.daemonId;
      const matchesRole = !policy.daemonRole || policy.daemonRole === request.actorRole;
      const matchesResource = policy.resourceType === request.resourceType &&
        (!policy.resourceId || policy.resourceId === '*' || policy.resourceId === request.resourceId);
      const matchesScope = !request.scope || policy.scope === request.scope || policy.scope === 'admin';

      if (matchesActor && matchesRole && matchesResource && matchesScope) {
        matchedPolicy = policy;
        isAllowed = policy.effect === 'allow';
        break;
      }
    }

    await this.audit(userId, {
      actorName: request.actorName, actorRole: request.actorRole,
      action: isAllowed ? 'passage_out' : 'access_denied',
      resourceType: request.resourceType, resourceId: request.resourceId,
      reason: request.reason || (isAllowed ? 'Policy matched: allow' : 'Policy matched: deny'),
      outcome: isAllowed ? 'allowed' : 'denied',
    });

    return {
      allowed: isAllowed,
      reason: matchedPolicy
        ? `${matchedPolicy.effect === 'allow' ? 'Allowed' : 'Denied'} by policy "${matchedPolicy.name}" (priority ${matchedPolicy.priority})`
        : 'No matching policy — default deny',
    };
  }

  // ── CLOUD ACCOUNTS (Extended Reach) ─────────────────

  async listCloudAccounts(userId: string, filter?: { provider?: string; status?: string }): Promise<CloudAccountView[]> {
    const where: any = { userId };
    if (filter?.provider) where.provider = filter.provider;
    if (filter?.status) where.status = filter.status;
    const accounts = await db.cloudAccount.findMany({
      where,
      orderBy: { connectedAt: 'desc' },
    });
    return accounts.map(a => this.enrichCloudAccount(a));
  }

  async getCloudAccount(userId: string, id: string): Promise<CloudAccountView | null> {
    const a = await db.cloudAccount.findUnique({ where: { id, userId } });
    return a ? this.enrichCloudAccount(a) : null;
  }

  async connectCloudAccount(userId: string, data: {
    name: string;
    provider: string;
    projectId?: string;
    bucketName: string;
    region?: string;
    credentials: Record<string, any>;
    credentialsMasked?: string;
    notes?: string;
  }): Promise<CloudAccountView> {
    const account = await db.cloudAccount.create({
      data: {
        userId,
        name: data.name,
        provider: data.provider,
        projectId: data.projectId || null,
        bucketName: data.bucketName,
        region: data.region || null,
        credentials: encryptJson(data.credentials),
        credentialsMasked: data.credentialsMasked || null,
        status: 'active',
        notes: data.notes || null,
      },
    });

    await this.audit(userId, {
      actorName: 'Aruk', actorRole: 'guardian',
      action: 'cloud_account_connected', resourceType: 'cloud_account', resourceId: account.id,
      reason: `Connected ${data.provider} account "${data.name}" → ${data.bucketName}`,
      outcome: 'allowed',
    });

    return this.enrichCloudAccount(account);
  }

  async getCloudAccountCredentials(userId: string, id: string): Promise<{ id: string; name: string; provider: string; credentials: Record<string, any> } | null> {
    const account = await db.cloudAccount.findUnique({ where: { id, userId } });
    if (!account || account.status !== 'active') return null;
    const credentials = decryptJson<Record<string, any>>(account.credentials);
    await this.audit(userId, {
      actorName: 'Aruk', actorRole: 'guardian',
      action: 'cloud_credentials_retrieved', resourceType: 'cloud_account', resourceId: id,
      reason: 'Cloud credentials released to an authorized agent', outcome: 'allowed',
    });
    return { id: account.id, name: account.name, provider: account.provider, credentials };
  }

  async disconnectCloudAccount(userId: string, id: string): Promise<void> {
    await db.cloudAccount.update({ where: { id, userId }, data: { status: 'revoked' } });
    await this.audit(userId, {
      actorName: 'Aruk', actorRole: 'guardian',
      action: 'cloud_account_revoked', resourceType: 'cloud_account', resourceId: id,
      reason: 'Cloud account disconnected by Aruk', outcome: 'allowed',
    });
  }

  // ── PASSAGE LOG ──────────────────────────────────

  async logPassage(userId: string, data: {
    cloudAccountId: string;
    agentName: string;
    direction: 'outbound' | 'inbound';
    remotePath: string;
    sizeBytes?: number;
  }): Promise<PassageLogView> {
    // Ownership is enforced here, inside the keeper boundary, not only in routes.
    const cloudAccount = await db.cloudAccount.findUnique({
      where: { id: data.cloudAccountId, userId },
      select: { id: true, name: true, status: true },
    });
    if (!cloudAccount) throw new Error('Cloud account not found');
    if (cloudAccount.status !== 'active') throw new Error('Cloud account is not active');

    const log = await db.passageLog.create({
      data: {
        cloudAccountId: data.cloudAccountId,
        agentName: data.agentName,
        direction: data.direction,
        remotePath: data.remotePath,
        sizeBytes: data.sizeBytes || 0,
      },
    });

    await this.audit(userId, {
      actorName: data.agentName,
      action: data.direction === 'outbound' ? 'passage_out' : 'passage_in',
      resourceType: 'cloud_account', resourceId: data.cloudAccountId,
      reason: `${data.direction} → ${data.remotePath}`,
      outcome: 'allowed',
    });

    return this.enrichPassageLog(log);
  }

  async listPassageLogs(userId: string, filter?: { cloudAccountId?: string; agentName?: string }, page: number = 1, perPage: number = 50): Promise<{ logs: PassageLogView[]; total: number }> {
    const where: any = { cloudAccount: { userId } };
    if (filter?.cloudAccountId) where.cloudAccountId = filter.cloudAccountId;
    if (filter?.agentName) where.agentName = { contains: filter.agentName };

    const [logs, total] = await Promise.all([
      db.passageLog.findMany({
        where,
        include: { cloudAccount: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * perPage, take: perPage,
      }),
      db.passageLog.count({ where }),
    ]);

    return { logs: logs.map(l => this.enrichPassageLog(l)), total };
  }

  async getPassageLog(userId: string, id: string): Promise<PassageLogView | null> {
    const log = await db.passageLog.findFirst({
      where: { id, cloudAccount: { userId } },
      include: { cloudAccount: { select: { name: true } } },
    });
    return log ? this.enrichPassageLog(log) : null;
  }

  async getPassageStats(userId: string): Promise<{ total: number; outbound: number; inbound: number; totalBytes: number }> {
    const cloudAccountIds = await db.cloudAccount.findMany({
      where: { userId }, select: { id: true },
    }).then(a => a.map(x => x.id));

    if (cloudAccountIds.length === 0) return { total: 0, outbound: 0, inbound: 0, totalBytes: 0 };

    const [total, outbound, inbound, sumResult] = await Promise.all([
      db.passageLog.count({ where: { cloudAccountId: { in: cloudAccountIds } } }),
      db.passageLog.count({ where: { cloudAccountId: { in: cloudAccountIds }, direction: 'outbound' } }),
      db.passageLog.count({ where: { cloudAccountId: { in: cloudAccountIds }, direction: 'inbound' } }),
      db.passageLog.aggregate({ _sum: { sizeBytes: true }, where: { cloudAccountId: { in: cloudAccountIds } } }),
    ]);

    return { total, outbound, inbound, totalBytes: sumResult._sum.sizeBytes || 0 };
  }

  // ── INTERNAL ───────────────────────────────────

  private async audit(userId: string, data: {
    actorName: string; actorRole?: string; action: string;
    resourceType: string; resourceId?: string; passId?: string;
    reason?: string; outcome: string;
    details?: Record<string, any>; ipAddress?: string;
  }): Promise<void> {
    await db.auditEvent.create({
      data: {
        userId,
        actorName: data.actorName, actorRole: data.actorRole || null,
        action: data.action, resourceType: data.resourceType,
        resourceId: data.resourceId || null, passId: data.passId || null,
        reason: data.reason || null, outcome: data.outcome,
        details: JSON.stringify({ ...(data.details || {}), origin: ARUK_ORIGIN_NAME }),
        ipAddress: data.ipAddress || null,
      },
    });
  }

  private enrichDaemon(d: any): DaemonWithLineage {
    let capabilities: string[] = [];
    try { capabilities = JSON.parse(d.capabilities); } catch { /* */ }
    return {
      id: d.id, name: d.name, designation: d.designation, role: d.role,
      parentId: d.parentId, parentName: d.parent?.name || null,
      creatorId: d.creatorId, creatorName: d.creator?.name || null,
      description: d.description, purpose: d.purpose, capabilities,
      status: d.status, trustLevel: d.trustLevel,
      childCount: d._count?.children || 0, passCount: d._count?.issuedPasses || 0,
      createdAt: d.createdAt, updatedAt: d.updatedAt,
    };
  }

  private enrichPolicy(p: any): PolicyWithDaemon {
    let conditions: Record<string, any> = {};
    try { conditions = JSON.parse(p.conditions); } catch { /* */ }
    return {
      id: p.id, name: p.name, description: p.description,
      effect: p.effect, priority: p.priority,
      daemonId: p.daemonId, daemonName: p.daemon?.name || null,
      daemonRole: p.daemonRole, resourceType: p.resourceType,
      resourceId: p.resourceId, conditions, scope: p.scope,
      status: p.status, passCount: p._count?.passes || 0,
      createdAt: p.createdAt, updatedAt: p.updatedAt,
    };
  }

  private enrichPass(p: any): AccessPassView {
    return {
      id: p.id, token: p.token, daemonId: p.daemonId,
      daemonName: p.daemon?.name || null,
      requesterName: p.requesterName, policyId: p.policyId,
      policyName: p.policy?.name || null, resourceType: p.resourceType,
      resourceId: p.resourceId, scope: p.scope,
      maxUses: p.maxUses, usedCount: p.usedCount,
      issuedAt: p.issuedAt, expiresAt: p.expiresAt,
      lastUsedAt: p.lastUsedAt, status: p.status, reason: p.reason,
    };
  }

  private enrichAuditEvent(e: any): AuditEventView {
    let details: Record<string, any> | null = null;
    try { details = JSON.parse(e.details); } catch { /* */ }
    return {
      id: e.id, actorName: e.actorName, actorRole: e.actorRole,
      action: e.action, resourceType: e.resourceType, resourceId: e.resourceId,
      passToken: e.pass?.token || null, reason: e.reason, outcome: e.outcome,
      details, ipAddress: e.ipAddress, createdAt: e.createdAt,
    };
  }

  private enrichCloudAccount(a: any): CloudAccountView {
    return {
      id: a.id, name: a.name, provider: a.provider,
      projectId: a.projectId, bucketName: a.bucketName, region: a.region,
      credentialsMasked: a.credentialsMasked, status: a.status,
      notes: a.notes,
      connectedAt: a.connectedAt, lastCheckedAt: a.lastCheckedAt,
      createdAt: a.createdAt, updatedAt: a.updatedAt,
    };
  }

  private enrichPassageLog(l: any): PassageLogView {
    return {
      id: l.id, cloudAccountId: l.cloudAccountId,
      cloudAccountName: l.cloudAccount?.name || 'Unknown',
      agentName: l.agentName, direction: l.direction,
      remotePath: l.remotePath, sizeBytes: l.sizeBytes,
      createdAt: l.createdAt,
    };
  }
}

// ─── Singleton ────────────────────────────────────
export const keeper = new Keeper();
