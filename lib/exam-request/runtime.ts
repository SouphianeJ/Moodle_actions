import 'server-only';

import { createHash, createHmac, randomBytes } from 'node:crypto';
import {
  appendExamRequestMessage,
  patchExamRequestState,
  recordExamRequestEvent,
} from '@/lib/exam-request/store';

type StreamEvent =
  | { type: 'trace'; title: string; content: string; status?: 'info' | 'success' | 'warning' | 'error' }
  | { type: 'assistant_final'; content: string }
  | { type: 'plan_validated'; payload: Record<string, unknown> }
  | { type: 'error'; content: string }
  | { type: 'done' };

export type ExamImportAttachment = {
  filename: string;
  format: 'aiken' | 'moodle_xml';
  base64Content: string;
  mimeType?: string;
};

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function getBridgeConfig() {
  const base = requiredEnv('CODEX_BRIDGE_URL');
  const url = new URL(base);
  url.pathname = '/codex/run';
  url.search = '';
  return {
    bridgeUrl: url.toString(),
    appId: process.env.AGENT_RUNTIME_APP_ID?.trim() || 'moodle-actions',
    keyId: process.env.PROXY_KEY_ID_ACTIVE?.trim() || 'codex-v1',
    signingKey: requiredEnv('PROXY_SIGNING_KEY_ACTIVE'),
  };
}

function getRuntimeEngine() {
  return process.env.AGENT_RUNTIME_ENGINE?.trim() === 'codex' ? 'codex' : 'copilot';
}

function getRuntimeModel() {
  const model = process.env.AGENT_RUNTIME_MODEL?.trim();
  return model || 'gpt-5-mini';
}

function getProxyUrl() {
  return requiredEnv('MOODLE_EXAM_MCP_PROXY_URL');
}

function getProxyInternalSecret() {
  return process.env.MOODLE_EXAM_MCP_PROXY_SHARED_SECRET?.trim() || '';
}

function createSignedHeaders(url: string, method: string, body: string) {
  const config = getBridgeConfig();
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = randomBytes(16).toString('hex');
  const bodyHash = createHash('sha256').update(body).digest('hex');
  const parsedUrl = new URL(url);
  const path = parsedUrl.pathname + parsedUrl.search;
  const payload = [method.toUpperCase(), path, timestamp, nonce, bodyHash].join('\n');
  const signature = createHmac('sha256', config.signingKey).update(payload).digest('hex');
  return {
    'X-Proxy-Key-Id': config.keyId,
    'X-Proxy-Timestamp': timestamp,
    'X-Proxy-Nonce': nonce,
    'X-Proxy-Body-Sha256': bodyHash,
    'X-Proxy-Signature': signature,
  };
}

function buildPlannerPrompt(message: string, attachments: ExamImportAttachment[]) {
  const lines = [
    'You are preparing a Moodle exam plan.',
    'Use the Moodle MCP server for discovery and validation.',
    'Do not execute any write tool. Never call exam_plan_execute.',
    'You may call read tools and exam_plan_validate.',
    'Produce a final answer that contains exactly one fenced ```json block with the exam plan object.',
    'The plan must target the strict schema expected by exam_plan_validate.',
    'Prefer course shortname or course id in targetCourse.',
    'Include quizMetadata, availability, timing, grading, and questions.',
  ];

  if (attachments.length > 0) {
    lines.push(
      'Attached question files are available server-side and can be referenced through plan.questionImports.',
      'If you want to use an attached file, include an object in questionImports with its filename and any optional metadata such as categoryname, page, maxmark, or defaultmark.',
      'Do not inline the binary or file content yourself. The server will inject the attachment content before validation.',
      'Available attachments:',
      ...attachments.map((attachment) => `- ${attachment.filename} (${attachment.format})`)
    );
  }

  lines.push('', message);
  return lines.join('\n');
}

function extractJsonPlan(content: string) {
  const fencedMatch = content.match(/```json\s*([\s\S]*?)```/i);
  const candidate = fencedMatch ? fencedMatch[1] : content;
  const firstBrace = candidate.indexOf('{');
  const lastBrace = candidate.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new Error('No JSON exam plan was found in the assistant response.');
  }
  return JSON.parse(candidate.slice(firstBrace, lastBrace + 1)) as Record<string, unknown>;
}

async function callProxy(body: Record<string, unknown>) {
  const internalSecret = getProxyInternalSecret();
  const response = await fetch(getProxyUrl(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(internalSecret ? { 'x-proxy-internal-secret': internalSecret } : {}),
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  return {
    ok: response.ok,
    status: response.status,
    text,
    json: text ? JSON.parse(text) as Record<string, unknown> : null,
  };
}

function mergeAttachmentsIntoPlan(
  plan: Record<string, unknown>,
  attachments: ExamImportAttachment[],
) {
  if (attachments.length === 0) {
    return plan;
  }

  const nextPlan = { ...plan };
  const existingImports = Array.isArray(plan.questionImports)
    ? (plan.questionImports as Record<string, unknown>[])
    : [];

  const mergedImports = [...existingImports];
  for (const attachment of attachments) {
    const existingIndex = mergedImports.findIndex((item) => {
      const filename = typeof item.filename === 'string' ? item.filename.trim() : '';
      return filename.toLowerCase() === attachment.filename.toLowerCase();
    });

    const mergedItem = {
      ...(existingIndex >= 0 ? mergedImports[existingIndex] : {}),
      filename: attachment.filename,
      format: attachment.format,
      base64Content: attachment.base64Content,
      mimeType: attachment.mimeType ?? null,
    };

    if (existingIndex >= 0) {
      mergedImports[existingIndex] = mergedItem;
    } else {
      mergedImports.push(mergedItem);
    }
  }

  nextPlan.questionImports = mergedImports;
  return nextPlan;
}

function encodeEvent(event: StreamEvent) {
  return `${JSON.stringify(event)}\n`;
}

function getString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

function getRecord(value: unknown) {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

function pickCopilotToolName(event: Record<string, unknown>) {
  const tool = getRecord(event.tool);
  return (
    getString(event.toolName) ||
    getString(event.tool_name) ||
    getString(event.name) ||
    getString(tool?.name) ||
    'unknown'
  );
}

function pickCopilotToolPayload(event: Record<string, unknown>) {
  return event.arguments ?? event.args ?? event.input ?? event.parameters ?? event.tool ?? event.result ?? event.output ?? event;
}

function isCopilotToolCallEvent(eventType: string) {
  return /tool.*(start|call|use|invoke|request)|mcp.*start|mcp.*call/i.test(eventType);
}

function isCopilotToolResultEvent(eventType: string) {
  return /tool.*(result|complete|finish|output)|mcp.*result|mcp.*complete/i.test(eventType);
}

function isCopilotAssistantFinalEvent(eventType: string) {
  return eventType === 'assistant.message' || /(assistant|message|response).*(complete|completed|final|done)|turn\.completed/i.test(eventType);
}

function summarizeUnknownPayload(value: unknown) {
  if (typeof value === 'string') {
    return value;
  }
  if (value === null || value === undefined) {
    return 'No payload.';
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export async function streamExamPlanningRun(
  requestId: string,
  message: string,
  attachments: ExamImportAttachment[],
  onChunk: (chunk: string) => Promise<void>,
) {
  const bridge = getBridgeConfig();
  const body = JSON.stringify({
    appId: bridge.appId,
    chatId: requestId,
    prompt: buildPlannerPrompt(message, attachments),
    engine: getRuntimeEngine(),
    model: getRuntimeModel(),
    allowBypassSandbox: true,
  });

  const attachmentLabel = attachments.length > 0
    ? `\n\nAttached imports:\n${attachments.map((attachment) => `- ${attachment.filename} (${attachment.format})`).join('\n')}`
    : '';
  await appendExamRequestMessage(requestId, { role: 'user', content: `${message}${attachmentLabel}` });
  await patchExamRequestState(requestId, {
    runStatus: 'running',
    approval: { status: 'pending', decidedAt: null },
    executionResult: null,
  });
  await recordExamRequestEvent(requestId, 'user_message', {
    content: message,
    attachments: attachments.map((attachment) => ({
      filename: attachment.filename,
      format: attachment.format,
      mimeType: attachment.mimeType ?? null,
    })),
  });

  const response = await fetch(bridge.bridgeUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...createSignedHeaders(bridge.bridgeUrl, 'POST', body),
    },
    body,
  });

  if (!response.ok || !response.body) {
    const details = await response.text().catch(() => '');
    throw new Error(details || `Runtime bridge failed with status ${response.status}.`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let finalAssistant = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      if (!line.trim()) {
        continue;
      }

      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(line) as Record<string, unknown>;
      } catch {
        continue;
      }

      const type = typeof parsed.type === 'string' ? parsed.type : '';

      if (type === 'item.started' && (parsed.item as { type?: string; tool?: string } | undefined)?.type === 'mcp_tool_call') {
        const tool = (parsed.item as { tool?: string } | undefined)?.tool ?? 'unknown';
        const event: StreamEvent = { type: 'trace', title: `Connector call: ${tool}`, content: tool, status: 'info' };
        await recordExamRequestEvent(requestId, 'tool_call', { tool });
        await onChunk(encodeEvent(event));
      } else if (type === 'item.completed' && (parsed.item as { type?: string; tool?: string; result?: unknown } | undefined)?.type === 'mcp_tool_call') {
        const item = parsed.item as { tool?: string; result?: unknown };
        const content = JSON.stringify(item.result ?? {}, null, 2);
        const event: StreamEvent = { type: 'trace', title: `Connector result: ${item.tool ?? 'unknown'}`, content, status: 'success' };
        await recordExamRequestEvent(requestId, 'tool_result', { tool: item.tool ?? 'unknown', result: item.result ?? null });
        await onChunk(encodeEvent(event));
      } else if (type === 'item.completed' && (parsed.item as { type?: string; text?: string } | undefined)?.type === 'agent_message') {
        finalAssistant = (parsed.item as { text?: string }).text ?? finalAssistant;
      } else if (type === 'error') {
        const content = typeof parsed.message === 'string' ? parsed.message : 'Unknown runtime error.';
        throw new Error(content);
      } else {
        const eventType = type.toLowerCase();
        const eventData = getRecord(parsed.data);

        if (eventType === 'session.error' || eventType === 'turn.failed') {
          const content =
            getString(eventData?.message) ||
            getString(parsed.message) ||
            summarizeUnknownPayload(eventData ?? parsed);
          throw new Error(content);
        }

        if (isCopilotToolCallEvent(eventType)) {
          const tool = pickCopilotToolName(parsed);
          const content = summarizeUnknownPayload(pickCopilotToolPayload(parsed));
          await recordExamRequestEvent(requestId, 'tool_call', { tool, payload: pickCopilotToolPayload(parsed) });
          await onChunk(encodeEvent({ type: 'trace', title: `Connector call: ${tool}`, content, status: 'info' }));
        } else if (isCopilotToolResultEvent(eventType)) {
          const tool = pickCopilotToolName(parsed);
          const content = summarizeUnknownPayload(pickCopilotToolPayload(parsed));
          await recordExamRequestEvent(requestId, 'tool_result', { tool, payload: pickCopilotToolPayload(parsed) });
          await onChunk(encodeEvent({ type: 'trace', title: `Connector result: ${tool}`, content, status: 'success' }));
        }

        const finalContent =
          getString(eventData?.content) ||
          getString(eventData?.message) ||
          getString(parsed.content) ||
          getString(parsed.message);

        if (finalContent && (isCopilotAssistantFinalEvent(eventType) || parsed.done === true || parsed.final === true)) {
          finalAssistant = finalContent;
        }
      }
    }
  }

  if (!finalAssistant.trim()) {
    throw new Error('The runtime completed without producing a final exam plan.');
  }

  await appendExamRequestMessage(requestId, { role: 'assistant', content: finalAssistant });
  await recordExamRequestEvent(requestId, 'assistant_final', { content: finalAssistant });
  await onChunk(encodeEvent({ type: 'assistant_final', content: finalAssistant }));

  const plan = mergeAttachmentsIntoPlan(extractJsonPlan(finalAssistant), attachments);
  const validateRequest = {
    jsonrpc: '2.0',
    id: `validate-${requestId}`,
    method: 'tools/call',
    params: {
      name: 'exam_plan_validate',
      arguments: {
        request_id: `validate-${requestId}`,
        plan,
      },
    },
  };
  const validateResponse = await callProxy(validateRequest);
  await patchExamRequestState(requestId, {
    runStatus: 'idle',
    lastValidatedPlan: plan,
    lastValidationResult: validateResponse.json,
    lastProxyRequest: validateRequest,
    lastProxyResponse: validateResponse.json,
    approval: { status: 'pending', decidedAt: null },
  });
  await recordExamRequestEvent(requestId, 'plan_validated', {
    request: validateRequest,
    response: validateResponse.json ?? { status: validateResponse.status, body: validateResponse.text },
  });
  await onChunk(encodeEvent({
    type: 'plan_validated',
    payload: validateResponse.json ?? { status: validateResponse.status, body: validateResponse.text },
  }));
  await onChunk(encodeEvent({ type: 'done' }));
}

export async function approveExamPlan(requestId: string, decision: 'approved' | 'rejected') {
  return patchExamRequestState(requestId, {
    approval: {
      status: decision,
      decidedAt: new Date().toISOString(),
    },
  });
}

export async function executeApprovedExamPlan(requestId: string, plan: Record<string, unknown>) {
  const executeRequest = {
    jsonrpc: '2.0',
    id: `execute-${requestId}`,
    method: 'tools/call',
    params: {
      name: 'exam_plan_execute',
      arguments: {
        request_id: `execute-${requestId}`,
        plan,
      },
    },
  };
  const executeResponse = await callProxy(executeRequest);
  await patchExamRequestState(requestId, {
    executionResult: executeResponse.json,
    lastProxyRequest: executeRequest,
    lastProxyResponse: executeResponse.json,
    runStatus: executeResponse.ok ? 'idle' : 'failed',
  });
  await recordExamRequestEvent(requestId, 'plan_executed', {
    request: executeRequest,
    response: executeResponse.json ?? { status: executeResponse.status, body: executeResponse.text },
  });
  return executeResponse;
}
