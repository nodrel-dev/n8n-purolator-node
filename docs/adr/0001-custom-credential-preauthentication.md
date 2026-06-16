# Custom credential type with JSON `preAuthentication`, refresh on 401

Purolator's `/auth/v1/token` endpoint takes an `application/json` body (`grant_type` + `scope`) with HTTP Basic credentials, not the form-encoded body n8n's built-in OAuth2 client-credentials grant sends — so the built-in helper cannot be used. We use a custom credential type whose `preAuthentication` fetches and caches the Bearer token (JSON body + Basic header) and whose `authenticate` block injects `Authorization: Bearer <token>` and `x-api-key` on every request.

We deliberately rely on n8n's standard **refresh-on-401** behavior rather than proactively refreshing before `expires_in` elapses. Proactive refresh would mean hand-managing the token and its deadline in node code, which (a) duplicates auth logic on the AI-Agent tool-execution path, where credential resolution runs different code and is exactly where divergence bugs appear (Constitution Principle 11), and (b) buys little inside a single short-lived workflow execution. The trade-off is that the literal "proactive refresh" wording of FR-AUTH-004 is relaxed to 401-refresh.

The schema also carries `x-amazon-apigateway-integration`; the JSON-body and Basic-header behavior is still to be confirmed against the live token endpoint (VERIFY LIVE).
