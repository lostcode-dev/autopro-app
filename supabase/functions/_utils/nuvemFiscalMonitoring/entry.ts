// @ts-nocheck

const DEFAULT_MAX_BODY_CHARS = 50_000;

function truncate(value, maxChars) {
  if (!value) return value;
  if (value.length <= maxChars) return value;
  return value.slice(0, maxChars) + `\n...TRUNCATED (${value.length - maxChars} chars)`;
}

function headersToObject(headers) {
  if (!headers) return {};
  if (headers instanceof Headers) return Object.fromEntries(headers.entries());
  if (Array.isArray(headers)) return Object.fromEntries(headers);
  return { ...headers };
}

function redactHeaders(headers) {
  const redacted = {};
  for (const [key, value] of Object.entries(headers)) {
    const lower = key.toLowerCase();
    if (lower === 'authorization' || lower === 'cookie' || lower === 'set-cookie') {
      redacted[key] = '[REDACTED]';
      continue;
    }
    redacted[key] = value;
  }
  return redacted;
}

function safeJsonParse(text) {
  try { return JSON.parse(text); } catch { return undefined; }
}

function sanitizeSecrets(value) {
  const secretKeys = new Set(['authorization', 'token', 'api_token', 'apikey', 'api_key', 'password', 'senha', 'certificado', 'certificate', 'private_key', 'client_secret']);
  if (Array.isArray(value)) return value.map(sanitizeSecrets);
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = secretKeys.has(k.toLowerCase()) ? '[REDACTED]' : sanitizeSecrets(v);
    }
    return out;
  }
  return value;
}

function inferIntegrationTypeFromUrl(url) {
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split('/').filter(Boolean);
    return parts[0];
  } catch { return undefined; }
}

async function resolveOrganizationId(base44, email) {
  if (!email) return undefined;
  try {
    const users = await base44.asServiceRole.entities.User.filter({ email });
    return users?.[0]?.organization_id;
  } catch { return undefined; }
}

export async function monitoredNuvemFiscalFetch(options) {
  const startedAt = Date.now();
  const {
    base44, authUserEmail, functionName, url, init,
    captureResponseBody = 'auto',
    maxResponseBodyChars = DEFAULT_MAX_BODY_CHARS,
    integrationType,
  } = options;

  let response;
  let fetchError;

  try {
    response = await fetch(url, init);
  } catch (error) {
    fetchError = error;
  }

  const durationMs = Date.now() - startedAt;
  const requestHeaders = redactHeaders(headersToObject(init.headers));
  const requestBodyText = typeof init.body === 'string' ? init.body : undefined;
  const parsedRequestBody = requestBodyText ? safeJsonParse(requestBodyText) : undefined;
  const integration = integrationType || inferIntegrationTypeFromUrl(url) || 'nuvem_fiscal';

  let responseBodyText;
  let parsedResponseBody;
  let responseHeaders = {};
  let responseStatus;
  let responseOk;

  if (response) {
    responseHeaders = redactHeaders(headersToObject(response.headers));
    responseStatus = response.status;
    responseOk = response.ok;

    const contentType = response.headers.get('content-type') || '';
    const shouldCaptureBody =
      captureResponseBody === true ||
      (captureResponseBody === 'auto' && (!response.ok || contentType.includes('application/json') || contentType.startsWith('text/')));

    if (shouldCaptureBody) {
      try {
        responseBodyText = await response.clone().text();
        parsedResponseBody = responseBodyText ? safeJsonParse(responseBodyText) : undefined;
      } catch { /* ignore */ }
    }
  }

  let queryParams = {};
  let requestPath;
  try {
    const parsedUrl = new URL(url);
    requestPath = parsedUrl.pathname;
    queryParams = Object.fromEntries(parsedUrl.searchParams.entries());
  } catch { /* ignore */ }

  const organizationId = await resolveOrganizationId(base44, authUserEmail);

  const logPayload = {
    organization_id: organizationId,
    integration,
    function_name: functionName,
    request_method: (init.method || 'GET').toUpperCase(),
    request_url: url,
    request_path: requestPath,
    query_params_json: truncate(JSON.stringify(queryParams), maxResponseBodyChars),
    request_headers_json: truncate(JSON.stringify(requestHeaders), maxResponseBodyChars),
    request_body_json: truncate(JSON.stringify(sanitizeSecrets(parsedRequestBody ?? requestBodyText ?? null)), maxResponseBodyChars),
    response_status: responseStatus,
    response_ok: responseOk,
    response_headers_json: truncate(JSON.stringify(responseHeaders), maxResponseBodyChars),
    response_body_json: truncate(JSON.stringify(sanitizeSecrets(parsedResponseBody ?? responseBodyText ?? null)), maxResponseBodyChars),
    duration_ms: durationMs,
    success: responseOk === true,
    error_message: fetchError instanceof Error ? fetchError.message : fetchError ? String(fetchError) : undefined,
    error_stack: fetchError instanceof Error ? fetchError.stack : undefined,
    user_email: authUserEmail,
  };

  try {
    await base44.asServiceRole.entities.NuvemFiscalIntegrationLog.create(logPayload);
  } catch { /* noop */ }

  if (fetchError) throw fetchError;
  return response;
}