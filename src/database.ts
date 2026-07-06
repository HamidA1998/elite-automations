import fs from "node:fs";
import path from "node:path";
import {DatabaseSync} from "node:sqlite";

import {brand, outputFiles} from "@/config";
import type {
  ClientComment,
  ClientContact,
  ClientMemory,
  ClientProposal,
  ClientRecord,
  ClientTask,
  DashboardAppState,
  DashboardData,
  DashboardMetrics,
  OutreachActivity,
} from "@/types";
import {uniqueId} from "@/utils";

const APP_STATE_VERSION = 1;

type ClientRow = {
  client_id: string;
  business_name: string;
  business_type: string;
  area: string;
  website_url: string | null;
  phone_number: string | null;
  email_address: string | null;
  google_rating: number | null;
  review_count: number | null;
  address: string | null;
  source_url: string | null;
  source_title: string | null;
  source_description: string | null;
  score: number;
  account_status: string;
  follow_up_priority: string;
  follow_up_next_step: string;
  follow_up_due_date: string;
  contact_summary: string;
  strengths_json: string;
  weaknesses_json: string;
  recommended_actions_json: string;
  top_problems_json: string;
  audit_scores_json: string;
  audit_notes_json: string;
  audit_metadata_json: string;
  image_hero: string;
  image_services: string;
  demo_file: string;
  video_file: string;
  email_file: string;
  owner_name: string;
  health_band: string;
  last_contacted_at: string | null;
  close_probability: number;
  value_estimate: number;
  objections_json: string;
  enrichment_json: string;
  pipeline_origin: number;
  created_at: string;
  updated_at: string;
};

type RowWithClient = {
  client_id: string;
};

function nowIso() {
  return new Date().toISOString();
}

function jsonParse<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function healthBand(score: number) {
  if (score <= 20) return "critical";
  if (score <= 35) return "weak";
  if (score <= 50) return "workable";
  return "stable";
}

function seededComment(client: ClientRecord): ClientComment {
  return {
    id: `NOTE-${uniqueId(client.clientId, "seed")}`,
    author: brand.ownerName,
    body: `Initial opportunity review complete. ${client.businessName} is tracked as a ${client.followUp.priority} priority account with a score of ${client.audit.totalScore}/100.`,
    createdAt: nowIso(),
    type: "system",
  };
}

function linkedAssets(client: ClientRecord) {
  return [
    {assetType: "demo" as const, label: "Free demo site", filePath: client.demoFile, version: 1, status: "ready" as const},
    {assetType: "video" as const, label: "Preview video", filePath: client.videoFile, version: 1, status: "planned" as const},
    {assetType: "email" as const, label: "Cold email draft", filePath: client.emailFile, version: 1, status: "draft" as const},
    {assetType: "image" as const, label: "Hero image", filePath: client.artifacts.heroImage, version: 1, status: "ready" as const},
    {assetType: "image" as const, label: "Services image", filePath: client.artifacts.servicesImage, version: 1, status: "ready" as const},
  ].filter((asset) => Boolean(asset.filePath));
}

export class EliteOpsDatabase {
  private readonly db: DatabaseSync;

  constructor(filePath = outputFiles.crmDatabase) {
    fs.mkdirSync(path.dirname(filePath), {recursive: true});
    this.db = new DatabaseSync(filePath);
    this.db.exec("PRAGMA journal_mode = WAL;");
    this.db.exec("PRAGMA foreign_keys = ON;");
    this.migrate();
    this.pruneSyntheticRecords();
  }

  private pruneSyntheticRecords() {
    this.db.exec("BEGIN");
    try {
      this.db.prepare(`
        DELETE FROM proposals
        WHERE status = 'draft'
          AND next_step = 'Share the free demo, then position the paid rebuild after the first response.'
          AND package_name IN ('Growth rebuild', 'Launch refresh')
      `).run();
      this.db.prepare(`
        DELETE FROM tasks
        WHERE title IN ('Send free demo email', 'Place follow-up call')
          AND description IN (
            'Review the personalised email, attach the demo link and preview video, then send from the agency inbox.',
            'Reference the three biggest website issues and offer to walk them through the free demo.'
          )
      `).run();
      this.db.prepare(`
        DELETE FROM memories
        WHERE title = 'Initial account memory' AND source = 'pipeline'
      `).run();
      this.db.prepare(`
        DELETE FROM contacts
        WHERE full_name = 'Primary contact'
          AND role = 'Owner / manager'
          AND notes IN ('Auto-created from pipeline enrichment data.', 'Created manually from the CRM workspace.')
      `).run();
      this.db.prepare(`
        DELETE FROM assets
        WHERE file_path IS NULL OR TRIM(file_path) = ''
      `).run();
      this.db.prepare(`
        DELETE FROM accounts
        WHERE business_name = 'Eliteautomation HQ'
           OR email_address LIKE '%.test'
      `).run();
      this.db.prepare(`
        DELETE FROM clients
        WHERE business_name = 'Eliteautomation HQ'
           OR email_address LIKE '%.test'
      `).run();
      for (const table of ["activities", "tasks", "contacts", "memories", "proposals", "comments", "assets", "audit_scores", "audit_analysis", "browser_audits", "timeline_events", "memory", "notes", "call_logs"]) {
        this.db.prepare(`DELETE FROM ${table} WHERE client_id NOT IN (SELECT client_id FROM accounts)`).run();
      }
      this.db.prepare(`
        UPDATE accounts
        SET deal_value = 0,
            close_probability = 0
        WHERE client_id NOT IN (SELECT DISTINCT client_id FROM proposals)
      `).run();
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  private migrate() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS clients (
        client_id TEXT PRIMARY KEY,
        business_name TEXT NOT NULL,
        business_type TEXT NOT NULL,
        area TEXT NOT NULL,
        website_url TEXT,
        phone_number TEXT,
        email_address TEXT,
        google_rating REAL,
        review_count INTEGER,
        address TEXT,
        source_url TEXT,
        source_title TEXT,
        source_description TEXT,
        score INTEGER NOT NULL,
        account_status TEXT NOT NULL,
        follow_up_priority TEXT NOT NULL,
        follow_up_next_step TEXT NOT NULL,
        follow_up_due_date TEXT NOT NULL,
        contact_summary TEXT NOT NULL,
        strengths_json TEXT NOT NULL,
        weaknesses_json TEXT NOT NULL,
        recommended_actions_json TEXT NOT NULL,
        top_problems_json TEXT NOT NULL,
        audit_scores_json TEXT NOT NULL,
        audit_notes_json TEXT NOT NULL,
        audit_metadata_json TEXT NOT NULL,
        image_hero TEXT NOT NULL,
        image_services TEXT NOT NULL,
        demo_file TEXT NOT NULL,
        video_file TEXT NOT NULL,
        email_file TEXT NOT NULL,
        owner_name TEXT NOT NULL,
        health_band TEXT NOT NULL,
        last_contacted_at TEXT,
        close_probability INTEGER NOT NULL DEFAULT 0,
        value_estimate INTEGER NOT NULL DEFAULT 0,
        objections_json TEXT NOT NULL DEFAULT '[]',
        enrichment_json TEXT NOT NULL DEFAULT '{}',
        pipeline_origin INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS contacts (
        id TEXT PRIMARY KEY,
        client_id TEXT NOT NULL REFERENCES clients(client_id) ON DELETE CASCADE,
        full_name TEXT NOT NULL,
        role TEXT NOT NULL,
        email TEXT,
        phone TEXT,
        linkedin TEXT,
        is_primary INTEGER NOT NULL DEFAULT 0,
        notes TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'reachable'
      );

      CREATE TABLE IF NOT EXISTS activities (
        id TEXT PRIMARY KEY,
        client_id TEXT NOT NULL REFERENCES clients(client_id) ON DELETE CASCADE,
        type TEXT NOT NULL,
        status TEXT NOT NULL,
        title TEXT NOT NULL,
        summary TEXT NOT NULL,
        owner TEXT NOT NULL,
        created_at TEXT NOT NULL,
        scheduled_for TEXT,
        completed_at TEXT,
        linked_files_json TEXT NOT NULL DEFAULT '[]',
        linked_channels_json TEXT NOT NULL DEFAULT '[]',
        event_source TEXT NOT NULL DEFAULT 'manual',
        metadata_json TEXT NOT NULL DEFAULT '{}'
      );

      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        client_id TEXT NOT NULL REFERENCES clients(client_id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        status TEXT NOT NULL,
        priority TEXT NOT NULL,
        due_date TEXT NOT NULL,
        owner TEXT NOT NULL,
        lane TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS memories (
        id TEXT PRIMARY KEY,
        client_id TEXT REFERENCES clients(client_id) ON DELETE CASCADE,
        kind TEXT NOT NULL,
        title TEXT NOT NULL,
        note TEXT NOT NULL,
        tags_json TEXT NOT NULL DEFAULT '[]',
        source TEXT NOT NULL DEFAULT 'manual',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS proposals (
        id TEXT PRIMARY KEY,
        client_id TEXT NOT NULL REFERENCES clients(client_id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        status TEXT NOT NULL,
        package_name TEXT NOT NULL,
        price INTEGER NOT NULL,
        probability INTEGER NOT NULL,
        next_step TEXT NOT NULL,
        scope_json TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS comments (
        id TEXT PRIMARY KEY,
        client_id TEXT NOT NULL REFERENCES clients(client_id) ON DELETE CASCADE,
        author TEXT NOT NULL,
        body TEXT NOT NULL,
        created_at TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'note'
      );

      CREATE TABLE IF NOT EXISTS assets (
        id TEXT PRIMARY KEY,
        client_id TEXT NOT NULL REFERENCES clients(client_id) ON DELETE CASCADE,
        asset_type TEXT NOT NULL,
        label TEXT NOT NULL,
        file_path TEXT NOT NULL,
        version INTEGER NOT NULL,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        metadata_json TEXT NOT NULL DEFAULT '{}'
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value_json TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS accounts (
        client_id TEXT PRIMARY KEY,
        business_name TEXT NOT NULL,
        business_type TEXT NOT NULL,
        area TEXT NOT NULL,
        website_url TEXT,
        phone_number TEXT,
        email_address TEXT,
        google_rating REAL,
        review_count INTEGER,
        address TEXT,
        account_status TEXT NOT NULL,
        priority TEXT NOT NULL,
        due_date TEXT,
        next_action_notes TEXT NOT NULL DEFAULT '',
        site_score INTEGER NOT NULL DEFAULT 0,
        deal_value INTEGER NOT NULL DEFAULT 0,
        close_probability INTEGER NOT NULL DEFAULT 0,
        source_notes TEXT NOT NULL DEFAULT '',
        image_hero TEXT,
        image_services TEXT,
        demo_file TEXT,
        video_file TEXT,
        email_file TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS audit_scores (
        client_id TEXT NOT NULL REFERENCES accounts(client_id) ON DELETE CASCADE,
        criterion TEXT NOT NULL,
        score INTEGER NOT NULL DEFAULT 0,
        note TEXT NOT NULL DEFAULT '',
        updated_at TEXT NOT NULL,
        PRIMARY KEY (client_id, criterion)
      );

      CREATE TABLE IF NOT EXISTS audit_analysis (
        client_id TEXT PRIMARY KEY REFERENCES accounts(client_id) ON DELETE CASCADE,
        strengths TEXT NOT NULL DEFAULT '[]',
        weaknesses TEXT NOT NULL DEFAULT '[]',
        top_problems TEXT NOT NULL DEFAULT '[]',
        recommended_actions TEXT NOT NULL DEFAULT '',
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS browser_audits (
        id TEXT PRIMARY KEY,
        client_id TEXT NOT NULL REFERENCES accounts(client_id) ON DELETE CASCADE,
        website_url TEXT NOT NULL,
        summary TEXT NOT NULL,
        flaws_json TEXT NOT NULL DEFAULT '[]',
        opportunities_json TEXT NOT NULL DEFAULT '[]',
        plan_json TEXT NOT NULL DEFAULT '[]',
        scores_json TEXT NOT NULL DEFAULT '{}',
        evidence_json TEXT NOT NULL DEFAULT '{}',
        screenshot_path TEXT,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS timeline_events (
        id TEXT PRIMARY KEY,
        client_id TEXT NOT NULL REFERENCES accounts(client_id) ON DELETE CASCADE,
        event_type TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        contact_name TEXT,
        notes TEXT NOT NULL DEFAULT '',
        duration INTEGER,
        follow_up_date TEXT,
        logged_by TEXT NOT NULL DEFAULT 'Hamid',
        metadata_json TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS memory (
        client_id TEXT PRIMARY KEY REFERENCES accounts(client_id) ON DELETE CASCADE,
        personality TEXT NOT NULL DEFAULT '',
        pain_points TEXT NOT NULL DEFAULT '',
        what_resonates TEXT NOT NULL DEFAULT '',
        what_to_avoid TEXT NOT NULL DEFAULT '',
        decision_process TEXT NOT NULL DEFAULT '',
        best_window TEXT NOT NULL DEFAULT '',
        conversation_highlights TEXT NOT NULL DEFAULT '[]',
        objections TEXT NOT NULL DEFAULT '[]',
        internal_notes TEXT NOT NULL DEFAULT '',
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS notes (
        id TEXT PRIMARY KEY,
        client_id TEXT NOT NULL REFERENCES accounts(client_id) ON DELETE CASCADE,
        body TEXT NOT NULL,
        pinned_at TEXT,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS call_logs (
        id TEXT PRIMARY KEY,
        client_id TEXT NOT NULL REFERENCES accounts(client_id) ON DELETE CASCADE,
        called_at TEXT NOT NULL,
        outcome TEXT NOT NULL,
        duration_minutes INTEGER,
        contact_name TEXT,
        notes TEXT NOT NULL DEFAULT '',
        follow_up_date TEXT,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS integration_snapshots (
        provider TEXT PRIMARY KEY,
        status TEXT NOT NULL,
        summary_json TEXT NOT NULL,
        data_json TEXT NOT NULL,
        error TEXT,
        synced_at TEXT NOT NULL
      );
    `);

    this.ensureColumn("contacts", "best_time", "TEXT");
    this.ensureColumn("contacts", "contact_preference", "TEXT");
    this.ensureColumn("contacts", "created_at", "TEXT");
    this.ensureColumn("contacts", "last_contacted_at", "TEXT");

    this.ensureColumn("tasks", "task_type", "TEXT");
    this.ensureColumn("tasks", "assigned_to", "TEXT");
    this.ensureColumn("tasks", "notes", "TEXT");
    this.ensureColumn("tasks", "completed_at", "TEXT");

    this.ensureColumn("proposals", "services_text", "TEXT");
    this.ensureColumn("proposals", "setup_fee", "INTEGER");
    this.ensureColumn("proposals", "monthly_retainer", "INTEGER");
    this.ensureColumn("proposals", "contract_length", "TEXT");
    this.ensureColumn("proposals", "estimated_delivery", "TEXT");
    this.ensureColumn("proposals", "sent_date", "TEXT");
    this.ensureColumn("proposals", "response_date", "TEXT");
    this.ensureColumn("proposals", "notes", "TEXT");
  }

  private ensureColumn(table: string, column: string, definition: string) {
    const validIdent = /^[a-z_][a-z0-9_]*$/;
    if (!validIdent.test(table) || !validIdent.test(column)) {
      throw new Error(`Invalid SQL identifier: table=${table}, column=${column}`);
    }
    const columns = this.db.prepare(`PRAGMA table_info(${table})`).all() as Array<{name: string}>;
    if (columns.some((entry) => entry.name === column)) return;
    this.db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition};`);
  }

  private ensureClient(clientId: string) {
    const row = this.db.prepare("SELECT client_id FROM clients WHERE client_id = ?").get(clientId) as RowWithClient | undefined;
    if (!row) throw new Error(`Client ${clientId} not found`);
  }

  private nextClientId() {
    const year = new Date().getFullYear();
    const key = `client-sequence-${year}`;
    const current = this.db.prepare("SELECT value_json FROM settings WHERE key = ?").get(key) as {value_json?: string} | undefined;
    const next = (current ? Number(jsonParse(current.value_json ?? "0", 0)) : 0) + 1;
    this.setSetting(key, next);
    return `EA-${year}-${String(next).padStart(6, "0")}`;
  }

  private upsertEnterpriseAccount(payload: {
    clientId: string;
    businessName: string;
    businessType: string;
    area: string;
    websiteUrl?: string | null;
    phoneNumber?: string | null;
    emailAddress?: string | null;
    googleRating?: number | null;
    reviewCount?: number | null;
    address?: string | null;
    accountStatus: string;
    priority: string;
    dueDate?: string | null;
    nextActionNotes?: string;
    siteScore: number;
    dealValue: number;
    closeProbability: number;
    sourceNotes?: string;
    imageHero?: string | null;
    imageServices?: string | null;
    demoFile?: string | null;
    videoFile?: string | null;
    emailFile?: string | null;
    createdAt?: string;
    updatedAt?: string;
  }) {
    const timestamp = nowIso();
    this.db.prepare(`
      INSERT INTO accounts (
        client_id, business_name, business_type, area, website_url, phone_number, email_address,
        google_rating, review_count, address, account_status, priority, due_date, next_action_notes,
        site_score, deal_value, close_probability, source_notes, image_hero, image_services, demo_file,
        video_file, email_file, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(client_id) DO UPDATE SET
        business_name = excluded.business_name,
        business_type = excluded.business_type,
        area = excluded.area,
        website_url = excluded.website_url,
        phone_number = excluded.phone_number,
        email_address = excluded.email_address,
        google_rating = excluded.google_rating,
        review_count = excluded.review_count,
        address = excluded.address,
        account_status = excluded.account_status,
        priority = excluded.priority,
        due_date = excluded.due_date,
        next_action_notes = excluded.next_action_notes,
        site_score = excluded.site_score,
        deal_value = excluded.deal_value,
        close_probability = excluded.close_probability,
        source_notes = excluded.source_notes,
        image_hero = excluded.image_hero,
        image_services = excluded.image_services,
        demo_file = excluded.demo_file,
        video_file = excluded.video_file,
        email_file = excluded.email_file,
        updated_at = excluded.updated_at
    `).run(
      payload.clientId,
      payload.businessName,
      payload.businessType,
      payload.area,
      payload.websiteUrl ?? null,
      payload.phoneNumber ?? null,
      payload.emailAddress ?? null,
      payload.googleRating ?? null,
      payload.reviewCount ?? null,
      payload.address ?? null,
      payload.accountStatus,
      payload.priority,
      payload.dueDate ?? null,
      payload.nextActionNotes ?? "",
      payload.siteScore,
      payload.dealValue,
      payload.closeProbability,
      payload.sourceNotes ?? "",
      payload.imageHero ?? null,
      payload.imageServices ?? null,
      payload.demoFile ?? null,
      payload.videoFile ?? null,
      payload.emailFile ?? null,
      payload.createdAt ?? timestamp,
      payload.updatedAt ?? timestamp
    );
  }

  private upsertAuditAnalysisRecord(clientId: string, payload?: {
    strengths?: string[];
    weaknesses?: string[];
    topProblems?: string[];
    recommendedActions?: string;
  }) {
    const timestamp = nowIso();
    this.db.prepare(`
      INSERT INTO audit_analysis (client_id, strengths, weaknesses, top_problems, recommended_actions, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(client_id) DO UPDATE SET
        strengths = excluded.strengths,
        weaknesses = excluded.weaknesses,
        top_problems = excluded.top_problems,
        recommended_actions = excluded.recommended_actions,
        updated_at = excluded.updated_at
    `).run(
      clientId,
      JSON.stringify(payload?.strengths ?? []),
      JSON.stringify(payload?.weaknesses ?? []),
      JSON.stringify(payload?.topProblems ?? []),
      payload?.recommendedActions ?? "",
      timestamp
    );
  }

  private upsertAuditScoresRecord(clientId: string, scores: Record<string, number>, notes?: Record<string, string>) {
    const stmt = this.db.prepare(`
      INSERT INTO audit_scores (client_id, criterion, score, note, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(client_id, criterion) DO UPDATE SET
        score = excluded.score,
        note = excluded.note,
        updated_at = excluded.updated_at
    `);
    const timestamp = nowIso();
    for (const [criterion, score] of Object.entries(scores)) {
      stmt.run(clientId, criterion, Math.max(0, Math.min(10, Math.round(score))), notes?.[criterion] ?? "", timestamp);
    }
  }

  private setPrimaryContact(clientId: string, contactId: string) {
    this.db.prepare("UPDATE contacts SET is_primary = 0 WHERE client_id = ?").run(clientId);
    this.db.prepare("UPDATE contacts SET is_primary = 1 WHERE id = ? AND client_id = ?").run(contactId, clientId);
  }

  syncPipelineData(data: DashboardData) {
    this.db.exec("BEGIN");
    try {
      for (const client of data.clients) {
        this.upsertPipelineClient(client);
      }
      this.setSetting("last_pipeline_sync", {
        timestamp: nowIso(),
        generatedAt: data.generatedAt,
        clientCount: data.clients.length,
        totalProspects: data.metrics.totalProspects,
      });
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  private upsertPipelineClient(client: ClientRecord) {
    const existing = this.db.prepare("SELECT client_id, account_status, follow_up_priority, follow_up_next_step, follow_up_due_date, close_probability, value_estimate, owner_name, last_contacted_at, enrichment_json, objections_json FROM clients WHERE client_id = ?").get(client.clientId) as Partial<ClientRow> | undefined;
    const timestamp = nowIso();
    const upsert = this.db.prepare(`
      INSERT INTO clients (
        client_id, business_name, business_type, area, website_url, phone_number, email_address, google_rating, review_count, address,
        source_url, source_title, source_description, score, account_status, follow_up_priority, follow_up_next_step, follow_up_due_date,
        contact_summary, strengths_json, weaknesses_json, recommended_actions_json, top_problems_json, audit_scores_json, audit_notes_json,
        audit_metadata_json, image_hero, image_services, demo_file, video_file, email_file, owner_name, health_band, last_contacted_at,
        close_probability, value_estimate, objections_json, enrichment_json, pipeline_origin, created_at, updated_at
      ) VALUES (
        @client_id, @business_name, @business_type, @area, @website_url, @phone_number, @email_address, @google_rating, @review_count, @address,
        @source_url, @source_title, @source_description, @score, @account_status, @follow_up_priority, @follow_up_next_step, @follow_up_due_date,
        @contact_summary, @strengths_json, @weaknesses_json, @recommended_actions_json, @top_problems_json, @audit_scores_json, @audit_notes_json,
        @audit_metadata_json, @image_hero, @image_services, @demo_file, @video_file, @email_file, @owner_name, @health_band, @last_contacted_at,
        @close_probability, @value_estimate, @objections_json, @enrichment_json, 1, @created_at, @updated_at
      )
      ON CONFLICT(client_id) DO UPDATE SET
        business_name = excluded.business_name,
        business_type = excluded.business_type,
        area = excluded.area,
        website_url = excluded.website_url,
        phone_number = excluded.phone_number,
        email_address = excluded.email_address,
        google_rating = excluded.google_rating,
        review_count = excluded.review_count,
        address = excluded.address,
        source_url = excluded.source_url,
        source_title = excluded.source_title,
        source_description = excluded.source_description,
        score = excluded.score,
        contact_summary = excluded.contact_summary,
        strengths_json = excluded.strengths_json,
        weaknesses_json = excluded.weaknesses_json,
        recommended_actions_json = excluded.recommended_actions_json,
        top_problems_json = excluded.top_problems_json,
        audit_scores_json = excluded.audit_scores_json,
        audit_notes_json = excluded.audit_notes_json,
        audit_metadata_json = excluded.audit_metadata_json,
        image_hero = excluded.image_hero,
        image_services = excluded.image_services,
        demo_file = excluded.demo_file,
        video_file = excluded.video_file,
        email_file = excluded.email_file,
        health_band = excluded.health_band,
        updated_at = excluded.updated_at,
        pipeline_origin = 1
    `);

    upsert.run({
      client_id: client.clientId,
      business_name: client.businessName,
      business_type: client.businessType,
      area: client.area,
      website_url: client.websiteUrl,
      phone_number: client.phoneNumber,
      email_address: client.emailAddress,
      google_rating: client.googleRating,
      review_count: client.reviewCount,
      address: client.address,
      source_url: client.sourceUrl,
      source_title: client.sourceTitle,
      source_description: client.sourceDescription,
      score: client.audit.totalScore,
      account_status: existing?.account_status ?? client.accountStatus,
      follow_up_priority: existing?.follow_up_priority ?? client.followUp.priority,
      follow_up_next_step: existing?.follow_up_next_step ?? client.followUp.nextStep,
      follow_up_due_date: existing?.follow_up_due_date ?? client.followUp.dueDate,
      contact_summary: client.contactSummary,
      strengths_json: JSON.stringify(client.strengths),
      weaknesses_json: JSON.stringify(client.weaknesses),
      recommended_actions_json: JSON.stringify(client.recommendedActions),
      top_problems_json: JSON.stringify(client.audit.topProblems),
      audit_scores_json: JSON.stringify(client.audit.scores),
      audit_notes_json: JSON.stringify(client.audit.notes),
      audit_metadata_json: JSON.stringify(client.audit.metadata),
      image_hero: client.imageAssets.hero,
      image_services: client.imageAssets.services,
      demo_file: client.demoFile,
      video_file: client.videoFile,
      email_file: client.emailFile,
      owner_name: existing?.owner_name ?? brand.ownerName,
      health_band: healthBand(client.audit.totalScore),
      last_contacted_at: existing?.last_contacted_at ?? null,
      close_probability: existing?.close_probability ?? 0,
      value_estimate: existing?.value_estimate ?? 0,
      objections_json: existing?.objections_json ?? "[]",
      enrichment_json:
        existing?.enrichment_json ??
        JSON.stringify({
          rating: client.googleRating,
          reviewCount: client.reviewCount,
          strengths: client.strengths,
          weaknesses: client.weaknesses,
          capturedAt: timestamp,
        }),
      created_at: (existing as {created_at?: string} | undefined)?.created_at ?? timestamp,
      updated_at: timestamp,
    });

    this.upsertEnterpriseAccount({
      clientId: client.clientId,
      businessName: client.businessName,
      businessType: client.businessType,
      area: client.area,
      websiteUrl: client.websiteUrl,
      phoneNumber: client.phoneNumber,
      emailAddress: client.emailAddress,
      googleRating: client.googleRating,
      reviewCount: client.reviewCount,
      address: client.address,
      accountStatus: existing?.account_status ?? client.accountStatus,
      priority: existing?.follow_up_priority ?? client.followUp.priority,
      dueDate: existing?.follow_up_due_date ?? client.followUp.dueDate,
      nextActionNotes: existing?.follow_up_next_step ?? client.followUp.nextStep,
      siteScore: client.audit.totalScore,
      dealValue: existing?.value_estimate ?? 0,
      closeProbability: existing?.close_probability ?? 0,
      sourceNotes: client.sourceDescription ?? "",
      imageHero: client.imageAssets.hero,
      imageServices: client.imageAssets.services,
      demoFile: client.demoFile,
      videoFile: client.videoFile,
      emailFile: client.emailFile,
      createdAt: (existing as {created_at?: string} | undefined)?.created_at ?? timestamp,
    });
    this.upsertAuditScoresRecord(client.clientId, client.audit.scores, Object.fromEntries(
      Object.entries(client.audit.scores).map(([criterion], index) => [criterion, client.audit.notes[index] ?? ""])
    ));
    this.upsertAuditAnalysisRecord(client.clientId, {
      strengths: client.strengths,
      weaknesses: client.weaknesses,
      topProblems: client.audit.topProblems,
      recommendedActions: client.recommendedActions.join("\n"),
    });

    if (!(this.db.prepare("SELECT 1 FROM comments WHERE client_id = ? LIMIT 1").get(client.clientId) as {1: number} | undefined)) {
      this.insertComment(client.clientId, seededComment(client));
    }

    const existingActivityCount = this.db.prepare("SELECT COUNT(*) as count FROM activities WHERE client_id = ?").get(client.clientId) as {count: number};
    if (!existingActivityCount.count) {
      for (const activity of client.outreachActivities) {
        this.insertActivity(client.clientId, activity, "pipeline");
      }
    }

    const existingAssetCount = this.db.prepare("SELECT COUNT(*) as count FROM assets WHERE client_id = ?").get(client.clientId) as {count: number};
    if (!existingAssetCount.count) {
      for (const asset of linkedAssets(client)) {
        this.insertAsset(client.clientId, asset);
      }
    }
  }

  private setSetting(key: string, value: unknown) {
    this.db.prepare(`
      INSERT INTO settings (key, value_json) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json
    `).run(key, JSON.stringify(value));
  }

  getState(): DashboardAppState {
    const clientRows = this.db.prepare("SELECT * FROM clients ORDER BY score ASC, updated_at DESC").all() as ClientRow[];
    const contacts = this.groupByClient<ClientContact>(this.db.prepare("SELECT * FROM contacts").all() as Array<Record<string, unknown>>, (row) => ({
      id: String(row.id),
      fullName: String(row.full_name),
      role: String(row.role),
      email: (row.email as string | null) ?? null,
      phone: (row.phone as string | null) ?? null,
      linkedin: (row.linkedin as string | null) ?? null,
      isPrimary: Boolean(row.is_primary),
      notes: String(row.notes ?? ""),
      status: String(row.status ?? "reachable") as ClientContact["status"],
    }));
    const activities = this.groupByClient<OutreachActivity>(this.db.prepare("SELECT * FROM activities ORDER BY created_at DESC").all() as Array<Record<string, unknown>>, (row) => ({
      id: String(row.id),
      type: String(row.type) as OutreachActivity["type"],
      status: String(row.status) as OutreachActivity["status"],
      title: String(row.title),
      summary: String(row.summary),
      owner: String(row.owner),
      createdAt: String(row.created_at),
      scheduledFor: (row.scheduled_for as string | null) ?? null,
      completedAt: (row.completed_at as string | null) ?? null,
      linkedFiles: jsonParse<string[]>(row.linked_files_json as string, []),
      linkedChannels: jsonParse<string[]>(row.linked_channels_json as string, []),
      eventSource: String(row.event_source ?? "manual") as OutreachActivity["eventSource"],
      metadata: jsonParse<Record<string, unknown>>(row.metadata_json as string, {}),
    }));
    const tasks = this.groupByClient<ClientTask>(this.db.prepare("SELECT * FROM tasks ORDER BY due_date ASC, created_at DESC").all() as Array<Record<string, unknown>>, (row) => ({
      id: String(row.id),
      title: String(row.title),
      description: String(row.description),
      status: String(row.status) as ClientTask["status"],
      priority: String(row.priority) as ClientTask["priority"],
      dueDate: String(row.due_date),
      owner: String(row.owner),
      lane: String(row.lane),
      createdAt: String(row.created_at),
    }));
    const memories = this.groupByClientOrGlobal<ClientMemory>(this.db.prepare("SELECT * FROM memories ORDER BY updated_at DESC").all() as Array<Record<string, unknown>>, (row) => ({
      id: String(row.id),
      clientId: (row.client_id as string | null) ?? null,
      kind: String(row.kind) as ClientMemory["kind"],
      title: String(row.title),
      note: String(row.note),
      tags: jsonParse<string[]>(row.tags_json as string, []),
      source: String(row.source) as ClientMemory["source"],
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    }));
    const proposals = this.groupByClient<ClientProposal>(this.db.prepare("SELECT * FROM proposals ORDER BY updated_at DESC").all() as Array<Record<string, unknown>>, (row) => ({
      id: String(row.id),
      title: String(row.title),
      status: String(row.status) as ClientProposal["status"],
      packageName: String(row.package_name),
      price: Number(row.price),
      probability: Number(row.probability),
      nextStep: String(row.next_step),
      scope: jsonParse<string[]>(row.scope_json as string, []),
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    }));
    const comments = this.groupByClient<ClientComment>(this.db.prepare("SELECT * FROM comments ORDER BY created_at DESC").all() as Array<Record<string, unknown>>, (row) => ({
      id: String(row.id),
      author: String(row.author),
      body: String(row.body),
      createdAt: String(row.created_at),
      type: String(row.type) as ClientComment["type"],
    }));
    const assets = this.groupByClient(this.db.prepare("SELECT * FROM assets ORDER BY version DESC, created_at DESC").all() as Array<Record<string, unknown>>, (row) => ({
      id: String(row.id),
      assetType: String(row.asset_type) as "demo" | "email" | "image" | "video",
      label: String(row.label),
      filePath: String(row.file_path),
      version: Number(row.version),
      status: String(row.status) as "draft" | "ready" | "sent" | "planned",
      createdAt: String(row.created_at),
      metadata: jsonParse<Record<string, unknown>>(row.metadata_json as string, {}),
    }));
    const settings = Object.fromEntries(
      (this.db.prepare("SELECT * FROM settings").all() as Array<{key: string; value_json: string}>).map((row) => [row.key, jsonParse(row.value_json, null)])
    );

    const clients = clientRows.map((row) => {
      const clientActivities = activities[row.client_id] ?? [];
      const clientProposals = proposals[row.client_id] ?? [];
      return {
        id: row.client_id,
        clientId: row.client_id,
        businessName: row.business_name,
        businessType: row.business_type,
        area: row.area,
        websiteUrl: row.website_url,
        phoneNumber: row.phone_number,
        emailAddress: row.email_address,
        googleRating: row.google_rating,
        reviewCount: row.review_count,
        address: row.address,
        sourceUrl: row.source_url,
        sourceTitle: row.source_title,
        sourceDescription: row.source_description,
        audit: {
          leadId: row.client_id,
          websiteUrl: row.website_url,
          scores: jsonParse(row.audit_scores_json, {
            designQuality: 0,
            mobileResponsiveness: 0,
            pageSpeed: 0,
            clearHeadline: 0,
            callToAction: 0,
            contactVisibility: 0,
            trustSignals: 0,
            seoBasics: 0,
            contentQuality: 0,
            googleReviewsOnWebsite: 0,
          }),
          totalScore: row.score,
          topProblems: jsonParse<string[]>(row.top_problems_json, []),
          notes: jsonParse<string[]>(row.audit_notes_json, []),
          scrapeMarkdown: null,
          scrapeHtml: null,
          metadata: jsonParse<Record<string, unknown>>(row.audit_metadata_json, {}),
        },
        imageAssets: {
          hero: row.image_hero,
          services: row.image_services,
        },
        demoFile: row.demo_file,
        videoFile: row.video_file,
        emailFile: row.email_file,
        accountStatus: row.account_status as ClientRecord["accountStatus"],
        strengths: jsonParse<string[]>(row.strengths_json, []),
        weaknesses: jsonParse<string[]>(row.weaknesses_json, []),
        recommendedActions: jsonParse<string[]>(row.recommended_actions_json, []),
        outreachActivities: clientActivities,
        followUp: {
          priority: row.follow_up_priority as ClientRecord["followUp"]["priority"],
          nextStep: row.follow_up_next_step,
          dueDate: row.follow_up_due_date,
        },
        artifacts: {
          demoFile: row.demo_file,
          emailFile: row.email_file,
          videoFile: row.video_file,
          heroImage: row.image_hero,
          servicesImage: row.image_services,
        },
        contactSummary: row.contact_summary,
        contacts: contacts[row.client_id] ?? [],
        tasks: tasks[row.client_id] ?? [],
        memories: memories.byClient[row.client_id] ?? [],
        proposals: clientProposals,
        comments: comments[row.client_id] ?? [],
        assets: assets[row.client_id] ?? [],
        owner: row.owner_name,
        lastContactedAt: row.last_contacted_at,
        closeProbability: row.close_probability,
        valueEstimate: row.value_estimate,
        healthBand: row.health_band as ClientRecord["healthBand"],
        objections: jsonParse<string[]>(row.objections_json, []),
        enrichment: jsonParse<Record<string, unknown>>(row.enrichment_json, {}),
        aiSummary: this.buildAiSummary({
          businessName: row.business_name,
          businessType: row.business_type,
          score: row.score,
          status: row.account_status,
          topProblems: jsonParse<string[]>(row.top_problems_json, []),
          nextStep: row.follow_up_next_step,
          tasks: tasks[row.client_id] ?? [],
          proposals: clientProposals,
          activities: clientActivities,
        }),
      } satisfies ClientRecord;
    });

    return {
      version: APP_STATE_VERSION,
      generatedAt: nowIso(),
      owner: brand.ownerName,
      brand: brand.businessName,
      metrics: this.buildMetrics(clients),
      clients,
      globalMemories: memories.global,
      sync: {
        databasePath: outputFiles.crmDatabase,
        lastPipelineSync: settings.last_pipeline_sync ?? null,
        emailConnectorReady: false,
        callConnectorReady: false,
        stripeConnectorReady: Boolean(process.env.STRIPE_SECRET_KEY || process.env.STRIPE_RESTRICTED_KEY),
      },
      suggestions: this.buildSuggestions(clients),
    };
  }

  private buildAiSummary(input: {
    businessName: string;
    businessType: string;
    score: number;
    status: string;
    topProblems: string[];
    nextStep: string;
    tasks: ClientTask[];
    proposals: ClientProposal[];
    activities: OutreachActivity[];
  }) {
    const overdue = input.tasks.filter((task) => task.status !== "done" && task.dueDate < nowIso().slice(0, 10)).length;
    const proposal = input.proposals[0];
    return {
      headline: `${input.businessName} is a ${input.score <= 25 ? "high-conviction" : input.score <= 40 ? "viable" : "moderate"} ${input.businessType.toLowerCase()} opportunity.`,
      nextBestAction: overdue
        ? `Clear ${overdue} overdue task${overdue === 1 ? "" : "s"} and then ${input.nextStep.toLowerCase()}`
        : input.nextStep,
      risk: input.status === "proposal" && proposal && proposal.probability < 45
        ? "Proposal is live but confidence is low. Add a more specific ROI case before the next touch."
        : `Primary risks are ${input.topProblems.slice(0, 2).join(" and ").toLowerCase()}.`,
      talkingPoint: input.topProblems[0] ?? "Lead with the demo and the speed of execution.",
      momentum: input.activities.some((activity) => activity.type === "email" && ["sent", "delivered", "replied"].includes(activity.status))
        ? "Outbound motion has started."
        : "No outbound activity has been logged yet.",
    };
  }

  private buildMetrics(clients: ClientRecord[]): DashboardMetrics {
    const totalProspects = clients.length;
    const qualifiedLeads = clients.length;
    const demosBuilt = clients.filter((client) => client.assets.some((asset) => asset.assetType === "demo")).length;
    const emailDraftsReady = clients.filter((client) => client.assets.some((asset) => asset.assetType === "email")).length;
    const videosPrepared = clients.filter((client) => client.assets.some((asset) => asset.assetType === "video")).length;
    const highPriorityFollowUps = clients.filter((client) => client.followUp.priority === "high").length;
    const overdueTasks = clients.flatMap((client) => client.tasks).filter((task) => task.status !== "done" && task.dueDate < nowIso().slice(0, 10)).length;
    const repliedAccounts = clients.filter((client) => client.accountStatus === "replied").length;
    const proposalStage = clients.filter((client) => client.accountStatus === "proposal").length;
    const weightedPipeline = clients.reduce((sum, client) => sum + client.valueEstimate * (client.closeProbability / 100), 0);
    const revenueCollected = clients.filter((client) => client.accountStatus === "won").reduce((sum, client) => sum + client.valueEstimate, 0);
    const liveActivityCount = clients.reduce((sum, client) => sum + client.outreachActivities.length, 0);
    const avgScore = clients.length ? Math.round(clients.reduce((sum, client) => sum + client.audit.totalScore, 0) / clients.length) : 0;
    const bookedRate = clients.length ? Math.round((clients.filter((client) => ["proposal", "won"].includes(client.accountStatus)).length / clients.length) * 100) : 0;

    return {
      totalProspects,
      qualifiedLeads,
      demosBuilt,
      emailDraftsReady,
      videosPrepared,
      highPriorityFollowUps,
      overdueTasks,
      repliedAccounts,
      proposalStage,
      weightedPipeline,
      revenueCollected,
      liveActivityCount,
      avgScore,
      bookedRate,
    };
  }

  private buildSuggestions(clients: ClientRecord[]) {
    const highRisk = clients.filter((client) => client.healthBand === "critical").length;
    const readyToSend = clients.filter((client) => client.accountStatus === "ready-to-send").length;
    const missingContacts = clients.filter((client) => !client.contacts.some((contact) => contact.email || contact.phone)).length;
    const proposalGaps = clients.filter((client) => !client.proposals.length).length;
    return [
      {
        id: "focus-queue",
        title: "Push the highest-conviction queue first",
        body: `${readyToSend} accounts are ready to send. Start with the lowest-score businesses to maximize conversion odds.`,
        tone: "info" as const,
      },
      {
        id: "contact-coverage",
        title: "Complete missing stakeholder records",
        body: missingContacts ? `${missingContacts} accounts still need direct contact coverage beyond the scraped owner record.` : "Every account has at least one reachable contact route logged.",
        tone: missingContacts ? ("warning" as const) : ("positive" as const),
      },
      {
        id: "risk-watch",
        title: "Reduce account risk",
        body: highRisk ? `${highRisk} accounts sit in the critical band. Prioritize faster demo sends and tighter follow-up timing for them.` : "Critical account risk is currently under control.",
        tone: highRisk ? ("warning" as const) : ("positive" as const),
      },
      {
        id: "proposal-coverage",
        title: "Tighten closing readiness",
        body: proposalGaps ? `${proposalGaps} accounts still do not have a proposal layer attached.` : "Every account already has an attached proposal path.",
        tone: proposalGaps ? ("warning" as const) : ("positive" as const),
      },
    ];
  }

  private groupByClient<T>(rows: Array<Record<string, unknown>>, map: (row: Record<string, unknown>) => T) {
    const output: Record<string, T[]> = {};
    for (const row of rows) {
      const clientId = String(row.client_id);
      output[clientId] ??= [];
      output[clientId].push(map(row));
    }
    return output;
  }

  private groupByClientOrGlobal<T extends {clientId: string | null}>(rows: Array<Record<string, unknown>>, map: (row: Record<string, unknown>) => T) {
    const output: Record<string, T[]> = {};
    const global: T[] = [];
    for (const row of rows) {
      const item = map(row);
      if (item.clientId) {
        output[item.clientId] ??= [];
        output[item.clientId].push(item);
      } else {
        global.push(item);
      }
    }
    return {byClient: output, global};
  }

  createClient(payload: {
    businessName: string;
    businessType: string;
    area: string;
    emailAddress?: string | null;
    phoneNumber?: string | null;
    websiteUrl?: string | null;
    address?: string | null;
    googleRating?: number | null;
    reviewCount?: number | null;
    accountStatus?: ClientRecord["accountStatus"];
    priority?: ClientRecord["followUp"]["priority"];
    dueDate?: string | null;
    nextActionNotes?: string;
    dealValue?: number;
    siteScore?: number;
    sourceNotes?: string;
  }) {
    const clientId = this.nextClientId();
    const timestamp = nowIso();
    const score = payload.siteScore ?? 0;
    const priority = payload.priority ?? "medium";
    const status = payload.accountStatus ?? "researched";
    const dealValue = payload.dealValue ?? 1500;
    const dueDate = payload.dueDate ?? nowIso().slice(0, 10);
    const nextActionNotes = payload.nextActionNotes ?? "Research contacts and build a demo brief.";
    const clientStub: ClientRecord = {
      id: clientId,
      clientId,
      businessName: payload.businessName,
      businessType: payload.businessType,
      area: payload.area,
      websiteUrl: payload.websiteUrl ?? null,
      phoneNumber: payload.phoneNumber ?? null,
      emailAddress: payload.emailAddress ?? null,
      googleRating: payload.googleRating ?? null,
      reviewCount: payload.reviewCount ?? null,
      address: payload.address ?? null,
      sourceUrl: null,
      sourceTitle: null,
      sourceDescription: payload.sourceNotes ?? null,
      audit: {
        leadId: clientId,
        websiteUrl: payload.websiteUrl ?? null,
        scores: {
          designQuality: 0,
          mobileResponsiveness: 0,
          pageSpeed: 0,
          clearHeadline: 0,
          callToAction: 0,
          contactVisibility: 0,
          trustSignals: 0,
          seoBasics: 0,
          contentQuality: 0,
          googleReviewsOnWebsite: 0,
        },
        totalScore: score,
        topProblems: ["Manual account created before full audit.", "No website analysis logged yet.", "Next actions need to be defined."],
        notes: ["Created manually in the CRM workspace."],
        scrapeMarkdown: null,
        scrapeHtml: null,
        metadata: {},
      },
      imageAssets: {hero: "", services: ""},
      demoFile: "",
      videoFile: "",
      emailFile: "",
      accountStatus: status,
      strengths: [],
      weaknesses: [],
      recommendedActions: ["Research the account, create a demo brief, and prepare the first outbound touch."],
      outreachActivities: [],
      followUp: {
        priority,
        nextStep: nextActionNotes,
        dueDate,
      },
      artifacts: {
        demoFile: "",
        emailFile: "",
        videoFile: "",
        heroImage: "",
        servicesImage: "",
      },
      contactSummary: `${payload.businessName} (${payload.businessType}) in ${payload.area}`,
      contacts: [],
      tasks: [],
      memories: [],
      proposals: [],
      comments: [],
      assets: [],
      owner: brand.ownerName,
      lastContactedAt: null,
      closeProbability: 35,
      valueEstimate: dealValue,
      healthBand: healthBand(score) as ClientRecord["healthBand"],
      objections: [],
      enrichment: {},
      aiSummary: {
        headline: `${payload.businessName} was created manually and needs initial qualification.`,
        nextBestAction: "Research the site, confirm the right stakeholder, and create a demo angle.",
        risk: "No audit or creative assets are attached yet.",
        talkingPoint: "Lead with a fresh review of their current website and conversion opportunities.",
        momentum: "Manual account created. No live outreach has been logged yet.",
      },
    };
    this.db.prepare(`
      INSERT INTO clients (
        client_id, business_name, business_type, area, website_url, phone_number, email_address, google_rating, review_count, address,
        source_url, source_title, source_description, score, account_status, follow_up_priority, follow_up_next_step, follow_up_due_date,
        contact_summary, strengths_json, weaknesses_json, recommended_actions_json, top_problems_json, audit_scores_json, audit_notes_json,
        audit_metadata_json, image_hero, image_services, demo_file, video_file, email_file, owner_name, health_band, last_contacted_at,
        close_probability, value_estimate, objections_json, enrichment_json, pipeline_origin, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?, ?, ?, ?, ?, ?, '[]', '[]', '[]', '[]', '{}', '[]', '{}', '', '', '', '', '', ?, ?, NULL, 35, ?, '[]', '{}', 0, ?, ?)
    `).run(
      clientId,
      payload.businessName,
      payload.businessType,
      payload.area,
      payload.websiteUrl ?? null,
      payload.phoneNumber ?? null,
      payload.emailAddress ?? null,
      payload.googleRating ?? null,
      payload.reviewCount ?? null,
      payload.address ?? null,
      payload.sourceNotes ?? null,
      score,
      status,
      priority,
      nextActionNotes,
      dueDate,
      `${payload.businessName} (${payload.businessType}) in ${payload.area}`,
      brand.ownerName,
      healthBand(score),
      dealValue,
      timestamp,
      timestamp
    );

    this.upsertEnterpriseAccount({
      clientId,
      businessName: payload.businessName,
      businessType: payload.businessType,
      area: payload.area,
      websiteUrl: payload.websiteUrl ?? null,
      phoneNumber: payload.phoneNumber ?? null,
      emailAddress: payload.emailAddress ?? null,
      googleRating: payload.googleRating ?? null,
      reviewCount: payload.reviewCount ?? null,
      address: payload.address ?? null,
      accountStatus: status,
      priority,
      dueDate,
      nextActionNotes,
      siteScore: score,
      dealValue,
      closeProbability: 35,
      sourceNotes: payload.sourceNotes ?? "",
      createdAt: timestamp,
    });
    this.upsertAuditScoresRecord(clientId, clientStub.audit.scores);
    this.upsertAuditAnalysisRecord(clientId, {
      strengths: [],
      weaknesses: [],
      topProblems: clientStub.audit.topProblems,
      recommendedActions: clientStub.recommendedActions.join("\n"),
    });

    this.insertContact(clientId, {
      id: `CON-${uniqueId(clientId, "primary-manual")}`,
      fullName: "Primary contact",
      role: "Owner / manager",
      email: payload.emailAddress ?? null,
      phone: payload.phoneNumber ?? null,
      linkedin: null,
      isPrimary: true,
      notes: "Created manually from the CRM workspace.",
      status: payload.emailAddress || payload.phoneNumber ? "reachable" : "needs-research",
    });
    this.insertComment(clientId, {
      id: `NOTE-${uniqueId(clientId, "created")}`,
      author: brand.ownerName,
      body: "Manual account added to the CRM workspace.",
      createdAt: timestamp,
      type: "system",
    });
    this.addTimelineEvent(clientId, {
      id: `TL-${uniqueId(clientId, "account-created")}`,
      eventType: "Account created",
      timestamp,
      contactName: null,
      notes: "Account created from the New Account modal.",
      duration: null,
      followUpDate: dueDate,
      loggedBy: brand.ownerName,
      metadata: {source: "manual"},
    });
    return clientId;
  }

  deleteClient(clientId: string) {
    this.ensureClient(clientId);
    this.db.exec("BEGIN");
    try {
      for (const table of [
        "activities", "tasks", "contacts", "memories", "proposals", "comments", "assets",
        "audit_scores", "audit_analysis", "timeline_events", "memory", "notes", "call_logs",
      ]) {
        this.db.prepare(`DELETE FROM ${table} WHERE client_id = ?`).run(clientId);
      }
      this.db.prepare("DELETE FROM accounts WHERE client_id = ?").run(clientId);
      this.db.prepare("DELETE FROM clients WHERE client_id = ?").run(clientId);
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  searchClients(query: string, statusFilter: string, priorityFilter: string) {
    let sql = "SELECT client_id, business_name, business_type, area, account_status, follow_up_priority, score FROM clients WHERE 1=1";
    const params: Array<string | number> = [];
    if (query) {
      sql += " AND (business_name LIKE ? OR business_type LIKE ? OR area LIKE ? OR email_address LIKE ?)";
      const like = `%${query}%`;
      params.push(like, like, like, like);
    }
    if (statusFilter) {
      sql += " AND account_status = ?";
      params.push(statusFilter);
    }
    if (priorityFilter) {
      sql += " AND follow_up_priority = ?";
      params.push(priorityFilter);
    }
    sql += " ORDER BY score ASC, updated_at DESC LIMIT 100";
    return this.db.prepare(sql).all(...params);
  }

  backup(targetPath?: string) {
    const backupPath = targetPath ?? `${outputFiles.crmDatabase}.backup-${Date.now()}`;
    fs.copyFileSync(outputFiles.crmDatabase, backupPath);
    return backupPath;
  }

  updateClient(clientId: string, patch: Partial<{
    accountStatus: ClientRecord["accountStatus"];
    followUpPriority: ClientRecord["followUp"]["priority"];
    followUpNextStep: string;
    followUpDueDate: string;
    owner: string;
    closeProbability: number;
    valueEstimate: number;
    lastContactedAt: string | null;
    businessName: string;
    businessType: string;
    area: string;
    websiteUrl: string | null;
    phoneNumber: string | null;
    emailAddress: string | null;
    address: string | null;
    googleRating: number | null;
    reviewCount: number | null;
    score: number;
    sourceNotes: string;
    heroImage: string | null;
    servicesImage: string | null;
    demoFile: string | null;
    videoFile: string | null;
    emailFile: string | null;
  }>) {
    this.ensureClient(clientId);
    const fields: string[] = [];
    const values: Array<string | number | null> = [];
    const mapping: Record<string, string> = {
      accountStatus: "account_status",
      followUpPriority: "follow_up_priority",
      followUpNextStep: "follow_up_next_step",
      followUpDueDate: "follow_up_due_date",
      owner: "owner_name",
      closeProbability: "close_probability",
      valueEstimate: "value_estimate",
      lastContactedAt: "last_contacted_at",
      businessName: "business_name",
      businessType: "business_type",
      area: "area",
      websiteUrl: "website_url",
      phoneNumber: "phone_number",
      emailAddress: "email_address",
      address: "address",
      googleRating: "google_rating",
      reviewCount: "review_count",
      score: "score",
      sourceNotes: "source_description",
      heroImage: "image_hero",
      servicesImage: "image_services",
      demoFile: "demo_file",
      videoFile: "video_file",
      emailFile: "email_file",
    };
    for (const [key, value] of Object.entries(patch)) {
      if (value === undefined) continue;
      fields.push(`${mapping[key]} = ?`);
      values.push(value);
    }
    if (!fields.length) return;
    fields.push("updated_at = ?");
    values.push(nowIso(), clientId);
    this.db.prepare(`UPDATE clients SET ${fields.join(", ")} WHERE client_id = ?`).run(...values);

    const current = this.db.prepare("SELECT * FROM clients WHERE client_id = ?").get(clientId) as ClientRow;
    this.upsertEnterpriseAccount({
      clientId,
      businessName: current.business_name,
      businessType: current.business_type,
      area: current.area,
      websiteUrl: current.website_url,
      phoneNumber: current.phone_number,
      emailAddress: current.email_address,
      googleRating: current.google_rating,
      reviewCount: current.review_count,
      address: current.address,
      accountStatus: current.account_status,
      priority: current.follow_up_priority,
      dueDate: current.follow_up_due_date,
      nextActionNotes: current.follow_up_next_step,
      siteScore: current.score,
      dealValue: current.value_estimate,
      closeProbability: current.close_probability,
      sourceNotes: current.source_description ?? "",
      imageHero: current.image_hero,
      imageServices: current.image_services,
      demoFile: current.demo_file,
      videoFile: current.video_file,
      emailFile: current.email_file,
      createdAt: current.created_at,
    });
  }

  insertContact(clientId: string, contact: ClientContact) {
    this.ensureClient(clientId);
    this.db.prepare(`
      INSERT OR REPLACE INTO contacts (id, client_id, full_name, role, email, phone, linkedin, is_primary, notes, status, best_time, contact_preference, created_at, last_contacted_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE((SELECT last_contacted_at FROM contacts WHERE id = ?), NULL))
    `).run(
      contact.id,
      clientId,
      contact.fullName,
      contact.role,
      contact.email,
      contact.phone,
      contact.linkedin,
      contact.isPrimary ? 1 : 0,
      contact.notes,
      contact.status,
      "Any time",
      "Both",
      nowIso(),
      contact.id
    );
    if (contact.isPrimary) this.setPrimaryContact(clientId, contact.id);
  }

  insertActivity(clientId: string, activity: OutreachActivity, eventSource: OutreachActivity["eventSource"] = "manual") {
    this.ensureClient(clientId);
    this.db.prepare(`
      INSERT OR REPLACE INTO activities (
        id, client_id, type, status, title, summary, owner, created_at, scheduled_for, completed_at,
        linked_files_json, linked_channels_json, event_source, metadata_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      activity.id,
      clientId,
      activity.type,
      activity.status,
      activity.title,
      activity.summary,
      activity.owner,
      activity.createdAt,
      activity.scheduledFor,
      activity.completedAt,
      JSON.stringify(activity.linkedFiles ?? []),
      JSON.stringify(activity.linkedChannels ?? []),
      eventSource,
      JSON.stringify(activity.metadata ?? {})
    );
    this.addTimelineEvent(clientId, {
      id: `TL-${activity.id}`,
      eventType: activity.title,
      timestamp: activity.createdAt,
      contactName: null,
      notes: activity.summary,
      duration: null,
      followUpDate: activity.scheduledFor,
      loggedBy: activity.owner,
      metadata: {type: activity.type, status: activity.status, eventSource},
    });
  }

  insertTask(clientId: string, task: ClientTask) {
    this.ensureClient(clientId);
    this.db.prepare(`
      INSERT OR REPLACE INTO tasks (id, client_id, title, description, status, priority, due_date, owner, lane, created_at, task_type, assigned_to, notes, completed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE((SELECT completed_at FROM tasks WHERE id = ?), NULL))
    `).run(task.id, clientId, task.title, task.description, task.status, task.priority, task.dueDate, task.owner, task.lane, task.createdAt, task.lane, task.owner, task.description, task.id);
  }

  updateTask(taskId: string, patch: Partial<Pick<ClientTask, "status" | "priority" | "dueDate" | "owner">>) {
    const fields: string[] = [];
    const values: Array<string | number | null> = [];
    const mapping: Record<string, string> = {status: "status", priority: "priority", dueDate: "due_date", owner: "owner"};
    for (const [key, value] of Object.entries(patch)) {
      if (value === undefined) continue;
      fields.push(`${mapping[key]} = ?`);
      values.push(value);
    }
    if (!fields.length) return;
    if (patch.status === "done") {
      fields.push("completed_at = ?");
      values.push(nowIso());
    }
    if (patch.status && patch.status !== "done") {
      fields.push("completed_at = ?");
      values.push(null);
    }
    values.push(taskId);
    this.db.prepare(`UPDATE tasks SET ${fields.join(", ")} WHERE id = ?`).run(...values);
  }

  insertMemory(memory: ClientMemory) {
    this.db.prepare(`
      INSERT OR REPLACE INTO memories (id, client_id, kind, title, note, tags_json, source, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(memory.id, memory.clientId, memory.kind, memory.title, memory.note, JSON.stringify(memory.tags), memory.source, memory.createdAt, memory.updatedAt);
  }

  deleteMemory(memoryId: string) {
    this.db.prepare("DELETE FROM memories WHERE id = ?").run(memoryId);
  }

  insertProposal(clientId: string, proposal: ClientProposal) {
    this.ensureClient(clientId);
    this.db.prepare(`
      INSERT OR REPLACE INTO proposals (id, client_id, title, status, package_name, price, probability, next_step, scope_json, created_at, updated_at, services_text, setup_fee, monthly_retainer, contract_length, estimated_delivery, sent_date, response_date, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      proposal.id,
      clientId,
      proposal.title,
      proposal.status,
      proposal.packageName,
      proposal.price,
      proposal.probability,
      proposal.nextStep,
      JSON.stringify(proposal.scope),
      proposal.createdAt,
      proposal.updatedAt,
      proposal.scope.join("\n"),
      proposal.price,
      0,
      "One-off",
      "2 weeks from sign-off",
      proposal.status === "sent" ? proposal.updatedAt : null,
      proposal.status === "accepted" || proposal.status === "lost" ? proposal.updatedAt : null,
      proposal.nextStep
    );
  }

  updateProposal(proposalId: string, patch: Partial<Pick<ClientProposal, "status" | "probability" | "price" | "nextStep">>) {
    const fields: string[] = [];
    const values: Array<string | number | null> = [];
    const mapping: Record<string, string> = {status: "status", probability: "probability", price: "price", nextStep: "next_step"};
    for (const [key, value] of Object.entries(patch)) {
      if (value === undefined) continue;
      fields.push(`${mapping[key]} = ?`);
      values.push(value);
    }
    if (!fields.length) return;
    fields.push("updated_at = ?");
    values.push(nowIso(), proposalId);
    this.db.prepare(`UPDATE proposals SET ${fields.join(", ")} WHERE id = ?`).run(...values);
  }

  insertComment(clientId: string, comment: ClientComment) {
    this.ensureClient(clientId);
    this.db.prepare(`
      INSERT OR REPLACE INTO comments (id, client_id, author, body, created_at, type)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(comment.id, clientId, comment.author, comment.body, comment.createdAt, comment.type);
    this.db.prepare(`
      INSERT OR REPLACE INTO notes (id, client_id, body, pinned_at, created_at)
      VALUES (?, ?, ?, NULL, ?)
    `).run(comment.id, clientId, comment.body, comment.createdAt);
  }

  insertAsset(clientId: string, asset: {
    assetType: "demo" | "email" | "image" | "video";
    label: string;
    filePath: string;
    version: number;
    status: "draft" | "ready" | "sent" | "planned";
  }) {
    this.ensureClient(clientId);
    this.db.prepare(`
      INSERT OR REPLACE INTO assets (id, client_id, asset_type, label, file_path, version, status, created_at, metadata_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(`AST-${uniqueId(clientId, asset.label, String(asset.version))}`, clientId, asset.assetType, asset.label, asset.filePath, asset.version, asset.status, nowIso(), "{}");
  }

  getAccounts(page = 1, pageSize = 50) {
    const safePage = Number.isFinite(page) ? Math.max(1, Math.floor(page)) : 1;
    const safePageSize = Number.isFinite(pageSize) ? Math.max(1, Math.min(100, Math.floor(pageSize))) : 50;
    const offset = Math.max(0, (safePage - 1) * safePageSize);
    const rows = this.db.prepare(`
      SELECT a.*,
        (
          SELECT MAX(timestamp)
          FROM timeline_events t
          WHERE t.client_id = a.client_id
        ) AS last_timeline_at
      FROM accounts a
      ORDER BY a.updated_at DESC
      LIMIT ? OFFSET ?
    `).all(safePageSize, offset) as Array<Record<string, unknown>>;
    return rows.map((row) => ({
      clientId: String(row.client_id),
      businessName: String(row.business_name),
      businessType: String(row.business_type),
      area: String(row.area),
      websiteUrl: (row.website_url as string | null) ?? null,
      phoneNumber: (row.phone_number as string | null) ?? null,
      emailAddress: (row.email_address as string | null) ?? null,
      googleRating: row.google_rating == null ? null : Number(row.google_rating),
      reviewCount: row.review_count == null ? null : Number(row.review_count),
      address: (row.address as string | null) ?? null,
      accountStatus: String(row.account_status),
      priority: String(row.priority),
      dueDate: (row.due_date as string | null) ?? null,
      nextActionNotes: String(row.next_action_notes ?? ""),
      siteScore: Number(row.site_score ?? 0),
      dealValue: Number(row.deal_value ?? 0),
      closeProbability: Number(row.close_probability ?? 0),
      sourceNotes: String(row.source_notes ?? ""),
      imageHero: (row.image_hero as string | null) ?? null,
      imageServices: (row.image_services as string | null) ?? null,
      demoFile: (row.demo_file as string | null) ?? null,
      videoFile: (row.video_file as string | null) ?? null,
      emailFile: (row.email_file as string | null) ?? null,
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
      lastTimelineEventAt: (row.last_timeline_at as string | null) ?? null,
      health: healthBand(Number(row.site_score ?? 0)),
    }));
  }

  private ensureEnterpriseAccountForClient(clientId: string) {
    const existing = this.db.prepare("SELECT client_id FROM accounts WHERE client_id = ?").get(clientId) as {client_id?: string} | undefined;
    if (existing?.client_id) return;
    const legacy = this.db.prepare("SELECT * FROM clients WHERE client_id = ?").get(clientId) as Record<string, unknown> | undefined;
    if (!legacy) return;

    this.upsertEnterpriseAccount({
      clientId,
      businessName: String(legacy.business_name ?? ""),
      businessType: String(legacy.business_type ?? ""),
      area: String(legacy.area ?? ""),
      websiteUrl: (legacy.website_url as string | null) ?? null,
      phoneNumber: (legacy.phone_number as string | null) ?? null,
      emailAddress: (legacy.email_address as string | null) ?? null,
      googleRating: legacy.google_rating == null ? null : Number(legacy.google_rating),
      reviewCount: legacy.review_count == null ? null : Number(legacy.review_count),
      address: (legacy.address as string | null) ?? null,
      accountStatus: String(legacy.account_status ?? "researched"),
      priority: String(legacy.follow_up_priority ?? "medium"),
      dueDate: (legacy.follow_up_due_date as string | null) ?? null,
      nextActionNotes: String(legacy.follow_up_next_step ?? ""),
      siteScore: Number(legacy.score ?? 0),
      dealValue: Number(legacy.value_estimate ?? 0),
      closeProbability: Number(legacy.close_probability ?? 35),
      sourceNotes: String(legacy.source_description ?? ""),
      imageHero: (legacy.image_hero as string | null) ?? null,
      imageServices: (legacy.image_services as string | null) ?? null,
      demoFile: (legacy.demo_file as string | null) ?? null,
      videoFile: (legacy.video_file as string | null) ?? null,
      emailFile: (legacy.email_file as string | null) ?? null,
      createdAt: String(legacy.created_at ?? nowIso()),
      updatedAt: String(legacy.updated_at ?? nowIso()),
    });

    this.upsertAuditScoresRecord(clientId, jsonParse(legacy.audit_scores_json as string | undefined, {
      designQuality: 0,
      mobileResponsiveness: 0,
      pageSpeed: 0,
      clearHeadline: 0,
      callToAction: 0,
      contactVisibility: 0,
      trustSignals: 0,
      seoBasics: 0,
      contentQuality: 0,
      googleReviewsOnWebsite: 0,
    }));
    this.upsertAuditAnalysisRecord(clientId, {
      strengths: jsonParse<string[]>(legacy.strengths_json as string | undefined, []),
      weaknesses: jsonParse<string[]>(legacy.weaknesses_json as string | undefined, []),
      topProblems: jsonParse<string[]>(legacy.top_problems_json as string | undefined, []),
      recommendedActions: jsonParse<string[]>(legacy.recommended_actions_json as string | undefined, []).join("\n"),
    });
  }

  getAccountFull(clientId: string) {
    this.ensureEnterpriseAccountForClient(clientId);
    const account = this.db.prepare("SELECT * FROM accounts WHERE client_id = ?").get(clientId) as Record<string, unknown> | undefined;
    if (!account) throw new Error(`Account ${clientId} not found`);
    const auditScores = this.db.prepare("SELECT * FROM audit_scores WHERE client_id = ? ORDER BY criterion ASC").all(clientId) as Array<Record<string, unknown>>;
    const auditAnalysis = this.db.prepare("SELECT * FROM audit_analysis WHERE client_id = ?").get(clientId) as Record<string, unknown> | undefined;
    const contacts = this.db.prepare("SELECT * FROM contacts WHERE client_id = ? ORDER BY is_primary DESC, created_at DESC").all(clientId) as Array<Record<string, unknown>>;
    const timeline = this.db.prepare("SELECT * FROM timeline_events WHERE client_id = ? ORDER BY timestamp DESC, created_at DESC").all(clientId) as Array<Record<string, unknown>>;
    const tasks = this.db.prepare("SELECT * FROM tasks WHERE client_id = ? ORDER BY status ASC, due_date ASC, created_at DESC").all(clientId) as Array<Record<string, unknown>>;
    const proposals = this.db.prepare("SELECT * FROM proposals WHERE client_id = ? ORDER BY updated_at DESC").all(clientId) as Array<Record<string, unknown>>;
    const memory = this.db.prepare("SELECT * FROM memory WHERE client_id = ?").get(clientId) as Record<string, unknown> | undefined;
    const notes = this.db.prepare("SELECT * FROM notes WHERE client_id = ? ORDER BY COALESCE(pinned_at, '') DESC, created_at DESC").all(clientId) as Array<Record<string, unknown>>;
    const calls = this.db.prepare("SELECT * FROM call_logs WHERE client_id = ? ORDER BY called_at DESC").all(clientId) as Array<Record<string, unknown>>;
    const browserAudits = this.db.prepare("SELECT * FROM browser_audits WHERE client_id = ? ORDER BY created_at DESC").all(clientId) as Array<Record<string, unknown>>;
    return {
      account,
      auditScores,
      auditAnalysis,
      contacts,
      timeline,
      tasks,
      proposals,
      memory,
      notes,
      calls,
      browserAudits,
    };
  }

  saveBrowserAudit(clientId: string, payload: {
    id: string;
    websiteUrl: string;
    summary: string;
    flaws: string[];
    opportunities: string[];
    plan: string[];
    scores: Record<string, number>;
    evidence: unknown;
    screenshotPath: string | null;
    createdAt: string;
  }) {
    this.db.prepare(`
      INSERT INTO browser_audits (
        id, client_id, website_url, summary, flaws_json, opportunities_json, plan_json,
        scores_json, evidence_json, screenshot_path, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      payload.id,
      clientId,
      payload.websiteUrl,
      payload.summary,
      JSON.stringify(payload.flaws),
      JSON.stringify(payload.opportunities),
      JSON.stringify(payload.plan),
      JSON.stringify(payload.scores),
      JSON.stringify(payload.evidence),
      payload.screenshotPath,
      payload.createdAt,
    );
  }

  addTimelineEvent(clientId: string, payload: {
    id: string;
    eventType: string;
    timestamp: string;
    contactName: string | null;
    notes: string;
    duration: number | null;
    followUpDate: string | null;
    loggedBy: string;
    metadata?: Record<string, unknown>;
  }) {
    this.db.prepare(`
      INSERT OR REPLACE INTO timeline_events (
        id, client_id, event_type, timestamp, contact_name, notes, duration, follow_up_date, logged_by, metadata_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      payload.id,
      clientId,
      payload.eventType,
      payload.timestamp,
      payload.contactName,
      payload.notes,
      payload.duration,
      payload.followUpDate,
      payload.loggedBy,
      JSON.stringify(payload.metadata ?? {}),
      nowIso()
    );
    if (payload.followUpDate) {
      this.insertTask(clientId, {
        id: `TASK-${uniqueId(clientId, payload.eventType, payload.followUpDate)}`,
        title: `Follow up: ${clientId}`,
        description: payload.notes || payload.eventType,
        status: "todo",
        priority: "medium",
        dueDate: payload.followUpDate,
        owner: brand.ownerName,
        lane: "follow-up",
        createdAt: nowIso(),
      });
    }
  }

  updateTimelineEvent(eventId: string, patch: Partial<{timestamp: string; contactName: string | null; notes: string; duration: number | null; followUpDate: string | null;}>) {
    const mapping: Record<string, string> = {timestamp: "timestamp", contactName: "contact_name", notes: "notes", duration: "duration", followUpDate: "follow_up_date"};
    const fields: string[] = [];
    const values: Array<string | number | null> = [];
    for (const [key, value] of Object.entries(patch)) {
      if (value === undefined) continue;
      fields.push(`${mapping[key]} = ?`);
      values.push(value as string | number | null);
    }
    if (!fields.length) return;
    values.push(eventId);
    this.db.prepare(`UPDATE timeline_events SET ${fields.join(", ")} WHERE id = ?`).run(...values);
  }

  saveIntegrationSnapshot(payload: {
    provider: string;
    status: "connected" | "not_configured" | "error";
    summary: Record<string, unknown>;
    data: unknown;
    error?: string | null;
    syncedAt?: string;
  }) {
    this.db.prepare(`
      INSERT INTO integration_snapshots (provider, status, summary_json, data_json, error, synced_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(provider) DO UPDATE SET
        status = excluded.status,
        summary_json = excluded.summary_json,
        data_json = excluded.data_json,
        error = excluded.error,
        synced_at = excluded.synced_at
    `).run(
      payload.provider,
      payload.status,
      JSON.stringify(payload.summary),
      JSON.stringify(payload.data),
      payload.error ?? null,
      payload.syncedAt ?? nowIso(),
    );
  }

  getIntegrationSnapshots() {
    return this.db.prepare(`
      SELECT provider, status, summary_json, data_json, error, synced_at
      FROM integration_snapshots
      ORDER BY synced_at DESC
    `).all() as Array<{
      provider: string;
      status: string;
      summary_json: string;
      data_json: string;
      error: string | null;
      synced_at: string;
    }>;
  }

  deleteTimelineEvent(eventId: string) {
    this.db.prepare("DELETE FROM timeline_events WHERE id = ?").run(eventId);
  }

  updateContact(contactId: string, patch: Record<string, unknown>) {
    const mapping: Record<string, string> = {
      fullName: "full_name",
      role: "role",
      email: "email",
      phone: "phone",
      linkedIn: "linkedin",
      bestTime: "best_time",
      contactPreference: "contact_preference",
      notes: "notes",
      isPrimary: "is_primary",
      lastContactedAt: "last_contacted_at",
    };
    const fields: string[] = [];
    const values: Array<string | number | null> = [];
    for (const [key, value] of Object.entries(patch)) {
      if (!(key in mapping) || value === undefined) continue;
      fields.push(`${mapping[key]} = ?`);
      values.push(key === "isPrimary" ? (value ? 1 : 0) : (value as string | number | null));
    }
    if (!fields.length) return;
    values.push(contactId);
    this.db.prepare(`UPDATE contacts SET ${fields.join(", ")} WHERE id = ?`).run(...values);
    const contact = this.db.prepare("SELECT client_id, is_primary FROM contacts WHERE id = ?").get(contactId) as {client_id: string; is_primary: number} | undefined;
    if (contact?.is_primary) this.setPrimaryContact(contact.client_id, contactId);
  }

  deleteContact(contactId: string) {
    this.db.prepare("DELETE FROM contacts WHERE id = ?").run(contactId);
  }

  deleteTask(taskId: string) {
    this.db.prepare("DELETE FROM tasks WHERE id = ?").run(taskId);
  }

  upsertAuditScore(clientId: string, criterion: string, score: number, note: string) {
    this.upsertAuditScoresRecord(clientId, {[criterion]: score}, {[criterion]: note});
    const allScores = this.db.prepare("SELECT criterion, score FROM audit_scores WHERE client_id = ?").all(clientId) as Array<{criterion: string; score: number}>;
    const total = allScores.reduce((sum, row) => sum + Number(row.score), 0);
    this.updateClient(clientId, {score: total});
  }

  updateAuditAnalysis(clientId: string, patch: {strengths?: string[]; weaknesses?: string[]; topProblems?: string[]; recommendedActions?: string;}) {
    const existing = this.db.prepare("SELECT * FROM audit_analysis WHERE client_id = ?").get(clientId) as Record<string, unknown> | undefined;
    this.upsertAuditAnalysisRecord(clientId, {
      strengths: patch.strengths ?? jsonParse<string[]>((existing?.strengths as string | undefined) ?? "[]", []),
      weaknesses: patch.weaknesses ?? jsonParse<string[]>((existing?.weaknesses as string | undefined) ?? "[]", []),
      topProblems: patch.topProblems ?? jsonParse<string[]>((existing?.top_problems as string | undefined) ?? "[]", []),
      recommendedActions: patch.recommendedActions ?? String(existing?.recommended_actions ?? ""),
    });
  }

  upsertStructuredMemory(clientId: string, payload: {
    personality?: string;
    painPoints?: string;
    whatResonates?: string;
    whatToAvoid?: string;
    decisionProcess?: string;
    bestWindow?: string;
    conversationHighlights?: Array<{date: string; note: string}>;
    objections?: Array<{objection: string; handled: string}>;
    internalNotes?: string;
  }) {
    const existing = this.db.prepare("SELECT * FROM memory WHERE client_id = ?").get(clientId) as Record<string, unknown> | undefined;
    const timestamp = nowIso();
    this.db.prepare(`
      INSERT INTO memory (
        client_id, personality, pain_points, what_resonates, what_to_avoid, decision_process, best_window,
        conversation_highlights, objections, internal_notes, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(client_id) DO UPDATE SET
        personality = excluded.personality,
        pain_points = excluded.pain_points,
        what_resonates = excluded.what_resonates,
        what_to_avoid = excluded.what_to_avoid,
        decision_process = excluded.decision_process,
        best_window = excluded.best_window,
        conversation_highlights = excluded.conversation_highlights,
        objections = excluded.objections,
        internal_notes = excluded.internal_notes,
        updated_at = excluded.updated_at
    `).run(
      clientId,
      payload.personality ?? String(existing?.personality ?? ""),
      payload.painPoints ?? String(existing?.pain_points ?? ""),
      payload.whatResonates ?? String(existing?.what_resonates ?? ""),
      payload.whatToAvoid ?? String(existing?.what_to_avoid ?? ""),
      payload.decisionProcess ?? String(existing?.decision_process ?? ""),
      payload.bestWindow ?? String(existing?.best_window ?? ""),
      JSON.stringify(payload.conversationHighlights ?? jsonParse((existing?.conversation_highlights as string | undefined) ?? "[]", [])),
      JSON.stringify(payload.objections ?? jsonParse((existing?.objections as string | undefined) ?? "[]", [])),
      payload.internalNotes ?? String(existing?.internal_notes ?? ""),
      timestamp
    );
  }

  addNote(clientId: string, body: string) {
    const noteId = `NOTE-${uniqueId(clientId, String(Date.now()))}`;
    const timestamp = nowIso();
    this.db.prepare("INSERT INTO notes (id, client_id, body, pinned_at, created_at) VALUES (?, ?, ?, NULL, ?)").run(noteId, clientId, body, timestamp);
    return noteId;
  }

  pinNote(noteId: string, pinned: boolean) {
    this.db.prepare("UPDATE notes SET pinned_at = ? WHERE id = ?").run(pinned ? nowIso() : null, noteId);
  }

  deleteNote(noteId: string) {
    this.db.prepare("DELETE FROM notes WHERE id = ?").run(noteId);
  }

  logCall(clientId: string, payload: {
    calledAt: string;
    outcome: string;
    durationMinutes?: number | null;
    contactName?: string | null;
    notes?: string;
    followUpDate?: string | null;
  }) {
    const callId = `CALL-${uniqueId(clientId, payload.calledAt, String(Date.now()))}`;
    this.db.prepare(`
      INSERT INTO call_logs (id, client_id, called_at, outcome, duration_minutes, contact_name, notes, follow_up_date, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(callId, clientId, payload.calledAt, payload.outcome, payload.durationMinutes ?? null, payload.contactName ?? null, payload.notes ?? "", payload.followUpDate ?? null, nowIso());
    this.addTimelineEvent(clientId, {
      id: `TL-${callId}`,
      eventType: payload.outcome.includes("Voicemail") ? "Voicemail left" : payload.outcome.includes("Spoke") || payload.outcome.includes("Interested") ? "Call connected" : "Call attempt",
      timestamp: payload.calledAt,
      contactName: payload.contactName ?? null,
      notes: payload.notes ?? payload.outcome,
      duration: payload.durationMinutes ?? null,
      followUpDate: payload.followUpDate ?? null,
      loggedBy: brand.ownerName,
      metadata: {outcome: payload.outcome},
    });
    this.updateClient(clientId, {
      lastContactedAt: payload.calledAt,
      accountStatus: payload.outcome === "Interested — follow up" ? "in-follow-up" : payload.outcome.includes("decision-maker") ? "contacted" : undefined,
    });
    return callId;
  }

  getMetrics() {
    const state = this.getState();
    const collected = state.clients.filter((client) => client.accountStatus === "won").reduce((sum, client) => sum + client.valueEstimate, 0);
    const pipeline = state.clients.filter((client) => !["lost"].includes(client.accountStatus)).reduce((sum, client) => sum + client.valueEstimate * (client.closeProbability / 100), 0);
    const proposalsDrafted = state.clients.filter((client) => client.proposals.length > 0).length;
    const repliedOrBeyond = state.clients.filter((client) => ["replied", "proposal", "won"].includes(client.accountStatus)).length;
    const last24h = this.db.prepare("SELECT COUNT(*) as count FROM timeline_events WHERE timestamp >= ?").get(new Date(Date.now() - 86400000).toISOString()) as {count: number};
    return {
      weightedPipeline: pipeline,
      bookedReadiness: repliedOrBeyond ? Math.round((proposalsDrafted / repliedOrBeyond) * 100) : 0,
      liveActivityCount: last24h.count,
      revenueCollected: collected,
      revenuePipeline: state.clients.filter((client) => ["contacted", "in-follow-up", "replied", "proposal"].includes(client.accountStatus)).reduce((sum, client) => sum + client.valueEstimate, 0),
      wonDeals: state.clients.filter((client) => client.accountStatus === "won").length,
      averageDeal: state.clients.filter((client) => client.accountStatus === "won").length ? Math.round(collected / state.clients.filter((client) => client.accountStatus === "won").length) : 0,
      accountsByStage: stagesFromClients(state.clients),
      topAreas: aggregateBy(state.clients, "area"),
      topBusinessTypes: aggregateBy(state.clients, "businessType"),
    };
  }

  getMailDrafts() {
    const full = this.getAccounts(1, 500);
    return full.filter((account) => account.emailFile).map((account) => {
      const latestEmail = this.db.prepare(`
        SELECT timestamp, event_type, notes
        FROM timeline_events
        WHERE client_id = ? AND event_type IN ('Email sent', 'Email replied', 'Email draft generated')
        ORDER BY timestamp DESC LIMIT 1
      `).get(account.clientId) as {timestamp?: string; event_type?: string; notes?: string} | undefined;
      return {
        ...account,
        draftedAt: account.updatedAt,
        mailStatus: latestEmail?.event_type === "Email replied" ? "Replied" : latestEmail?.event_type === "Email sent" ? "Sent" : "Draft",
        latestMailEventAt: latestEmail?.timestamp ?? null,
        latestMailNotes: latestEmail?.notes ?? "",
      };
    });
  }

  getTodayBatch() {
    const today = nowIso().slice(0, 10);
    return this.getAccounts(1, 500)
      .filter((account) => !["won", "lost"].includes(account.accountStatus))
      .sort((a, b) => {
        const priorityWeight = {Critical: 0, High: 1, Medium: 2, Low: 3, high: 0, medium: 1, low: 2};
        return a.siteScore - b.siteScore
          || (priorityWeight[a.priority as keyof typeof priorityWeight] ?? 4) - (priorityWeight[b.priority as keyof typeof priorityWeight] ?? 4)
          || String(a.lastTimelineEventAt ?? "0000").localeCompare(String(b.lastTimelineEventAt ?? "0000"))
          || String(a.dueDate ?? today).localeCompare(String(b.dueDate ?? today));
      })
      .slice(0, 10);
  }

  getCallSheet() {
    const accounts = this.getAccounts(1, 500);
    return accounts
      .filter((account) => ["researched", "ready-to-send", "contacted", "in-follow-up"].includes(account.accountStatus))
      .map((account) => {
        const lastCall = this.db.prepare(`
          SELECT called_at, outcome
          FROM call_logs
          WHERE client_id = ?
          ORDER BY called_at DESC LIMIT 1
        `).get(account.clientId) as {called_at?: string; outcome?: string} | undefined;
        return {
          ...account,
          lastCallAt: lastCall?.called_at ?? null,
          lastCallOutcome: lastCall?.outcome ?? null,
        };
      });
  }
}

function aggregateBy(clients: ClientRecord[], key: "area" | "businessType") {
  return Object.entries(
    clients.reduce<Record<string, number>>((acc, client) => {
      acc[client[key]] = (acc[client[key]] ?? 0) + client.valueEstimate;
      return acc;
    }, {})
  ).map(([label, value]) => ({label, value})).sort((a, b) => b.value - a.value);
}

function stagesFromClients(clients: ClientRecord[]) {
  const counts: Record<string, number> = {};
  for (const client of clients) counts[client.accountStatus] = (counts[client.accountStatus] ?? 0) + 1;
  return counts;
}
