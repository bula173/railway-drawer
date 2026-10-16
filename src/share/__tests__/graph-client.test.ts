import { describe, expect, it, vi } from 'vitest';
import {
  GRAPH_BASE_URL,
  GraphClient,
  GraphConflictError,
  GraphError,
  SCOPE_FILES_READWRITE,
  SCOPE_SITES_READ,
  SIMPLE_UPLOAD_LIMIT,
  UPLOAD_CHUNK_SIZE,
} from '../providers/sharepoint/graph-client';

interface Call {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: BodyInit | null | undefined;
}

function json(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });
}

function setup(responder: (call: Call, index: number) => Response | Promise<Response>) {
  const calls: Call[] = [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const call: Call = {
      url: String(input),
      method: init?.method ?? 'GET',
      headers: (init?.headers ?? {}) as Record<string, string>,
      body: init?.body,
    };
    calls.push(call);
    return responder(call, calls.length - 1);
  });
  const getToken = vi.fn(async (scopes: string[]) => `token-for-${scopes.join('+')}`);
  const sleep = vi.fn(async () => undefined);
  const client = new GraphClient({ getToken, fetch: fetchMock as unknown as typeof fetch, sleep });
  return { client, calls, getToken, sleep };
}

describe('GraphClient', () => {
  it('follows @odata.nextLink pages and asks for Sites.Read.All', async () => {
    const { client, calls, getToken } = setup((call) => {
      if (call.url.includes('skiptoken=2')) return json(200, { value: [{ id: 'c', name: 'C' }] });
      return json(200, {
        value: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }],
        '@odata.nextLink': `${GRAPH_BASE_URL}/drives/d1/items/root/children?$skiptoken=2`,
      });
    });
    const items = await client.listChildren('d1');
    expect(items.map((i) => i.id)).toEqual(['a', 'b', 'c']);
    expect(calls[0].url).toBe(
      `${GRAPH_BASE_URL}/drives/d1/items/root/children?$top=200&$select=id,name,size,eTag,webUrl,lastModifiedDateTime,file,folder,parentReference`
    );
    expect(calls[1].url).toBe(`${GRAPH_BASE_URL}/drives/d1/items/root/children?$skiptoken=2`);
    expect(calls[0].headers.Authorization).toBe(`Bearer token-for-${SCOPE_SITES_READ}`);
    expect(getToken).toHaveBeenCalledWith([SCOPE_SITES_READ]);
  });

  it('searches sites and resolves a site by path', async () => {
    const { client, calls } = setup((call) =>
      call.url.includes('search=') ? json(200, { value: [{ id: 's1', displayName: 'Rail' }] }) : json(200, { id: 's2', displayName: 'Ops' })
    );
    expect(await client.searchSites('rail & signal')).toEqual([{ id: 's1', displayName: 'Rail' }]);
    expect(calls[0].url).toContain('/sites?search=rail%20%26%20signal');
    expect((await client.getSiteByPath('contoso.sharepoint.com:/sites/Ops')).id).toBe('s2');
    expect(calls[1].url).toContain('/sites/contoso.sharepoint.com:/sites/Ops?');
  });

  it('uploads a small file with one PUT and the conflict behaviour', async () => {
    const { client, calls } = setup(() => json(201, { id: 'new', name: 'Stacja Łódź.drawio', eTag: '"{E1},1"' }));
    const item = await client.uploadNew('d1', 'folder1', 'Stacja Łódź.drawio', new Blob(['<mxfile/>']), 'fail');
    expect(item.eTag).toBe('"{E1},1"');
    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe('PUT');
    expect(calls[0].url).toBe(
      `${GRAPH_BASE_URL}/drives/d1/items/folder1:/Stacja%20%C5%81%C3%B3d%C5%BA.drawio:/content?@microsoft.graph.conflictBehavior=fail`
    );
    expect(calls[0].headers.Authorization).toBe(`Bearer token-for-${SCOPE_FILES_READWRITE}`);
    expect(calls[0].headers['If-Match']).toBeUndefined();
  });

  it('uploads a large file through an upload session in 320 KiB-multiple chunks without auth', async () => {
    const size = SIMPLE_UPLOAD_LIMIT + 1000;
    const total = Math.ceil(size / UPLOAD_CHUNK_SIZE);
    const { client, calls } = setup((call, index) => {
      if (index === 0) return json(200, { uploadUrl: 'https://upload.example/session1' });
      if (index < total) return json(202, { nextExpectedRanges: [] });
      return json(201, { id: 'big', name: 'big.drawio', eTag: '"{B},1"' });
    });
    const item = await client.uploadNew('d1', 'root', 'big.drawio', new Blob([new Uint8Array(size)]), 'rename');
    expect(item.id).toBe('big');
    expect(calls[0].method).toBe('POST');
    expect(calls[0].url).toBe(`${GRAPH_BASE_URL}/drives/d1/items/root:/big.drawio:/createUploadSession`);
    expect(JSON.parse(String(calls[0].body))).toEqual({ item: { '@microsoft.graph.conflictBehavior': 'rename', name: 'big.drawio' } });
    const puts = calls.slice(1);
    expect(puts).toHaveLength(total);
    expect(UPLOAD_CHUNK_SIZE % (320 * 1024)).toBe(0);
    expect(puts[0].headers['Content-Range']).toBe(`bytes 0-${UPLOAD_CHUNK_SIZE - 1}/${size}`);
    expect(puts[puts.length - 1].headers['Content-Range']).toBe(`bytes ${(total - 1) * UPLOAD_CHUNK_SIZE}-${size - 1}/${size}`);
    for (const put of puts) {
      expect(put.url).toBe('https://upload.example/session1');
      expect(put.headers.Authorization).toBeUndefined();
    }
  });

  it('saves back with If-Match and turns 412 into GraphConflictError', async () => {
    const { client, calls } = setup(() =>
      json(412, { error: { code: 'resourceModified', message: 'ETag does not match' } })
    );
    const err = await client.replaceContent('d1', 'i1', new Blob(['x']), '"{E1},3"').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(GraphConflictError);
    expect((err as GraphConflictError).status).toBe(412);
    expect(calls[0].url).toBe(`${GRAPH_BASE_URL}/drives/d1/items/i1/content`);
    expect(calls[0].headers['If-Match']).toBe('"{E1},3"');
  });

  it('large save-back sends If-Match on createUploadSession', async () => {
    const { client, calls } = setup(() => json(412, { error: { code: 'resourceModified', message: 'changed' } }));
    await expect(
      client.replaceContent('d1', 'i1', new Blob([new Uint8Array(SIMPLE_UPLOAD_LIMIT + 1)]), '"{E},9"')
    ).rejects.toBeInstanceOf(GraphConflictError);
    expect(calls[0].url).toBe(`${GRAPH_BASE_URL}/drives/d1/items/i1/createUploadSession`);
    expect(calls[0].headers['If-Match']).toBe('"{E},9"');
  });

  it('409 nameAlreadyExists is a conflict too', async () => {
    const { client } = setup(() => json(409, { error: { code: 'nameAlreadyExists', message: 'exists' } }));
    await expect(client.uploadNew('d', 'root', 'a.drawio', new Blob(['x']), 'fail')).rejects.toBeInstanceOf(GraphConflictError);
  });

  it('creates sharing links and invitations', async () => {
    const { client, calls } = setup((call) =>
      call.url.endsWith('/invite')
        ? json(200, { value: [{ id: 'p2', roles: ['write'], link: { webUrl: 'https://contoso/invite' } }] })
        : json(201, { id: 'p1', link: { type: 'view', scope: 'organization', webUrl: 'https://contoso/link' } })
    );
    const link = await client.createLink('d1', 'i1', 'view', 'organization');
    expect(link.link?.webUrl).toBe('https://contoso/link');
    expect(calls[0].url).toBe(`${GRAPH_BASE_URL}/drives/d1/items/i1/createLink`);
    expect(JSON.parse(String(calls[0].body))).toEqual({ type: 'view', scope: 'organization' });
    const perms = await client.invite('d1', 'i1', ['a@contoso.com'], 'write', 'Please review');
    expect(perms[0].link?.webUrl).toBe('https://contoso/invite');
    expect(JSON.parse(String(calls[1].body))).toEqual({
      recipients: [{ email: 'a@contoso.com' }],
      roles: ['write'],
      requireSignIn: true,
      sendInvitation: true,
      message: 'Please review',
    });
  });

  it('reports Graph errors with status and code (403 on anonymous links)', async () => {
    const { client } = setup(() => json(403, { error: { code: 'accessDenied', message: 'Sharing is disabled' } }));
    const err = await client.createLink('d1', 'i1', 'view', 'anonymous').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(GraphError);
    expect(err).not.toBeInstanceOf(GraphConflictError);
    expect((err as GraphError).status).toBe(403);
    expect((err as GraphError).code).toBe('accessDenied');
    expect((err as GraphError).message).toBe('Sharing is disabled');
  });

  it('retries throttled requests honouring Retry-After', async () => {
    const { client, sleep, calls } = setup((_call, index) =>
      index === 0 ? json(429, { error: { code: 'tooManyRequests', message: 'slow down' } }, { 'Retry-After': '2' }) : json(200, { value: [] })
    );
    await client.followedSites();
    expect(calls).toHaveLength(2);
    expect(sleep).toHaveBeenCalledWith(2000);
  });

  it('wraps network failures and non-JSON errors', async () => {
    const offline = setup(() => {
      throw new TypeError('Failed to fetch');
    });
    await expect(offline.client.listDrives('s1')).rejects.toMatchObject({ status: 0, code: 'networkError' });
    const html = setup(() => new Response('<html>oops</html>', { status: 500, statusText: 'Server Error' }));
    await expect(html.client.listDrives('s1')).rejects.toMatchObject({ status: 500, message: '500 Server Error' });
  });

  it('downloads text with the item eTag and refuses folders', async () => {
    const { client } = setup((call) =>
      call.url.includes('/content')
        ? new Response('<mxfile/>', { status: 200 })
        : json(200, { id: 'i1', name: 'a.drawio', size: 9, eTag: '"{E},2"', file: {} })
    );
    const { item, text } = await client.downloadText('d1', 'i1');
    expect(text).toBe('<mxfile/>');
    expect(item.eTag).toBe('"{E},2"');
    const folder = setup(() => json(200, { id: 'f', name: 'Folder', folder: { childCount: 1 } }));
    await expect(folder.client.downloadText('d1', 'f')).rejects.toThrow(/folder/);
  });
});
