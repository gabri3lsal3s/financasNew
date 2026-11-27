import { DurableObject } from "cloudflare:workers";
import {
  decryptTokenPayload,
  encryptTokenPayload,
  generateOpaqueToken,
  sha256Hex,
  timingSafeEqualHex,
} from "./crypto";
import {
  computeSessionDeadlines,
  isSessionExpired,
  maskEmailForSwitcher,
  SESSION_POLICY,
  type SessionMode,
} from "./policies";

export interface CoordinatorEnv {
  ENVIRONMENT: string;
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
  SESSION_ENCRYPTION_KEY_CURRENT: string;
  SESSION_ENCRYPTION_KEY_PREVIOUS?: string;
}

export type AccountLifecycleStatus =
  | "active"
  | "remembered"
  | "trust_expired"
  | "revoked"
  | "requires_reauth";

export interface PublicContextPayload {
  status: "authenticated" | "mfa_required" | "neutral" | "revoked" | "expired";
  contextId: string | null;
  csrfToken: string | null;
  generation: number;
  revision: number;
  environment: string;
  mode: SessionMode;
  accountRef: string | null;
  displayName: string | null;
  expiresAt: number | null;
  mfaFactorId?: string | null;
  pendingRevocations?: number;
}

export interface AccountSummaryPayload {
  accountRef: string;
  displayName: string;
  maskedEmail: string | null;
  mode: SessionMode;
  status: AccountLifecycleStatus;
  generation: number;
  lastActivityAt: number;
  hasLocalLock: boolean;
}

export interface AdmitAccountInput {
  userId: string;
  email?: string | null;
  displayName?: string | null;
  mode: SessionMode;
  accessToken: string;
  refreshToken: string;
  mfaVerified?: boolean;
  mfaFactorId?: string | null;
  hasLocalLock?: boolean;
  nowMs?: number;
}

export interface ResolveContextInput {
  contextId: string;
  environment: string;
  csrfToken?: string;
  requireCsrf: boolean;
  nowMs?: number;
}

export type ResolveContextResult =
  | {
      ok: true;
      accountRef: string;
      userId: string;
      mode: SessionMode;
      generation: number;
      revision: number;
      accessToken: string;
      refreshToken: string;
      expiresAt: number;
    }
  | {
      ok: false;
      code: "unauthorized" | "context_stale" | "step_up_required";
    };

export interface RevalidateResult {
  status: "active" | "revoked" | "expired" | "unknown";
  generation?: number;
  revision?: number;
  expiresAt?: number;
}

type AccountRow = {
  account_ref: string;
  user_id: string;
  display_name: string;
  masked_email: string | null;
  mode: string;
  generation: number;
  revision: number;
  refresh_state: string;
  status: string;
  has_local_lock: number;
  mfa_verified: number;
  mfa_factor_id: string | null;
  encrypted_tokens: string | null;
  created_at: number;
  last_activity_at: number;
  last_auth_proof_at: number;
  revoked_at: number | null;
};

type ContextRow = {
  context_id: string;
  account_ref: string;
  generation: number;
  csrf_hash: string;
  environment: string;
  mode: string;
  active: number;
  created_at: number;
};

type OpenTabIntentRow = {
  intent_token: string;
  account_ref: string;
  expected_generation: number;
  environment: string;
  expires_at: number;
};

type PkceIntentRow = {
  intent_id: string;
  purpose: string;
  mode: string;
  environment: string;
  origin: string;
  code_verifier: string;
  target_account_ref: string | null;
  source_context_id: string | null;
  expires_at: number;
};

type PendingRevocationRow = {
  id: string;
  account_ref: string;
  user_id: string;
  access_token_enc: string | null;
  scope: string;
  created_at: number;
  attempts: number;
};

export class SessionCoordinatorDO extends DurableObject<CoordinatorEnv> {
  private schemaInitialized = false;

  private ensureSchema(): void {
    if (this.schemaInitialized) return;
    this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS installation_accounts (
        account_ref TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        display_name TEXT NOT NULL,
        masked_email TEXT,
        mode TEXT NOT NULL,
        generation INTEGER NOT NULL,
        revision INTEGER NOT NULL DEFAULT 1,
        refresh_state TEXT NOT NULL DEFAULT 'idle',
        status TEXT NOT NULL DEFAULT 'active',
        has_local_lock INTEGER NOT NULL DEFAULT 0,
        mfa_verified INTEGER NOT NULL DEFAULT 1,
        mfa_factor_id TEXT,
        encrypted_tokens TEXT,
        created_at INTEGER NOT NULL,
        last_activity_at INTEGER NOT NULL,
        last_auth_proof_at INTEGER NOT NULL,
        revoked_at INTEGER
      );
      CREATE TABLE IF NOT EXISTS tab_contexts (
        context_id TEXT PRIMARY KEY,
        account_ref TEXT NOT NULL,
        generation INTEGER NOT NULL,
        csrf_hash TEXT NOT NULL,
        environment TEXT NOT NULL,
        mode TEXT NOT NULL,
        active INTEGER NOT NULL DEFAULT 1,
        created_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS open_tab_intents (
        intent_token TEXT PRIMARY KEY,
        account_ref TEXT NOT NULL,
        expected_generation INTEGER NOT NULL,
        environment TEXT NOT NULL,
        expires_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS pkce_intents (
        intent_id TEXT PRIMARY KEY,
        purpose TEXT NOT NULL,
        mode TEXT NOT NULL,
        environment TEXT NOT NULL,
        origin TEXT NOT NULL,
        code_verifier TEXT NOT NULL,
        target_account_ref TEXT,
        source_context_id TEXT,
        expires_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS pending_revocations (
        id TEXT PRIMARY KEY,
        account_ref TEXT NOT NULL,
        user_id TEXT NOT NULL,
        access_token_enc TEXT,
        scope TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 0
      );
    `);
    this.schemaInitialized = true;
  }

  private async scheduleMaintenanceAlarm(nowMs: number): Promise<void> {
    const existing = await this.ctx.storage.getAlarm();
    const nextRun = nowMs + 60_000;
    if (existing === null || existing > nextRun) {
      await this.ctx.storage.setAlarm(nextRun);
    }
  }

  private getPendingRevocationCount(): number {
    const rows = this.ctx.storage.sql
      .exec<{ total: number }>("SELECT COUNT(*) as total FROM pending_revocations")
      .toArray();
    return rows[0]?.total ?? 0;
  }

  private deriveAccountStatus(acct: AccountRow, nowMs: number): AccountLifecycleStatus {
    if (acct.status === "revoked" || acct.revoked_at !== null) return "revoked";
    if (acct.status === "requires_reauth" || acct.refresh_state === "ambiguous") return "requires_reauth";
    if (acct.status === "remembered" || !acct.encrypted_tokens) return "remembered";
    const expired = isSessionExpired(
      {
        mode: acct.mode as SessionMode,
        createdAt: acct.created_at,
        lastActivityAt: acct.last_activity_at,
        lastAuthProofAt: acct.last_auth_proof_at,
      },
      nowMs,
    );
    if (expired) return "trust_expired";
    return "active";
  }

  private async mintTabContext(
    accountRef: string,
    generation: number,
    mode: SessionMode,
    nowMs: number,
  ): Promise<{ contextId: string; csrfToken: string }> {
    const contextId = generateOpaqueToken(24);
    const csrfToken = generateOpaqueToken(24);
    const csrfHash = await sha256Hex(csrfToken);

    this.ctx.storage.sql.exec(
      `INSERT INTO tab_contexts (
        context_id, account_ref, generation, csrf_hash, environment, mode, active, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, 1, ?)`,
      contextId,
      accountRef,
      generation,
      csrfHash,
      this.env.ENVIRONMENT,
      mode,
      nowMs,
    );

    return { contextId, csrfToken };
  }

  private async validateTabContext(
    contextId: string,
    environment: string,
    csrfToken: string | undefined,
    requireCsrf: boolean,
  ): Promise<{ ok: true; tabCtx: ContextRow; acct: AccountRow } | { ok: false; code: "unauthorized" | "context_stale" }> {
    const ctxRows = this.ctx.storage.sql
      .exec<ContextRow>("SELECT * FROM tab_contexts WHERE context_id = ?", contextId)
      .toArray();
    const tabCtx = ctxRows[0];
    if (!tabCtx || tabCtx.environment !== environment || tabCtx.active !== 1) {
      return { ok: false, code: "unauthorized" };
    }

    if (requireCsrf) {
      if (!csrfToken) {
        return { ok: false, code: "unauthorized" };
      }
      const providedHash = await sha256Hex(csrfToken);
      if (!timingSafeEqualHex(providedHash, tabCtx.csrf_hash)) {
        return { ok: false, code: "unauthorized" };
      }
    }

    const acctRows = this.ctx.storage.sql
      .exec<AccountRow>("SELECT * FROM installation_accounts WHERE account_ref = ?", tabCtx.account_ref)
      .toArray();
    const acct = acctRows[0];
    if (!acct || acct.revoked_at !== null || acct.status === "revoked" || acct.status === "requires_reauth") {
      return { ok: false, code: "unauthorized" };
    }
    if (acct.generation !== tabCtx.generation) {
      return { ok: false, code: "context_stale" };
    }
    return { ok: true, tabCtx, acct };
  }

  async bootstrap(contextId: string | null, environment: string, nowMs?: number): Promise<PublicContextPayload> {
    this.ensureSchema();
    const now = nowMs ?? Date.now();
    const pendingRevocations = this.getPendingRevocationCount();

    if (!contextId) {
      return {
        status: "neutral",
        contextId: null,
        csrfToken: null,
        generation: 0,
        revision: 0,
        environment,
        mode: "personal",
        accountRef: null,
        displayName: null,
        expiresAt: null,
        pendingRevocations,
      };
    }

    const validated = await this.validateTabContext(contextId, environment, undefined, false);
    if (!validated.ok) {
      return {
        status: validated.code === "context_stale" ? "revoked" : "neutral",
        contextId: null,
        csrfToken: null,
        generation: 0,
        revision: 0,
        environment,
        mode: "personal",
        accountRef: null,
        displayName: null,
        expiresAt: null,
        pendingRevocations,
      };
    }

    const { tabCtx, acct } = validated;
    const mode = acct.mode as SessionMode;
    const ttlSnapshot = {
      mode,
      createdAt: acct.created_at,
      lastActivityAt: acct.last_activity_at,
      lastAuthProofAt: acct.last_auth_proof_at,
    };

    if (!acct.encrypted_tokens || isSessionExpired(ttlSnapshot, now)) {
      return {
        status: "expired",
        contextId: null,
        csrfToken: null,
        generation: acct.generation,
        revision: acct.revision,
        environment,
        mode,
        accountRef: acct.account_ref,
        displayName: acct.display_name,
        expiresAt: null,
        pendingRevocations,
      };
    }

    const deadlines = computeSessionDeadlines(ttlSnapshot);
    return {
      status: acct.mfa_verified === 1 ? "authenticated" : "mfa_required",
      contextId: tabCtx.context_id,
      csrfToken: null,
      generation: acct.generation,
      revision: acct.revision,
      environment,
      mode,
      accountRef: acct.account_ref,
      displayName: acct.display_name,
      expiresAt: deadlines.effectiveExpiresAt,
      mfaFactorId: acct.mfa_factor_id,
      pendingRevocations,
    };
  }

  async admitAuthenticatedAccount(input: AdmitAccountInput): Promise<PublicContextPayload> {
    this.ensureSchema();
    const now = input.nowMs ?? Date.now();

    const existingRows = this.ctx.storage.sql
      .exec<AccountRow>(
        "SELECT * FROM installation_accounts WHERE user_id = ? AND mode = ?",
        input.userId,
        input.mode,
      )
      .toArray();
    const existing = existingRows[0];

    if (!existing && input.mode === "personal") {
      const countRows = this.ctx.storage.sql
        .exec<{ total: number }>(
          "SELECT COUNT(*) as total FROM installation_accounts WHERE mode = 'personal' AND status != 'revoked'",
        )
        .toArray();
      const total = countRows[0]?.total ?? 0;
      if (total >= SESSION_POLICY.MAX_PERSONAL_ACCOUNTS) {
        throw new Error("limit_reached");
      }
    }

    const accountRef = existing?.account_ref ?? `acct_${generateOpaqueToken(12)}`;
    const nextGeneration = (existing?.generation ?? 0) + 1;
    const nextRevision = (existing?.revision ?? 0) + 1;
    const displayName =
      input.displayName?.trim() ||
      existing?.display_name ||
      maskEmailForSwitcher(input.email) ||
      "Conta Axir";
    const maskedEmail = maskEmailForSwitcher(input.email) ?? existing?.masked_email ?? null;
    const mfaVerified = input.mfaVerified ?? true;
    const status = "active";

    const encryptedTokens = await encryptTokenPayload(
      JSON.stringify({
        accessToken: input.accessToken,
        refreshToken: input.refreshToken,
      }),
      this.env.SESSION_ENCRYPTION_KEY_CURRENT,
    );

    this.ctx.storage.sql.exec(
      `INSERT INTO installation_accounts (
        account_ref, user_id, display_name, masked_email, mode, generation, revision,
        refresh_state, status, has_local_lock, mfa_verified, mfa_factor_id,
        encrypted_tokens, created_at, last_activity_at, last_auth_proof_at, revoked_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'idle', ?, ?, ?, ?, ?, ?, ?, ?, NULL)
      ON CONFLICT(account_ref) DO UPDATE SET
        display_name = excluded.display_name,
        masked_email = coalesce(excluded.masked_email, installation_accounts.masked_email),
        generation = excluded.generation,
        revision = excluded.revision,
        refresh_state = 'idle',
        status = excluded.status,
        has_local_lock = excluded.has_local_lock,
        mfa_verified = excluded.mfa_verified,
        mfa_factor_id = excluded.mfa_factor_id,
        encrypted_tokens = excluded.encrypted_tokens,
        created_at = excluded.created_at,
        last_activity_at = excluded.last_activity_at,
        last_auth_proof_at = excluded.last_auth_proof_at,
        revoked_at = NULL`,
      accountRef,
      input.userId,
      displayName,
      maskedEmail,
      input.mode,
      nextGeneration,
      nextRevision,
      status,
      input.hasLocalLock ? 1 : 0,
      mfaVerified ? 1 : 0,
      input.mfaFactorId ?? null,
      encryptedTokens,
      now,
      now,
      now,
    );

    const { contextId, csrfToken } = await this.mintTabContext(accountRef, nextGeneration, input.mode, now);
    await this.scheduleMaintenanceAlarm(now);

    const deadlines = computeSessionDeadlines({
      mode: input.mode,
      createdAt: now,
      lastActivityAt: now,
      lastAuthProofAt: now,
    });

    return {
      status: mfaVerified ? "authenticated" : "mfa_required",
      contextId,
      csrfToken,
      generation: nextGeneration,
      revision: nextRevision,
      environment: this.env.ENVIRONMENT,
      mode: input.mode,
      accountRef,
      displayName,
      expiresAt: deadlines.effectiveExpiresAt,
      mfaFactorId: input.mfaFactorId ?? null,
      pendingRevocations: this.getPendingRevocationCount(),
    };
  }

  async completeMfaChallenge(input: {
    contextId: string;
    csrfToken: string;
    environment: string;
    accessToken: string;
    refreshToken: string;
    nowMs?: number;
  }): Promise<{ ok: true; context: PublicContextPayload } | { ok: false; code: "unauthorized" | "context_stale" }> {
    this.ensureSchema();
    const now = input.nowMs ?? Date.now();
    const validated = await this.validateTabContext(input.contextId, input.environment, input.csrfToken, true);
    if (!validated.ok) return validated;

    const { acct } = validated;
    const nextRevision = acct.revision + 1;
    const encryptedTokens = await encryptTokenPayload(
      JSON.stringify({
        accessToken: input.accessToken,
        refreshToken: input.refreshToken,
      }),
      this.env.SESSION_ENCRYPTION_KEY_CURRENT,
    );

    const updated = this.ctx.storage.sql
      .exec<{ revision: number }>(
        `UPDATE installation_accounts
         SET mfa_verified = 1,
             mfa_factor_id = NULL,
             encrypted_tokens = ?,
             revision = ?,
             last_activity_at = ?,
             last_auth_proof_at = ?
         WHERE account_ref = ? AND revision = ?
         RETURNING revision`,
        encryptedTokens,
        nextRevision,
        now,
        now,
        acct.account_ref,
        acct.revision,
      )
      .toArray();

    if (updated.length === 0) {
      return { ok: false, code: "context_stale" };
    }

    const mode = acct.mode as SessionMode;
    const deadlines = computeSessionDeadlines({
      mode,
      createdAt: acct.created_at,
      lastActivityAt: now,
      lastAuthProofAt: now,
    });

    return {
      ok: true,
      context: {
        status: "authenticated",
        contextId: validated.tabCtx.context_id,
        csrfToken: input.csrfToken,
        generation: acct.generation,
        revision: nextRevision,
        environment: input.environment,
        mode,
        accountRef: acct.account_ref,
        displayName: acct.display_name,
        expiresAt: deadlines.effectiveExpiresAt,
      },
    };
  }

  async listAccounts(nowMs?: number): Promise<AccountSummaryPayload[]> {
    this.ensureSchema();
    const now = nowMs ?? Date.now();
    const rows = this.ctx.storage.sql
      .exec<AccountRow>("SELECT * FROM installation_accounts WHERE status != 'revoked' ORDER BY last_activity_at DESC")
      .toArray();

    return rows.map((row) => ({
      accountRef: row.account_ref,
      displayName: row.display_name,
      maskedEmail: row.masked_email,
      mode: row.mode as SessionMode,
      status: this.deriveAccountStatus(row, now),
      generation: row.generation,
      lastActivityAt: row.last_activity_at,
      hasLocalLock: row.has_local_lock === 1,
    }));
  }

  async switchAccount(input: {
    currentContextId: string;
    csrfToken: string;
    targetAccountRef: string;
    expectedGeneration: number;
    localLockSatisfied: boolean;
    environment: string;
    nowMs?: number;
  }): Promise<{ ok: true; context: PublicContextPayload } | { ok: false; code: "unauthorized" | "context_stale" | "step_up_required" }> {
    this.ensureSchema();
    const now = input.nowMs ?? Date.now();

    const current = await this.validateTabContext(input.currentContextId, input.environment, input.csrfToken, true);
    if (!current.ok) {
      return current;
    }

    const targetRows = this.ctx.storage.sql
      .exec<AccountRow>("SELECT * FROM installation_accounts WHERE account_ref = ?", input.targetAccountRef)
      .toArray();
    const target = targetRows[0];
    if (!target) {
      return { ok: false, code: "unauthorized" };
    }

    const targetStatus = this.deriveAccountStatus(target, now);
    if (targetStatus === "revoked" || targetStatus === "trust_expired" || targetStatus === "requires_reauth" || targetStatus === "remembered") {
      return { ok: false, code: "unauthorized" };
    }
    if (target.generation !== input.expectedGeneration) {
      return { ok: false, code: "context_stale" };
    }
    if (target.mfa_verified !== 1 || (target.has_local_lock === 1 && !input.localLockSatisfied)) {
      return { ok: false, code: "step_up_required" };
    }

    // Desativa geração/contexto anterior antes de ativar o destino
    this.ctx.storage.sql.exec("UPDATE tab_contexts SET active = 0 WHERE context_id = ?", input.currentContextId);

    const targetMode = target.mode as SessionMode;
    const { contextId, csrfToken } = await this.mintTabContext(target.account_ref, target.generation, targetMode, now);
    const deadlines = computeSessionDeadlines({
      mode: targetMode,
      createdAt: target.created_at,
      lastActivityAt: now,
      lastAuthProofAt: target.last_auth_proof_at,
    });

    this.ctx.storage.sql.exec(
      "UPDATE installation_accounts SET last_activity_at = ? WHERE account_ref = ?",
      now,
      target.account_ref,
    );

    return {
      ok: true,
      context: {
        status: "authenticated",
        contextId,
        csrfToken,
        generation: target.generation,
        revision: target.revision,
        environment: input.environment,
        mode: targetMode,
        accountRef: target.account_ref,
        displayName: target.display_name,
        expiresAt: deadlines.effectiveExpiresAt,
      },
    };
  }

  async createOpenTabIntent(input: {
    contextId: string;
    csrfToken: string;
    targetAccountRef?: string;
    environment: string;
    nowMs?: number;
  }): Promise<{ ok: true; intentToken: string; expiresAt: number } | { ok: false; code: "unauthorized" | "context_stale" }> {
    this.ensureSchema();
    const now = input.nowMs ?? Date.now();
    const validated = await this.validateTabContext(input.contextId, input.environment, input.csrfToken, true);
    if (!validated.ok) return validated;

    const targetRef = input.targetAccountRef ?? validated.acct.account_ref;
    const targetRows = this.ctx.storage.sql
      .exec<AccountRow>("SELECT * FROM installation_accounts WHERE account_ref = ?", targetRef)
      .toArray();
    const target = targetRows[0];
    if (!target || this.deriveAccountStatus(target, now) !== "active") {
      return { ok: false, code: "unauthorized" };
    }

    const intentToken = generateOpaqueToken(24);
    const expiresAt = now + SESSION_POLICY.OPEN_TAB_INTENT_TTL_MS;

    this.ctx.storage.sql.exec(
      `INSERT INTO open_tab_intents (intent_token, account_ref, expected_generation, environment, expires_at)
       VALUES (?, ?, ?, ?, ?)`,
      intentToken,
      target.account_ref,
      target.generation,
      input.environment,
      expiresAt,
    );
    await this.scheduleMaintenanceAlarm(now);

    return { ok: true, intentToken, expiresAt };
  }

  async redeemOpenTabIntent(input: {
    intentToken: string;
    environment: string;
    nowMs?: number;
  }): Promise<{ ok: true; context: PublicContextPayload } | { ok: false; code: "unauthorized" | "context_stale" }> {
    this.ensureSchema();
    const now = input.nowMs ?? Date.now();

    const deleted = this.ctx.storage.sql
      .exec<OpenTabIntentRow>(
        "DELETE FROM open_tab_intents WHERE intent_token = ? AND environment = ? RETURNING *",
        input.intentToken,
        input.environment,
      )
      .toArray();
    const intent = deleted[0];
    if (!intent || now >= intent.expires_at) {
      return { ok: false, code: "unauthorized" };
    }

    const acctRows = this.ctx.storage.sql
      .exec<AccountRow>("SELECT * FROM installation_accounts WHERE account_ref = ?", intent.account_ref)
      .toArray();
    const acct = acctRows[0];
    if (!acct || this.deriveAccountStatus(acct, now) !== "active") {
      return { ok: false, code: "unauthorized" };
    }
    if (acct.generation !== intent.expected_generation) {
      return { ok: false, code: "context_stale" };
    }

    const mode = acct.mode as SessionMode;
    const { contextId, csrfToken } = await this.mintTabContext(acct.account_ref, acct.generation, mode, now);
    const deadlines = computeSessionDeadlines({
      mode,
      createdAt: acct.created_at,
      lastActivityAt: now,
      lastAuthProofAt: acct.last_auth_proof_at,
    });

    return {
      ok: true,
      context: {
        status: "authenticated",
        contextId,
        csrfToken,
        generation: acct.generation,
        revision: acct.revision,
        environment: input.environment,
        mode,
        accountRef: acct.account_ref,
        displayName: acct.display_name,
        expiresAt: deadlines.effectiveExpiresAt,
      },
    };
  }

  async createPkceIntent(input: {
    purpose: "login" | "recovery";
    mode: SessionMode;
    environment: string;
    origin: string;
    codeVerifier: string;
    targetAccountRef?: string | null;
    sourceContextId?: string | null;
    nowMs?: number;
  }): Promise<{ intentId: string; expiresAt: number }> {
    this.ensureSchema();
    const now = input.nowMs ?? Date.now();
    const intentId = generateOpaqueToken(24);
    const expiresAt = now + SESSION_POLICY.PKCE_INTENT_TTL_MS;

    this.ctx.storage.sql.exec(
      `INSERT INTO pkce_intents (
        intent_id, purpose, mode, environment, origin, code_verifier, target_account_ref, source_context_id, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      intentId,
      input.purpose,
      input.mode,
      input.environment,
      input.origin,
      input.codeVerifier,
      input.targetAccountRef ?? null,
      input.sourceContextId ?? null,
      expiresAt,
    );
    await this.scheduleMaintenanceAlarm(now);
    return { intentId, expiresAt };
  }

  async consumePkceIntent(input: {
    intentId: string;
    environment: string;
    sourceContextId?: string | null;
    nowMs?: number;
  }): Promise<{ ok: true; intent: PkceIntentRow } | { ok: false; code: "unauthorized" }> {
    this.ensureSchema();
    const now = input.nowMs ?? Date.now();

    const deleted = this.ctx.storage.sql
      .exec<PkceIntentRow>(
        "DELETE FROM pkce_intents WHERE intent_id = ? AND environment = ? RETURNING *",
        input.intentId,
        input.environment,
      )
      .toArray();
    const intent = deleted[0];
    if (!intent || now >= intent.expires_at) {
      return { ok: false, code: "unauthorized" };
    }
    if (intent.source_context_id && input.sourceContextId && intent.source_context_id !== input.sourceContextId) {
      return { ok: false, code: "unauthorized" };
    }
    return { ok: true, intent };
  }

  async beginTokenRefresh(
    accountRef: string,
    expectedRevision: number,
  ): Promise<{ ok: true; nextRevision: number; refreshToken: string } | { ok: false; code: "context_stale" | "unauthorized" }> {
    this.ensureSchema();

    const acctRows = this.ctx.storage.sql
      .exec<AccountRow>("SELECT * FROM installation_accounts WHERE account_ref = ?", accountRef)
      .toArray();
    const acct = acctRows[0];
    if (!acct || !acct.encrypted_tokens || acct.status === "revoked") {
      return { ok: false, code: "unauthorized" };
    }

    if (acct.refresh_state !== "idle" || acct.revision !== expectedRevision) {
      // Rotação interrompida ou concorrente: invalida tokens e exige nova autenticação
      this.ctx.storage.sql.exec(
        `UPDATE installation_accounts
         SET refresh_state = 'ambiguous',
             status = 'requires_reauth',
             encrypted_tokens = NULL
         WHERE account_ref = ?`,
        accountRef,
      );
      this.ctx.storage.sql.exec("UPDATE tab_contexts SET active = 0 WHERE account_ref = ?", accountRef);
      return { ok: false, code: "context_stale" };
    }

    const nextRevision = expectedRevision + 1;
    const locked = this.ctx.storage.sql
      .exec<{ revision: number }>(
        `UPDATE installation_accounts
         SET refresh_state = 'in_flight', revision = ?
         WHERE account_ref = ? AND revision = ? AND refresh_state = 'idle'
         RETURNING revision`,
        nextRevision,
        accountRef,
        expectedRevision,
      )
      .toArray();

    if (locked.length === 0) {
      return { ok: false, code: "context_stale" };
    }

    const plain = await decryptTokenPayload(
      acct.encrypted_tokens,
      this.env.SESSION_ENCRYPTION_KEY_CURRENT,
      this.env.SESSION_ENCRYPTION_KEY_PREVIOUS,
    );
    const parsed = JSON.parse(plain) as { accessToken: string; refreshToken: string };
    return { ok: true, nextRevision, refreshToken: parsed.refreshToken };
  }

  async commitTokenRefresh(input: {
    accountRef: string;
    expectedRevision: number;
    accessToken: string;
    refreshToken: string;
    nowMs?: number;
  }): Promise<{ ok: true; revision: number } | { ok: false; code: "context_stale" }> {
    this.ensureSchema();
    const now = input.nowMs ?? Date.now();
    const nextRevision = input.expectedRevision + 1;
    const encryptedTokens = await encryptTokenPayload(
      JSON.stringify({
        accessToken: input.accessToken,
        refreshToken: input.refreshToken,
      }),
      this.env.SESSION_ENCRYPTION_KEY_CURRENT,
    );

    const updated = this.ctx.storage.sql
      .exec<{ revision: number }>(
        `UPDATE installation_accounts
         SET encrypted_tokens = ?,
             refresh_state = 'idle',
             revision = ?,
             last_activity_at = ?
         WHERE account_ref = ? AND revision = ? AND refresh_state = 'in_flight'
         RETURNING revision`,
        encryptedTokens,
        nextRevision,
        now,
        input.accountRef,
        input.expectedRevision,
      )
      .toArray();

    if (updated.length === 0) {
      this.ctx.storage.sql.exec(
        `UPDATE installation_accounts
         SET refresh_state = 'ambiguous', status = 'requires_reauth', encrypted_tokens = NULL
         WHERE account_ref = ?`,
        input.accountRef,
      );
      return { ok: false, code: "context_stale" };
    }
    return { ok: true, revision: nextRevision };
  }

  async resolveContext(input: ResolveContextInput): Promise<ResolveContextResult> {
    this.ensureSchema();
    const now = input.nowMs ?? Date.now();

    const validated = await this.validateTabContext(input.contextId, input.environment, input.csrfToken, input.requireCsrf);
    if (!validated.ok) return validated;

    const { acct } = validated;
    if (acct.refresh_state !== "idle") {
      return { ok: false, code: "context_stale" };
    }
    if (acct.mfa_verified !== 1) {
      return { ok: false, code: "step_up_required" };
    }

    const mode = acct.mode as SessionMode;
    const ttlSnapshot = {
      mode,
      createdAt: acct.created_at,
      lastActivityAt: acct.last_activity_at,
      lastAuthProofAt: acct.last_auth_proof_at,
    };

    if (!acct.encrypted_tokens || isSessionExpired(ttlSnapshot, now)) {
      return { ok: false, code: "unauthorized" };
    }

    this.ctx.storage.sql.exec(
      "UPDATE installation_accounts SET last_activity_at = ? WHERE account_ref = ?",
      now,
      acct.account_ref,
    );

    const plaintext = await decryptTokenPayload(
      acct.encrypted_tokens,
      this.env.SESSION_ENCRYPTION_KEY_CURRENT,
      this.env.SESSION_ENCRYPTION_KEY_PREVIOUS,
    );
    const parsed = JSON.parse(plaintext) as { accessToken: string; refreshToken: string };
    const deadlines = computeSessionDeadlines({
      ...ttlSnapshot,
      lastActivityAt: now,
    });

    return {
      ok: true,
      accountRef: acct.account_ref,
      userId: acct.user_id,
      mode,
      generation: acct.generation,
      revision: acct.revision,
      accessToken: parsed.accessToken,
      refreshToken: parsed.refreshToken,
      expiresAt: deadlines.effectiveExpiresAt,
    };
  }

  async revalidate(contextId: string, environment: string, nowMs?: number): Promise<RevalidateResult> {
    this.ensureSchema();
    const now = nowMs ?? Date.now();

    const ctxRows = this.ctx.storage.sql
      .exec<ContextRow>("SELECT * FROM tab_contexts WHERE context_id = ?", contextId)
      .toArray();
    const tabCtx = ctxRows[0];
    if (!tabCtx || tabCtx.environment !== environment) {
      return { status: "unknown" };
    }

    const acctRows = this.ctx.storage.sql
      .exec<AccountRow>("SELECT * FROM installation_accounts WHERE account_ref = ?", tabCtx.account_ref)
      .toArray();
    const acct = acctRows[0];
    if (
      !acct ||
      tabCtx.active !== 1 ||
      acct.revoked_at !== null ||
      acct.status === "revoked" ||
      acct.status === "requires_reauth" ||
      !acct.encrypted_tokens ||
      acct.generation !== tabCtx.generation
    ) {
      return { status: "revoked" };
    }

    const ttlSnapshot = {
      mode: acct.mode as SessionMode,
      createdAt: acct.created_at,
      lastActivityAt: acct.last_activity_at,
      lastAuthProofAt: acct.last_auth_proof_at,
    };
    if (isSessionExpired(ttlSnapshot, now)) {
      return { status: "expired" };
    }

    const deadlines = computeSessionDeadlines(ttlSnapshot);
    return {
      status: "active",
      generation: acct.generation,
      revision: acct.revision,
      expiresAt: deadlines.effectiveExpiresAt,
    };
  }

  async logoutContext(input: {
    contextId: string;
    csrfToken: string;
    environment: string;
    scope: "tab" | "device" | "all-device";
    remember: boolean;
    nowMs?: number;
  }): Promise<
    | { ok: true; tokensToRevoke: Array<{ accountRef: string; userId: string; accessToken: string }> }
    | { ok: false; code: "unauthorized" | "context_stale" }
  > {
    this.ensureSchema();
    const now = input.nowMs ?? Date.now();
    const validated = await this.validateTabContext(input.contextId, input.environment, input.csrfToken, true);
    if (!validated.ok) return validated;

    if (input.scope === "tab") {
      this.ctx.storage.sql.exec("UPDATE tab_contexts SET active = 0 WHERE context_id = ?", input.contextId);
      return { ok: true, tokensToRevoke: [] };
    }

    const accounts =
      input.scope === "all-device"
        ? this.ctx.storage.sql
            .exec<AccountRow>("SELECT * FROM installation_accounts WHERE status != 'revoked'")
            .toArray()
        : [validated.acct];

    const tokensToRevoke: Array<{ accountRef: string; userId: string; accessToken: string }> = [];

    for (const acct of accounts) {
      if (acct.encrypted_tokens) {
        try {
          const plain = await decryptTokenPayload(
            acct.encrypted_tokens,
            this.env.SESSION_ENCRYPTION_KEY_CURRENT,
            this.env.SESSION_ENCRYPTION_KEY_PREVIOUS,
          );
          const parsed = JSON.parse(plain) as { accessToken: string };
          tokensToRevoke.push({
            accountRef: acct.account_ref,
            userId: acct.user_id,
            accessToken: parsed.accessToken,
          });
        } catch {
          // Segredo ilegível não impede invalidação local imediata
        }
      }

      const nextStatus = input.remember && acct.mode === "personal" ? "remembered" : "revoked";
      this.ctx.storage.sql.exec(
        `UPDATE installation_accounts
         SET encrypted_tokens = NULL,
             status = ?,
             revoked_at = CASE WHEN ? = 'revoked' THEN ? ELSE NULL END,
             revision = revision + 1
         WHERE account_ref = ?`,
        nextStatus,
        nextStatus,
        now,
        acct.account_ref,
      );
      this.ctx.storage.sql.exec("UPDATE tab_contexts SET active = 0 WHERE account_ref = ?", acct.account_ref);
    }

    return { ok: true, tokensToRevoke };
  }

  async forgetAccount(input: {
    contextId: string;
    csrfToken: string;
    targetAccountRef?: string;
    environment: string;
  }): Promise<boolean> {
    this.ensureSchema();
    const validated = await this.validateTabContext(input.contextId, input.environment, input.csrfToken, true);
    if (!validated.ok) return false;

    const targetRef = input.targetAccountRef ?? validated.acct.account_ref;
    this.ctx.storage.sql.exec("DELETE FROM tab_contexts WHERE account_ref = ?", targetRef);
    this.ctx.storage.sql.exec("DELETE FROM open_tab_intents WHERE account_ref = ?", targetRef);
    this.ctx.storage.sql.exec("DELETE FROM installation_accounts WHERE account_ref = ?", targetRef);
    return true;
  }

  async queuePendingRevocation(input: {
    accountRef: string;
    userId: string;
    accessToken: string;
    scope: string;
    nowMs?: number;
  }): Promise<number> {
    this.ensureSchema();
    const now = input.nowMs ?? Date.now();
    const enc = await encryptTokenPayload(input.accessToken, this.env.SESSION_ENCRYPTION_KEY_CURRENT);
    this.ctx.storage.sql.exec(
      `INSERT INTO pending_revocations (id, account_ref, user_id, access_token_enc, scope, created_at, attempts)
       VALUES (?, ?, ?, ?, ?, ?, 1)`,
      generateOpaqueToken(12),
      input.accountRef,
      input.userId,
      enc,
      input.scope,
      now,
    );
    await this.scheduleMaintenanceAlarm(now);
    return this.getPendingRevocationCount();
  }

  async alarm(): Promise<void> {
    this.ensureSchema();
    const now = Date.now();

    // Expurgo de intenções expiradas e contas lembradas > 30 dias
    this.ctx.storage.sql.exec("DELETE FROM open_tab_intents WHERE expires_at <= ?", now);
    this.ctx.storage.sql.exec("DELETE FROM pkce_intents WHERE expires_at <= ?", now);
    this.ctx.storage.sql.exec(
      "DELETE FROM installation_accounts WHERE status = 'remembered' AND last_activity_at < ?",
      now - SESSION_POLICY.REMEMBERED_ACCOUNT_TTL_MS,
    );

    const pending = this.ctx.storage.sql
      .exec<PendingRevocationRow>("SELECT * FROM pending_revocations ORDER BY created_at ASC LIMIT 10")
      .toArray();

    for (const item of pending) {
      if (now - item.created_at > SESSION_POLICY.PERSONAL_TRUST_WINDOW_MS || !this.env.SUPABASE_URL || !this.env.SUPABASE_ANON_KEY) {
        this.ctx.storage.sql.exec("DELETE FROM pending_revocations WHERE id = ?", item.id);
        continue;
      }

      try {
        if (item.access_token_enc) {
          const accessToken = await decryptTokenPayload(
            item.access_token_enc,
            this.env.SESSION_ENCRYPTION_KEY_CURRENT,
            this.env.SESSION_ENCRYPTION_KEY_PREVIOUS,
          );
          const res = await fetch(`${this.env.SUPABASE_URL}/auth/v1/logout?scope=${encodeURIComponent(item.scope)}`, {
            method: "POST",
            headers: {
              apikey: this.env.SUPABASE_ANON_KEY,
              Authorization: `Bearer ${accessToken}`,
            },
          });
          if (res.ok || res.status === 401) {
            this.ctx.storage.sql.exec("DELETE FROM pending_revocations WHERE id = ?", item.id);
            continue;
          }
        }
      } catch {
        // Mantém para próxima tentativa
      }

      this.ctx.storage.sql.exec(
        "UPDATE pending_revocations SET attempts = attempts + 1 WHERE id = ?",
        item.id,
      );
    }

    if (this.getPendingRevocationCount() > 0) {
      await this.scheduleMaintenanceAlarm(now);
    }
  }
}
