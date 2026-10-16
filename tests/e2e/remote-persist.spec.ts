/**
 * @file remote-persist.spec.ts
 * @brief Remote-file bindings survive a page reload: a file opened from a (fake) storage provider,
 *        edited, the page reloaded, Ctrl+S still saves back to it with the stored version.
 *        Also: unsaved-changes dot, sign-in prompt + conflict dialog after a reload, Reload from /
 *        Unlink from (status bar menu, File menu), File > Open from disk unbinds the tab.
 *
 * Uses the dev-only test provider (src/debug/fake-remote-provider.ts): enabled by localStorage
 * `rd.fakeRemote` = '1' on the Vite dev server only; its "remote" files live in localStorage
 * `rd.fakeRemote.files`. Runs on any port.
 */
import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

const FILE = 'Station.drawio';

function drawio(label: string): string {
  return (
    '<mxfile><diagram name="Station" id="page-1"><mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>' +
    `<mxCell id="2" value="${label}" style="rounded=0;whiteSpace=wrap;" vertex="1" parent="1">` +
    '<mxGeometry x="40" y="40" width="120" height="40" as="geometry"/></mxCell></root></mxGraphModel></diagram></mxfile>'
  );
}

interface FakeFile {
  xml: string;
  version: string;
}

async function freshApp(page: Page, opts: { signedIn?: boolean } = {}): Promise<void> {
  await page.goto('/');
  await page.evaluate(
    ({ files, signedIn }) => {
      localStorage.clear();
      sessionStorage.clear();
      localStorage.setItem('rd.fakeRemote', '1');
      localStorage.setItem('rd.fakeRemote.files', JSON.stringify(files));
      if (signedIn) sessionStorage.setItem('rd.fakeRemote.account', '1');
    },
    { files: { [FILE]: { xml: drawio('Signal S1'), version: 'v1' } }, signedIn: opts.signedIn ?? true }
  );
  await page.goto('/');
  await ready(page);
}

async function ready(page: Page): Promise<void> {
  await expect(page.locator('body')).toHaveAttribute('data-editor', 'legacy');
  await expect(page.locator('#tabs-container .tab-button.active')).toHaveCount(1);
  // sharing (File-menu provider items) is wired a moment after the tabs appear
  await expect(page.locator('#file-menu-remote-items [data-provider="fake-remote"][data-remote-action="open"]')).toHaveCount(1);
}

async function fileMenu(page: Page, action: string): Promise<void> {
  await page.locator('.menu-item[data-menu="file"]').click();
  await page.locator(`#file-menu-remote-items .menu-dropdown-item[data-provider="fake-remote"][data-remote-action="${action}"]`).click();
}

async function openRemoteFile(page: Page): Promise<void> {
  await fileMenu(page, 'open');
  const dialog = page.locator('[data-testid="remote-open-dialog"]');
  await expect(dialog).toBeVisible();
  await dialog.locator('.rd-share-entry', { hasText: 'Test repo' }).click();
  await dialog.locator('.rd-share-entry[data-kind="file"]', { hasText: FILE }).click();
  await dialog.locator('[data-testid="remote-open-confirm"]').click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('#tabs-container .tab-button.active .tab-label')).toHaveText('Station');
  await expect(page.locator('#status-remote')).toHaveText(`Test storage: Test repo › ${FILE}`);
}

/** Adds a labelled vertex to the active tab (dev server module import). */
async function addCell(page: Page, label: string): Promise<void> {
  await page.evaluate(async (value) => {
    const registry = await import('/src/services/service-registry.ts' as string);
    const graph = registry.ServiceRegistry.getTabManager().getActiveTab().graph;
    graph.insertVertex(graph.getDefaultParent(), null, value, 200, 60, 100, 40);
  }, label);
}

async function labels(page: Page): Promise<string[]> {
  return page.evaluate(async () => {
    const registry = await import('/src/services/service-registry.ts' as string);
    const graph = registry.ServiceRegistry.getTabManager().getActiveTab().graph;
    return graph.getChildVertices(graph.getDefaultParent()).map((cell: { value: unknown }) => String(cell.value));
  });
}

async function store(page: Page): Promise<Record<string, FakeFile>> {
  return page.evaluate(() => JSON.parse(localStorage.getItem('rd.fakeRemote.files') ?? '{}'));
}

async function saveLog(page: Page): Promise<Array<Record<string, unknown>>> {
  return page.evaluate(() => (JSON.parse(localStorage.getItem('rd.fakeRemote.log') ?? '[]') as Array<Record<string, unknown>>).filter((e) => e.op !== 'open' && e.op !== 'signIn'));
}

const dirtyDot = (page: Page) => page.locator('#tabs-container .tab-button.active .rd-remote-dirty-dot');

test.describe('remote file bindings across reloads', () => {
  test('open from the provider, edit, reload, Ctrl+S saves back with the stored version', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));
    await freshApp(page);
    await openRemoteFile(page);
    await expect(dirtyDot(page)).toHaveCount(0);

    await addCell(page, 'Balise BG1');
    await expect(dirtyDot(page)).toHaveCount(1);
    await expect(page.locator('#status-remote-item')).toHaveAttribute('data-dirty', 'true');

    // Leaving with unsaved remote changes: the browser asks (beforeunload); accept and reload
    const dialogs: string[] = [];
    page.on('dialog', (dialog) => {
      dialogs.push(dialog.type());
      void dialog.accept();
    });
    await page.reload();
    await ready(page);
    expect(dialogs).toContain('beforeunload');

    // Restored: same tab, still bound, still dirty, not yet verified
    await expect(page.locator('#tabs-container .tab-button.active .tab-label')).toHaveText('Station');
    await expect(page.locator('#status-remote-item')).toBeVisible();
    await expect(page.locator('#status-remote')).toHaveText(`Test storage: Test repo › ${FILE}`);
    await expect(page.locator('#status-remote-item')).toHaveAttribute('data-verified', 'false');
    await expect(dirtyDot(page)).toHaveCount(1);
    expect(await labels(page)).toEqual(expect.arrayContaining(['Signal S1', 'Balise BG1']));
    expect(await saveLog(page)).toEqual([]);

    await page.keyboard.press('Control+s');
    await expect(page.locator('.notification', { hasText: `Saved to Test storage: ${FILE}` })).toBeVisible();
    const files = await store(page);
    expect(files[FILE].version).toBe('v2');
    expect(files[FILE].xml).toContain('Balise BG1');
    expect(await saveLog(page)).toEqual([expect.objectContaining({ op: 'save', expectedVersion: 'v1', version: 'v2' })]);
    await expect(dirtyDot(page)).toHaveCount(0);
    await expect(page.locator('#status-remote-item')).toHaveAttribute('data-verified', 'true');

    // The new version is what the cache holds now: another reload + save sends v2
    await page.reload();
    await ready(page);
    await expect(page.locator('#status-remote')).toHaveText(`Test storage: Test repo › ${FILE}`);
    await expect(dirtyDot(page)).toHaveCount(0);
    await addCell(page, 'Signal S2');
    await page.keyboard.press('Control+s');
    await expect.poll(async () => (await store(page))[FILE].version).toBe('v3');
    expect((await saveLog(page)).at(-1)).toMatchObject({ expectedVersion: 'v2', version: 'v3' });
    expect(pageErrors).toEqual([]);
  });

  test('after a reload: sign-in prompt, conflict dialog, Reload from / Unlink from', async ({ page }) => {
    await freshApp(page);
    await openRemoteFile(page);
    await page.reload();
    await ready(page);
    await expect(page.locator('#status-remote')).toHaveText(`Test storage: Test repo › ${FILE}`);

    // Signed out meanwhile, and someone else changed the file (v2)
    await page.evaluate(
      ({ path, xml }) => {
        sessionStorage.removeItem('rd.fakeRemote.account');
        (window as unknown as { __rdFakeRemote: { put(p: string, x: string): string } }).__rdFakeRemote.put(path, xml);
      },
      { path: FILE, xml: drawio('Changed elsewhere') }
    );
    await addCell(page, 'My edit');
    await expect(dirtyDot(page)).toHaveCount(1);

    await page.keyboard.press('Control+s');
    const signIn = page.locator('[data-testid="remote-signin-dialog"]');
    await expect(signIn).toBeVisible();
    await signIn.getByRole('button', { name: 'Sign in' }).click();
    const conflict = page.locator('[data-testid="remote-conflict-dialog"]');
    await expect(conflict).toBeVisible();
    await expect(conflict).toContainText(`"${FILE}" was changed in Test storage`);
    await conflict.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.locator('.notification', { hasText: 'Not saved' })).toBeVisible();
    expect((await store(page))[FILE]).toMatchObject({ version: 'v2', xml: expect.stringContaining('Changed elsewhere') });
    expect((await saveLog(page)).at(-1)).toMatchObject({ op: 'conflict', expectedVersion: 'v1', current: 'v2' });
    await expect(dirtyDot(page)).toHaveCount(1);

    // Status bar item -> Reload from Test storage… (confirm discards the local edit)
    await page.locator('#status-remote-item').click();
    const menu = page.locator('[data-testid="remote-status-menu"]');
    await expect(menu).toBeVisible();
    await menu.locator('[data-remote-action="reload"]').click();
    const confirm = page.locator('[data-testid="remote-confirm-dialog"]');
    await expect(confirm).toContainText('Discard the changes');
    await confirm.locator('[data-testid="remote-confirm-ok"]').click();
    await expect(page.locator('.notification', { hasText: `Reloaded "${FILE}" from Test storage` })).toBeVisible();
    expect(await labels(page)).toEqual(['Changed elsewhere']);
    await expect(dirtyDot(page)).toHaveCount(0);

    // Now based on v2: saving works without a conflict
    await addCell(page, 'On top of v2');
    await page.keyboard.press('Control+s');
    await expect.poll(async () => (await store(page))[FILE].version).toBe('v3');
    expect((await saveLog(page)).at(-1)).toMatchObject({ op: 'save', expectedVersion: 'v2', version: 'v3' });

    // File > Unlink from Test storage: the tab keeps its content, the link is gone (also after a reload)
    await fileMenu(page, 'unlink');
    await expect(page.locator('#status-remote-item')).toBeHidden();
    await page.locator('.menu-item[data-menu="file"]').click();
    await expect(page.locator('#file-menu-remote-items [data-remote-action="unlink"]')).toHaveCount(0);
    await page.keyboard.press('Escape');
    await page.reload();
    await ready(page);
    await expect(page.locator('#tabs-container .tab-button.active .tab-label')).toHaveText('Station');
    await expect(page.locator('#status-remote-item')).toBeHidden();
    expect(await labels(page)).toEqual(expect.arrayContaining(['Changed elsewhere', 'On top of v2']));
  });

  test('File > Open from disk unbinds the tab', async ({ page }) => {
    await freshApp(page);
    await openRemoteFile(page);
    await page.locator('.menu-item[data-menu="file"]').click();
    const chooser = page.waitForEvent('filechooser');
    await page.locator('#file-menu .menu-dropdown-item[data-action="open"], .menu-dropdown-item[data-action="open"]').first().click();
    await (await chooser).setFiles({ name: 'local.drawio', mimeType: 'application/xml', buffer: Buffer.from(drawio('From disk')) });
    await expect.poll(() => labels(page)).toEqual(['From disk']);
    await expect(page.locator('#status-remote-item')).toBeHidden();
    await expect(page.locator('.notification', { hasText: 'no longer linked to Test storage' })).toBeVisible();
  });
});
