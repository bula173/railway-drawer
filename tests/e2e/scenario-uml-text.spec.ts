/**
 * @file scenario-uml-text.spec.ts
 * @brief Scenario steps with a UML diagram (PlantUML sequence) and Markdown text: the step editor
 *        (live previews), the step view's side panel (Prev/Next switch drawing + UML + text,
 *        collapse remembered), reload, File > Save (.drawio carries rdStepUml / rdStepText) and
 *        File > Export Scenario (HTML) with all three parts.
 *
 * Runs on any port. Sequence diagrams are rendered locally: the test fails if anything is sent to a
 * PlantUML server (requests to other hosts containing "plantuml" are aborted and recorded).
 */
import { readFile } from 'node:fs/promises';
import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { revealMenuItem } from './menu-helpers';

const HEXAGON = '#drawio-palette-container section[data-palette-id="general"] .rd-dp-item[title="Hexagon"]';

const UML_1 = `@startuml
participant Train
participant RBC
Train -> RBC : MA Request
alt route free
  RBC --> Train : Movement Authority
else occupied
  RBC --> Train : MA shortened
end
note right of RBC : checks "S1" & <route>
@enduml`;

const TEXT_1 = `## Żądanie MA
- pociąg wysyła **MA Request**
- RBC odpowiada`;

const UML_2 = `@startuml
RBC -> IXL : route status?
IXL --> RBC : route set
@enduml`;

const TEXT_2 = `# Krok drugi
1. sprawdzenie przebiegu
2. odpowiedź`;

interface CachedTab {
  scenarios?: Array<{ name: string; steps: Array<{ name: string; uml?: string; text?: string }> }>;
}

function cachedTabs(page: Page): Promise<CachedTab[]> {
  return page.evaluate(() => {
    try {
      const cache = JSON.parse(localStorage.getItem('railway-drawer-cache') ?? 'null') as { data?: { tabs?: CachedTab[] } } | null;
      return cache?.data?.tabs ?? [];
    } catch {
      return [];
    }
  });
}

async function freshApp(page: Page): Promise<void> {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator('#tabs-container .tab-button.active')).toHaveCount(1);
}

async function fillStepEditor(page: Page, name: string, uml: string, text: string): Promise<void> {
  const editor = page.locator('[data-testid="scenario-step-editor"]');
  await expect(editor).toBeVisible();
  await editor.locator('input[name="template-name"]').fill(name);
  await editor.locator('textarea[name="step-uml"]').fill(uml);
  await editor.locator('textarea[name="step-text"]').fill(text);
  // live previews (debounced)
  await expect(editor.locator('.rd-scn-uml-preview svg')).toBeVisible();
  await expect(editor.locator('.rd-scn-md-preview')).not.toContainText('No text');
}

test.describe('scenario steps with UML and text', () => {
  test('editor, side panel, prev/next, reload, .drawio and HTML export', async ({ page }) => {
    test.setTimeout(120_000);
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));
    const plantUmlRequests: string[] = [];
    await page.route(
      (url) => url.hostname !== 'localhost' && url.hostname !== '127.0.0.1' && /plantuml/i.test(url.href),
      (route) => {
        plantUmlRequests.push(route.request().url());
        return route.abort();
      }
    );
    await freshApp(page);

    await page.locator('[data-right-panel="scenarios"]').click();
    const panel = page.locator('#scenarios-panel');
    await panel.locator('.rd-scn-new').click();
    const dialog = page.locator('.rd-tpl-modal');
    await dialog.locator('input[name="template-name"]').fill('Wjazd z RBC');
    await dialog.locator('.rd-tpl-btn-primary').click();
    await expect(panel.locator('.rd-scn-name')).toHaveText('Wjazd z RBC');

    // step 1: drawing (1 hexagon) + PlantUML sequence + Markdown
    await page.locator(HEXAGON).click({ modifiers: ['Alt'] }); // Alt: not placed next to / connected to the selection
    await panel.locator('.rd-scn-add-step').click();
    await fillStepEditor(page, 'Żądanie MA', UML_1, TEXT_1);
    const editor = page.locator('[data-testid="scenario-step-editor"]');
    await expect(editor.locator('.rd-scn-uml-preview')).toContainText('MA Request');
    await expect(editor.locator('.rd-scn-uml-preview')).toContainText('[route free]');
    await expect(editor.locator('.rd-scn-md-preview h2')).toHaveText('Żądanie MA');
    await expect(editor.locator('.rd-scn-md-preview li')).toHaveCount(2);
    await page.screenshot({ path: test.info().outputPath('scenario-step-editor.png') });
    await editor.locator('.rd-tpl-btn-primary').click();
    await expect(editor).toHaveCount(0);

    // step 2: another hexagon, other UML and text
    await page.locator(HEXAGON).click({ modifiers: ['Alt'] }); // Alt: not placed next to / connected to the selection
    await panel.locator('.rd-scn-add-step').click();
    await fillStepEditor(page, 'Przebieg', UML_2, TEXT_2);
    await editor.locator('.rd-tpl-btn-primary').click();
    await expect(editor).toHaveCount(0);
    await expect(panel.locator('.rd-scn-step-name')).toHaveText(['Żądanie MA', 'Przebieg']);
    await expect(panel.locator('.rd-scn-step').first().locator('.rd-scn-badge-small')).toHaveText(['UML', 'Text']);

    // view step 1: side panel shows the UML (svg) and the Markdown (heading, list)
    const side = page.locator('[data-testid="scenario-side-panel"]');
    const banner = page.locator('.rd-scn-banner-title');
    await panel.locator('.rd-scn-step').first().click();
    await expect(banner).toHaveText('Wjazd z RBC — step 1/2: Żądanie MA');
    await expect(side).toBeVisible();
    await expect(side.locator('.rd-scn-side-uml svg')).toBeVisible();
    await expect(side.locator('.rd-scn-side-uml')).toContainText('Movement Authority');
    await expect(side.locator('.rd-scn-side-text h2')).toHaveText('Żądanie MA');
    await expect(side.locator('.rd-scn-side-text li')).toHaveText(['pociąg wysyła MA Request', 'RBC odpowiada']);
    await expect(side.locator('.rd-scn-side-text strong')).toHaveText('MA Request');
    const shapesStep1 = await page.locator('[data-testid="scenario-view"] .rd-scn-view-host svg path').count();
    expect(shapesStep1).toBeGreaterThan(0);
    await page.screenshot({ path: test.info().outputPath('scenario-uml-text-view.png') });

    // Next: drawing, UML and text switch together
    await page.locator('.rd-scn-next').click();
    await expect(banner).toHaveText('Wjazd z RBC — step 2/2: Przebieg');
    await expect(side.locator('.rd-scn-side-uml')).toContainText('route status?');
    await expect(side.locator('.rd-scn-side-uml')).not.toContainText('Movement Authority');
    await expect(side.locator('.rd-scn-side-text h1')).toHaveText('Krok drugi');
    await expect(side.locator('.rd-scn-side-text ol li')).toHaveCount(2);
    await expect.poll(() => page.locator('[data-testid="scenario-view"] .rd-scn-view-host svg path').count()).toBe(2 * shapesStep1);
    // ← back to step 1
    await page.keyboard.press('ArrowLeft');
    await expect(side.locator('.rd-scn-side-text h2')).toHaveText('Żądanie MA');

    // collapse the side panel: remembered across reloads
    await side.locator('.rd-scn-side-toggle').click();
    await expect(side).toHaveClass(/rd-scn-side-collapsed/);
    await expect(side.locator('.rd-scn-side-uml')).toBeHidden();
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-testid="scenario-view"]')).toBeHidden();

    // reload: the steps keep their UML and text (tab cache)
    await expect
      .poll(async () => (await cachedTabs(page))[0]?.scenarios?.[0]?.steps.map((s) => [s.name, s.text?.split('\n')[0]]), { timeout: 15_000 })
      .toEqual([
        ['Żądanie MA', '## Żądanie MA'],
        ['Przebieg', '# Krok drugi'],
      ]);
    await page.reload();
    await expect(page.locator('#tabs-container .tab-button.active')).toHaveCount(1);
    await page.locator('[data-right-panel="scenarios"]').click();
    await panel.locator('.rd-scn-toggle').click();
    await panel.locator('.rd-scn-step').nth(1).click();
    await expect(banner).toHaveText('Wjazd z RBC — step 2/2: Przebieg');
    await expect(side).toHaveClass(/rd-scn-side-collapsed/);
    await side.locator('.rd-scn-side-toggle').click();
    await expect(side).not.toHaveClass(/rd-scn-side-collapsed/);
    await expect(side.locator('.rd-scn-side-uml svg')).toBeVisible();
    await expect(side.locator('.rd-scn-side-text h1')).toHaveText('Krok drugi');
    await page.locator('.rd-scn-exit').click();

    // edit step 1 keeps its UML/text in the editor
    await panel.locator('.rd-scn-step').first().locator('.rd-scn-more').click();
    await panel.locator('.rd-scn-step').first().locator('.rd-scn-step-edit').click();
    await expect(editor.locator('textarea[name="step-uml"]')).toHaveValue(UML_1);
    await expect(editor.locator('textarea[name="step-text"]')).toHaveValue(TEXT_1);
    await page.keyboard.press('Escape');
    await expect(editor).toHaveCount(0);

    // File > Save: the .drawio file carries the UML and the Markdown on the step pages
    const downloadPromise = page.waitForEvent('download');
    await page.locator('.menu-item[data-menu="file"]').click();
    await page.locator('.menu-dropdown-item[data-action="save"]').click();
    const xml = await readFile(await (await downloadPromise).path(), 'utf8');
    // newlines escaped as character references (Chrome's XMLSerializer writes &#10;, mxUtils.getXml &#xa;)
    const tag = (/<diagram [^>]*rdStepName="Żądanie MA"[^>]*>/.exec(xml)?.[0] ?? '').replace(/&#xa;/gi, '&#10;');
    expect(tag).not.toContain('\n');
    expect(tag).toContain('rdStepUml="@startuml&#10;participant Train&#10;');
    expect(tag).toContain('note right of RBC : checks &quot;S1&quot; &amp; &lt;route&gt;');
    expect(tag).toContain('rdStepText="## Żądanie MA&#10;- pociąg wysyła **MA Request**&#10;- RBC odpowiada"');
    const doc = await page.evaluate((text) => {
      const pages = Array.from(new DOMParser().parseFromString(text, 'text/xml').getElementsByTagName('diagram'));
      return pages.map((p) => [p.getAttribute('rdStepUml'), p.getAttribute('rdStepText')]);
    }, xml);
    expect(doc.slice(1)).toEqual([
      [UML_1, TEXT_1],
      [UML_2, TEXT_2],
    ]);

    // File > Export Scenario (HTML): every step with drawing, UML and text
    const exportPromise = page.waitForEvent('download');
    await page.locator('.menu-item[data-menu="file"]').click();
    await revealMenuItem(page.locator('.menu-dropdown-item[data-action="exportScenarioHtml"]'));
    await page.locator('.menu-dropdown-item[data-action="exportScenarioHtml"]').click();
    const exported = await exportPromise;
    expect(exported.suggestedFilename()).toMatch(/ - Wjazd z RBC\.html$/);
    const html = await readFile(await exported.path(), 'utf8');
    expect(html.match(/<section class="step"/g)).toHaveLength(2);
    expect(html.match(/<img alt="Drawing of step \d[^"]*" src="data:image\/svg\+xml;base64,/g)).toHaveLength(2);
    expect(html.match(/<svg[^>]*class="rd-uml-svg"/g)).toHaveLength(2);
    expect(html).toContain('Movement Authority');
    expect(html).toContain('route status?');
    expect(html).toContain('<h2>Żądanie MA</h2>');
    expect(html).toContain('<strong>MA Request</strong>');
    expect(html).toContain('<h1>Krok drugi</h1>');
    expect(html).not.toMatch(/<script/i);
    // the exported page renders: drawings decode as images
    const exportPage = await page.context().newPage();
    await exportPage.setContent(html);
    await expect(exportPage.locator('section.step')).toHaveCount(2);
    await expect.poll(() => exportPage.locator('.drawing img').evaluateAll((imgs) => imgs.map((i) => (i as HTMLImageElement).naturalWidth > 0))).toEqual([true, true]);
    await expect(exportPage.locator('.uml svg')).toHaveCount(2);
    await exportPage.close();

    expect(plantUmlRequests).toEqual([]);
    expect(pageErrors).toEqual([]);
  });
});
