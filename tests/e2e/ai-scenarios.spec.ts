/**
 * @file ai-scenarios.spec.ts
 * @brief AI + scenarios end to end, offline (Anthropic Messages API mocked with page.route, no real
 *        key): "przygotuj scenariusz wjazdu pociągu…" -> mocked tool calls search the templates,
 *        open "Level transition L1 → L2" as a new tab and build a 3-step scenario with states ->
 *        the Scenarios panel lists it and the scenario view steps through it (states visible in the
 *        snapshots). Confirm mode: Discard of a scenario step removes the step again. Any port.
 */
import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { sseBody } from '../../src/ai/__tests__/sse';
import type { FakeReply } from '../../src/ai/__tests__/sse';

const KEY = 'sk-ant-e2e-fake-key-0123456789abcdef';
const TEMPLATE = 'ertms-tpl-22'; // "Level transition L1 → L2": T1, TC1..TC4, S2, S4_Exit, S6

async function mockAnthropic(page: Page, replies: FakeReply[]): Promise<Array<Record<string, unknown>>> {
  const bodies: Array<Record<string, unknown>> = [];
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST, OPTIONS' };
  await page.route('https://api.anthropic.com/**', async (route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    bodies.push(req.postDataJSON() as Record<string, unknown>);
    const reply = replies.shift();
    if (!reply) return route.fulfill({ status: 500, headers: { ...cors, 'content-type': 'application/json' }, body: '{"type":"error","error":{"type":"api_error","message":"no reply scripted"}}' });
    return route.fulfill({ status: 200, headers: { ...cors, 'content-type': 'text/event-stream' }, body: sseBody(reply) });
  });
  return bodies;
}

async function openAiWithKey(page: Page): Promise<void> {
  await page.goto('/');
  await page.locator('#graph-container').waitFor();
  await expect(async () => {
    await page.locator('[data-right-panel="ai"]').click();
    await expect(page.getByTestId('ai-panel')).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 15_000 });
  const settings = page.getByTestId('ai-settings');
  if (!(await settings.evaluate((d) => (d as HTMLDetailsElement).open))) await settings.locator('summary').click();
  await page.getByTestId('ai-key').fill(KEY);
  await page.getByTestId('ai-key-save').click();
  await expect(page.getByTestId('ai-key-status')).toContainText('sk-ant-…cdef');
}

/** Step states/names of the active tab's scenarios (read from the app). */
async function scenarios(page: Page): Promise<Array<{ name: string; steps: Array<{ name: string; occupied: number }> }>> {
  return page.evaluate(async () => {
    const registry = await import('/src/services/service-registry.ts' as string);
    const tab = registry.ServiceRegistry.getTabManager().getActiveTab();
    return tab.document.scenarios
      .list()
      .map((s: { name: string; steps: Array<{ name: string; xml: string }> }) => ({
        name: s.name,
        steps: s.steps.map((st) => ({ name: st.name, occupied: (st.xml.match(/rdState="occupied"/g) ?? []).length })),
      }));
  });
}

test.describe('AI builds scenarios from templates', () => {
  test('template-first: insert a template as a new tab, build a 3-step scenario, step through it', async ({ page }) => {
    test.setTimeout(120_000);
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));
    const replies: FakeReply[] = [
      { blocks: [{ type: 'text', text: 'Szukam szablonu.' }, { type: 'tool_use', id: 'toolu_1', name: 'list_templates', input: { query: 'przejście poziomu L1 L2 wjazd', limit: 5 } }] },
      { blocks: [{ type: 'tool_use', id: 'toolu_2', name: 'insert_template', input: { id: TEMPLATE, mode: 'newTab' } }] },
      {
        blocks: [
          {
            type: 'tool_use',
            id: 'toolu_3',
            name: 'build_scenario',
            input: {
              name: 'Wjazd pociągu',
              description: 'Pociąg przejeżdża granicę L1/L2',
              steps: [
                { name: 'Sytuacja początkowa', text: 'Wszystkie odcinki **wolne**.' },
                { name: 'Przebieg ustawiony', states: [{ id: 'TC2', state: 'reserved' }, { id: 'TC3', state: 'reserved' }, { id: 'S2', aspect: 'proceed' }] },
                {
                  name: 'Pociąg na TC2',
                  states: [{ id: 'TC2', state: 'occupied' }, { id: 'S2', aspect: 'stop' }],
                  uml: '@startuml\nTrain -> RBC: Position report\nRBC -> Train: MA\n@enduml',
                },
              ],
            },
          },
        ],
      },
      { blocks: [{ type: 'tool_use', id: 'toolu_4', name: 'view_scenario', input: { scenario: 'Wjazd pociągu', step: 1 } }] },
      { blocks: [{ type: 'text', text: 'Gotowe: szablon **Level transition L1 → L2**, scenariusz z 3 krokami.' }] },
    ];
    const bodies = await mockAnthropic(page, replies);
    await openAiWithKey(page);
    const input = page.getByTestId('ai-input');
    await input.fill('Przygotuj scenariusz wjazdu pociągu przez granicę poziomów L1/L2');
    await input.press('Enter');
    const log = page.getByTestId('ai-log');
    await expect(log.locator('.rd-ai-assistant').last()).toContainText('Gotowe', { timeout: 30_000 });
    await expect(log.locator('.rd-ai-tool[data-tool="list_templates"]')).toContainText('best "Level transition L1 → L2"');
    await expect(log.locator('.rd-ai-tool[data-tool="insert_template"]')).toHaveText('✓ Inserted template "Level transition L1 → L2" as new tab (S2, S4_Exit, S6)');
    await expect(log.locator('.rd-ai-tool[data-tool="build_scenario"]')).toHaveText('✓ Built scenario "Wjazd pociągu" with 3 steps');
    await expect(log.locator('.rd-ai-tool[data-tool="view_scenario"]')).toHaveText('✓ Showing scenario "Wjazd pociągu" step 1/3');
    // the template became the active tab
    await expect(page.locator('#tabs-container .tab-button.active')).toContainText('Level transition L1 → L2');
    // the model got the ranked templates back
    const second = JSON.stringify(bodies[1].messages);
    expect(second).toContain(TEMPLATE);

    // scenario data: incremental states per step
    expect(await scenarios(page)).toEqual([
      {
        name: 'Wjazd pociągu',
        steps: [
          { name: 'Sytuacja początkowa', occupied: 0 },
          { name: 'Przebieg ustawiony', occupied: 0 },
          { name: 'Pociąg na TC2', occupied: 1 },
        ],
      },
    ]);

    // the scenario view is open at step 1; step through it
    const banner = page.locator('.rd-scn-banner-title');
    await expect(banner).toHaveText('Wjazd pociągu — step 1/3: Sytuacja początkowa');
    await expect(page.getByTestId('scenario-side-panel')).toContainText('Wszystkie odcinki');
    await page.locator('.rd-scn-next').click();
    await expect(banner).toHaveText('Wjazd pociągu — step 2/3: Przebieg ustawiony');
    await page.locator('.rd-scn-next').click();
    await expect(banner).toHaveText('Wjazd pociągu — step 3/3: Pociąg na TC2');
    await expect(page.getByTestId('scenario-side-panel').locator('svg').first()).toBeVisible();

    // the Scenarios panel lists it
    await page.locator('[data-right-panel="scenarios"]').click();
    const panel = page.locator('#scenarios-panel');
    await expect(panel.locator('.rd-scn-name')).toHaveText('Wjazd pociągu');
    await expect(panel.locator('.rd-scn-count')).toHaveText('3 steps');
    await expect(panel.locator('.rd-scn-step-name')).toHaveText(['Sytuacja początkowa', 'Przebieg ustawiony', 'Pociąg na TC2']);
    await page.locator('.rd-scn-exit').click();
    await expect(page.getByTestId('scenario-view')).toBeHidden();
    await expect(page.locator('#graph-container > div[id^="graph-tab-"]:visible')).toHaveCount(1);
    expect(pageErrors).toEqual([]);
  });

  test('confirm mode: Discard of a scenario step removes the step and its states', async ({ page }) => {
    test.setTimeout(120_000);
    const replies: FakeReply[] = [
      { blocks: [{ type: 'tool_use', id: 'toolu_a', name: 'insert_template', input: { id: TEMPLATE, mode: 'intoTab' } }] },
      { blocks: [{ type: 'tool_use', id: 'toolu_b', name: 'create_scenario', input: { name: 'Test' } }] },
      { blocks: [{ type: 'tool_use', id: 'toolu_c', name: 'add_scenario_step', input: { scenario: 'Test', name: 'TC3 zajęty', states: [{ id: 'TC3', state: 'occupied' }] } }] },
      { blocks: [{ type: 'text', text: 'OK, bez kroku.' }] },
    ];
    const bodies = await mockAnthropic(page, replies);
    await openAiWithKey(page);
    await page.getByTestId('ai-confirm').check();
    await page.getByTestId('ai-input').fill('Dodaj krok');
    await page.getByTestId('ai-send').click();
    const cards = page.getByTestId('ai-confirm-card');
    await expect(cards.nth(0)).toContainText('Inserted template "Level transition L1 → L2"', { timeout: 30_000 });
    await cards.nth(0).getByTestId('ai-keep').click();
    await expect(cards.nth(1)).toContainText('Created scenario "Test"');
    await expect(cards.nth(1)).toContainText('Scenarios: changed');
    await cards.nth(1).getByTestId('ai-keep').click();
    await expect(cards.nth(2)).toContainText('Added step 1 "TC3 zajęty" to scenario "Test"');
    await expect(cards.nth(2)).toContainText('changed');
    expect(await scenarios(page)).toEqual([{ name: 'Test', steps: [{ name: 'TC3 zajęty', occupied: 1 }] }]);
    await cards.nth(2).getByTestId('ai-discard').click();
    await expect(page.getByTestId('ai-log').locator('.rd-ai-assistant').last()).toHaveText('OK, bez kroku.');
    expect(await scenarios(page)).toEqual([{ name: 'Test', steps: [] }]);
    const occupied = await page.evaluate(async () => {
      const registry = await import('/src/services/service-registry.ts' as string);
      return (registry.ServiceRegistry.getTabManager().getActiveTab().document.serializeToXml() as string).includes('rdState="occupied"');
    });
    expect(occupied).toBe(false);
    const last = bodies[3].messages as Array<{ content: Array<{ is_error?: boolean; content?: string }> }>;
    expect(last[last.length - 1].content[0].is_error).toBe(true);
  });
});
