import 'server-only';

import { randomUUID } from 'node:crypto';
import type { Filter } from 'mongodb';
import { getCollection } from '@/lib/db/mongo';

export type ExamRequestMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  kind?: 'trace';
  title?: string;
  createdAt: string;
};

export type ExamRequestSession = {
  id: string;
  title: string;
  messages: ExamRequestMessage[];
  createdAt: string;
  updatedAt: string;
};

export type ExamRequestState = {
  requestId: string;
  runStatus: 'idle' | 'running' | 'failed';
  lastValidatedPlan: Record<string, unknown> | null;
  lastValidationResult: Record<string, unknown> | null;
  approval: {
    status: 'pending' | 'approved' | 'rejected' | 'not_requested';
    decidedAt?: string | null;
  };
  executionResult: Record<string, unknown> | null;
  lastProxyRequest: Record<string, unknown> | null;
  lastProxyResponse: Record<string, unknown> | null;
  updatedAt: string;
  createdAt: string;
};

type SessionDocument = {
  _id: string;
  title: string;
  messages: ExamRequestMessage[];
  createdAt: Date;
  updatedAt: Date;
};

type StateDocument = {
  _id: string;
  runStatus: 'idle' | 'running' | 'failed';
  lastValidatedPlan: Record<string, unknown> | null;
  lastValidationResult: Record<string, unknown> | null;
  approval: {
    status: 'pending' | 'approved' | 'rejected' | 'not_requested';
    decidedAt?: Date | null;
  };
  executionResult: Record<string, unknown> | null;
  lastProxyRequest: Record<string, unknown> | null;
  lastProxyResponse: Record<string, unknown> | null;
  nextEventSeq: number;
  createdAt: Date;
  updatedAt: Date;
};

type EventDocument = {
  _id: string;
  requestId: string;
  seq: number;
  type: string;
  payload: Record<string, unknown>;
  createdAt: Date;
};

const REQUESTS_COLLECTION = 'exam_requests';
const STATE_COLLECTION = 'exam_request_state';
const EVENTS_COLLECTION = 'exam_request_events';
const APPROVALS_COLLECTION = 'exam_request_approvals';
const RUNS_COLLECTION = 'exam_request_runs';

function serializeSession(document: SessionDocument): ExamRequestSession {
  return {
    id: document._id,
    title: document.title,
    messages: document.messages,
    createdAt: document.createdAt.toISOString(),
    updatedAt: document.updatedAt.toISOString(),
  };
}

function serializeState(document: StateDocument): ExamRequestState {
  return {
    requestId: document._id,
    runStatus: document.runStatus,
    lastValidatedPlan: document.lastValidatedPlan,
    lastValidationResult: document.lastValidationResult,
    approval: {
      status: document.approval.status,
      decidedAt: document.approval.decidedAt ? document.approval.decidedAt.toISOString() : null,
    },
    executionResult: document.executionResult,
    lastProxyRequest: document.lastProxyRequest,
    lastProxyResponse: document.lastProxyResponse,
    createdAt: document.createdAt.toISOString(),
    updatedAt: document.updatedAt.toISOString(),
  };
}

async function getRequestsCollection() {
  return getCollection<SessionDocument>(REQUESTS_COLLECTION);
}

async function getStateCollection() {
  return getCollection<StateDocument>(STATE_COLLECTION);
}

async function getEventsCollection() {
  return getCollection<EventDocument>(EVENTS_COLLECTION);
}

function defaultState(id: string, now: Date): StateDocument {
  return {
    _id: id,
    runStatus: 'idle',
    lastValidatedPlan: null,
    lastValidationResult: null,
    approval: { status: 'not_requested', decidedAt: null },
    executionResult: null,
    lastProxyRequest: null,
    lastProxyResponse: null,
    nextEventSeq: 0,
    createdAt: now,
    updatedAt: now,
  };
}

export async function listExamRequestSessions() {
  const collection = await getRequestsCollection();
  const documents = await collection.find({}).sort({ updatedAt: -1 }).toArray();
  return documents.map(serializeSession);
}

export async function createExamRequestSession() {
  const requests = await getRequestsCollection();
  const state = await getStateCollection();
  const now = new Date();
  const id = randomUUID();
  const session: SessionDocument = {
    _id: id,
    title: 'Nouvelle demande examen',
    messages: [],
    createdAt: now,
    updatedAt: now,
  };
  await requests.insertOne(session);
  await state.insertOne(defaultState(id, now));
  return serializeSession(session);
}

export async function getExamRequestSession(id: string) {
  const requests = await getRequestsCollection();
  const state = await getStateCollection();
  const [sessionDoc, stateDoc] = await Promise.all([
    requests.findOne({ _id: id }),
    state.findOne({ _id: id }),
  ]);
  if (!sessionDoc) {
    return null;
  }
  return {
    session: serializeSession(sessionDoc),
    state: stateDoc ? serializeState(stateDoc) : serializeState(defaultState(id, new Date())),
  };
}

export async function appendExamRequestMessage(requestId: string, message: Omit<ExamRequestMessage, 'id' | 'createdAt'> & Partial<Pick<ExamRequestMessage, 'id' | 'createdAt'>>) {
  const requests = await getRequestsCollection();
  const existing = await requests.findOne({ _id: requestId });
  if (!existing) {
    return null;
  }

  const now = new Date();
  const normalized: ExamRequestMessage = {
    id: message.id ?? randomUUID(),
    createdAt: message.createdAt ?? now.toISOString(),
    role: message.role,
    content: message.content,
    kind: message.kind,
    title: message.title,
  };

  const nextTitle =
    normalized.role === 'user' && existing.title === 'Nouvelle demande examen'
      ? normalized.content.slice(0, 80)
      : existing.title;

  await requests.updateOne(
    { _id: requestId },
    {
      $set: { updatedAt: now, title: nextTitle },
      $push: { messages: normalized },
    },
  );

  return normalized;
}

export async function patchExamRequestState(requestId: string, patch: Partial<Omit<ExamRequestState, 'requestId' | 'createdAt' | 'updatedAt'>>) {
  const state = await getStateCollection();
  const now = new Date();
  const setPayload: Partial<StateDocument> = {
    updatedAt: now,
  };

  if (patch.runStatus) {
    setPayload.runStatus = patch.runStatus;
  }
  if (patch.lastValidatedPlan !== undefined) {
    setPayload.lastValidatedPlan = patch.lastValidatedPlan;
  }
  if (patch.lastValidationResult !== undefined) {
    setPayload.lastValidationResult = patch.lastValidationResult;
  }
  if (patch.executionResult !== undefined) {
    setPayload.executionResult = patch.executionResult;
  }
  if (patch.lastProxyRequest !== undefined) {
    setPayload.lastProxyRequest = patch.lastProxyRequest;
  }
  if (patch.lastProxyResponse !== undefined) {
    setPayload.lastProxyResponse = patch.lastProxyResponse;
  }
  if (patch.approval) {
    setPayload.approval = {
      status: patch.approval.status,
      decidedAt: patch.approval.decidedAt ? new Date(patch.approval.decidedAt) : null,
    };
  }

  const result = await state.findOneAndUpdate(
    { _id: requestId },
    {
      $setOnInsert: { createdAt: now },
      $set: setPayload,
    },
    { upsert: true, returnDocument: 'after' },
  );
  if (!result) {
    throw new Error(`Unable to update exam request state for ${requestId}.`);
  }
  return serializeState(result);
}

async function reserveEventSequence(requestId: string) {
  const state = await getStateCollection();
  const now = new Date();
  const result = await state.findOneAndUpdate(
    { _id: requestId },
    {
      $setOnInsert: { createdAt: now },
      $set: { updatedAt: now },
      $inc: { nextEventSeq: 1 },
    },
    { upsert: true, returnDocument: 'after' },
  );
  if (!result) {
    throw new Error(`Unable to reserve an event sequence for ${requestId}.`);
  }
  return result.nextEventSeq;
}

export async function recordExamRequestEvent(requestId: string, type: string, payload: Record<string, unknown>) {
  const events = await getEventsCollection();
  const seq = await reserveEventSequence(requestId);
  const now = new Date();
  const document: EventDocument = {
    _id: `${requestId}:${seq}`,
    requestId,
    seq,
    type,
    payload,
    createdAt: now,
  };
  await events.insertOne(document);
  return document;
}

export async function listExamRequestEvents(requestId: string, limit = 100) {
  const events = await getEventsCollection();
  return events.find({ requestId }).sort({ seq: 1 }).limit(limit).toArray();
}

export async function insertExamRequestApproval(document: Record<string, unknown>) {
  const approvals = await getCollection<Record<string, unknown>>(APPROVALS_COLLECTION);
  await approvals.insertOne({ ...document, createdAt: new Date() });
}

export async function insertExamRequestRun(document: Record<string, unknown>) {
  const runs = await getCollection<Record<string, unknown>>(RUNS_COLLECTION);
  await runs.insertOne({ ...document, createdAt: new Date() });
}

export async function findExamRequestSessionById(id: string) {
  const requests = await getRequestsCollection();
  return requests.findOne({ _id: id } as Filter<SessionDocument>);
}
