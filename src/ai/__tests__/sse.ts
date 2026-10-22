/**
 * Fake Messages API for tests: builds the server-sent events of a streamed message (text and
 * tool_use blocks), and a fetch that answers each POST /v1/messages with the next scripted reply
 * while recording the request bodies. No network.
 */
export type FakeBlock = { type: 'text'; text: string } | { type: 'tool_use'; id: string; name: string; input: unknown } | { type: 'thinking'; thinking: string };

export interface FakeReply {
  blocks: FakeBlock[];
  stop_reason?: 'end_turn' | 'tool_use' | 'max_tokens' | 'refusal' | 'pause_turn';
}

let counter = 0;

function event(type: string, data: unknown): string {
  return `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
}

export function sseBody(reply: FakeReply, model = 'claude-opus-5-5'): string {
  const id = `msg_test_${++counter}`;
  let out = event('message_start', {
    type: 'message_start',
    message: { id, type: 'message', role: 'assistant', model, content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 10, output_tokens: 1, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 } },
  });
  reply.blocks.forEach((b, index) => {
    if (b.type === 'text') {
      out += event('content_block_start', { type: 'content_block_start', index, content_block: { type: 'text', text: '' } });
      // two deltas, so streaming is visible
      const half = Math.ceil(b.text.length / 2);
      for (const part of [b.text.slice(0, half), b.text.slice(half)]) {
        if (part) out += event('content_block_delta', { type: 'content_block_delta', index, delta: { type: 'text_delta', text: part } });
      }
    } else if (b.type === 'thinking') {
      out += event('content_block_start', { type: 'content_block_start', index, content_block: { type: 'thinking', thinking: '', signature: '' } });
      out += event('content_block_delta', { type: 'content_block_delta', index, delta: { type: 'thinking_delta', thinking: b.thinking } });
      out += event('content_block_delta', { type: 'content_block_delta', index, delta: { type: 'signature_delta', signature: 'sig' } });
    } else {
      out += event('content_block_start', { type: 'content_block_start', index, content_block: { type: 'tool_use', id: b.id, name: b.name, input: {} } });
      const json = JSON.stringify(b.input);
      const cut = Math.floor(json.length / 2);
      out += event('content_block_delta', { type: 'content_block_delta', index, delta: { type: 'input_json_delta', partial_json: json.slice(0, cut) } });
      out += event('content_block_delta', { type: 'content_block_delta', index, delta: { type: 'input_json_delta', partial_json: json.slice(cut) } });
    }
    out += event('content_block_stop', { type: 'content_block_stop', index });
  });
  const stop = reply.stop_reason ?? (reply.blocks.some((b) => b.type === 'tool_use') ? 'tool_use' : 'end_turn');
  out += event('message_delta', { type: 'message_delta', delta: { stop_reason: stop, stop_sequence: null }, usage: { output_tokens: 42 } });
  out += event('message_stop', { type: 'message_stop' });
  return out;
}

export interface FakeApi {
  fetch: typeof fetch;
  requests: Array<{ url: string; headers: Record<string, string>; body: Record<string, unknown> }>;
}

export function fakeMessagesApi(replies: FakeReply[]): FakeApi {
  const requests: FakeApi['requests'] = [];
  const queue = [...replies];
  const impl = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const headers: Record<string, string> = {};
    new Headers(init?.headers).forEach((v, k) => {
      headers[k] = v;
    });
    requests.push({ url, headers, body: JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown> });
    const reply = queue.shift();
    if (!reply) return new Response(JSON.stringify({ type: 'error', error: { type: 'invalid_request_error', message: 'no more replies' } }), { status: 400, headers: { 'content-type': 'application/json' } });
    return new Response(sseBody(reply), { status: 200, headers: { 'content-type': 'text/event-stream' } });
  };
  return { fetch: impl as typeof fetch, requests };
}
