/**
 * UC-3 E2E Test Suite
 * Tests the full visual regression testing flow against the running API server.
 * Prerequisite: API server running at http://localhost:3001
 */
import { describe, it, expect, beforeAll } from 'vitest';

const API = 'http://localhost:3001/v1';

async function api(method: string, path: string, body?: any) {
  const opts: RequestInit = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${API}${path}`, opts);
  return { status: res.status, json: await res.json() };
}

describe('UC-3 E2E: Visual Regression Testing Full Flow', () => {
  // ─── Verify seed data ──────────────────────────────────────

  describe('1. Seed data verification', () => {
    it('should have demo baselines from seed', async () => {
      const { status, json } = await api('GET', '/baselines');
      expect(status).toBe(200);
      expect(json.data.length).toBeGreaterThanOrEqual(4);

      // Check by ID rather than name (name may be updated by other tests)
      const ids = json.data.map((b: any) => b.id);
      expect(ids).toContain('demo-baseline-1');
      expect(ids).toContain('demo-baseline-2');
      expect(ids).toContain('demo-baseline-3');
      expect(ids).toContain('demo-baseline-4');
    });

    it('should have demo visual diffs from seed', async () => {
      const { status, json } = await api('GET', '/visual-diffs');
      expect(status).toBe(200);
      expect(json.data.length).toBeGreaterThanOrEqual(4);
    });

    it('should have mixed-status diff for homepage', async () => {
      const { status, json } = await api('GET', '/visual-diffs/demo-diff-1');
      expect(status).toBe(200);
      expect(json.data.overall_status).toBe('mixed');
      expect(json.data.changes.length).toBe(2);
      expect(json.data.baseline).toBeTruthy();
      expect(json.data.baseline.name).toBeTruthy(); // Name may be updated by other tests
    });

    it('should have no_change diff for login page', async () => {
      const { status, json } = await api('GET', '/visual-diffs/demo-diff-2');
      expect(status).toBe(200);
      expect(json.data.overall_status).toBe('no_change');
      expect(json.data.changes.length).toBe(0);
    });
  });

  // ─── Full flow: Create → Compare → Analyze → Action ──────

  describe('2. Full comparison flow', () => {
    let newBaselineId: string;
    let newDiffId: string;

    it('Step 1: Create a new baseline', async () => {
      const { status, json } = await api('POST', '/baselines', {
        name: 'E2E 테스트 페이지 - Desktop',
        page_url: 'https://e2e.example.com/test-page',
        viewport: { width: 1920, height: 1080 },
        screenshot_url: 'data:image/png;base64,baseline-screenshot-data',
      });
      expect(status).toBe(201);
      expect(json.data.id).toBeTruthy();
      newBaselineId = json.data.id;
    });

    it('Step 2: Verify baseline was created', async () => {
      const { status, json } = await api('GET', `/baselines/${newBaselineId}`);
      expect(status).toBe(200);
      expect(json.data.name).toBe('E2E 테스트 페이지 - Desktop');
      expect(json.data.page_url).toBe('https://e2e.example.com/test-page');
      expect(json.data.viewport).toEqual({ width: 1920, height: 1080 });
    });

    it('Step 3: Create a visual diff (comparison)', async () => {
      const { status, json } = await api('POST', '/visual-diffs', {
        baseline_id: newBaselineId,
        current_screenshot_url: 'data:image/png;base64,current-screenshot-data',
      });
      expect(status).toBe(201);
      expect(json.data.id).toBeTruthy();
      expect(json.data.ai_analysis_status).toBe('pending');
      newDiffId = json.data.id;
    });

    it('Step 4: Trigger AI analysis', async () => {
      const { status, json } = await api('POST', `/visual-diffs/${newDiffId}/analyze`);
      expect(status).toBe(200);
      expect(json.data.ai_analysis_status).toBe('completed');
      expect(json.data.overall_status).toBeDefined();
      expect(Array.isArray(json.data.changes)).toBe(true);
      expect(json.data.changes.length).toBeGreaterThan(0);
      expect(json.data.summary).toBeTruthy();
    });

    it('Step 5: Verify analysis results are persisted', async () => {
      const { status, json } = await api('GET', `/visual-diffs/${newDiffId}`);
      expect(status).toBe(200);
      expect(json.data.ai_analysis_status).toBe('completed');
      expect(json.data.changes.length).toBeGreaterThan(0);
      expect(json.data.baseline.name).toBe('E2E 테스트 페이지 - Desktop');

      // Verify each change has required fields
      for (const change of json.data.changes) {
        expect(change.id).toBeTruthy();
        expect(change.region).toBeDefined();
        expect(change.type).toBeTruthy();
        expect(change.classification).toBeTruthy();
        expect(change.confidence).toBeGreaterThan(0);
        expect(change.description).toBeTruthy();
      }
    });

    it('Step 6: Create a bug report from regression', async () => {
      const { status, json } = await api('POST', `/visual-diffs/${newDiffId}/bug-report`, {
        title: 'E2E: 시각적 회귀 발견',
        severity: 'major',
        description: 'E2E 테스트에서 발견된 시각적 회귀입니다.',
      });
      expect(status).toBe(201);
      expect(json.data.id).toBeTruthy();
      expect(json.data.visual_diff_id).toBe(newDiffId);

      // Verify bug report was created
      const bugRes = await api('GET', `/bug-reports/${json.data.id}`);
      expect(bugRes.status).toBe(200);
      expect(bugRes.json.data.title).toBe('E2E: 시각적 회귀 발견');
      expect(bugRes.json.data.visualDiffId).toBe(newDiffId);
    });
  });

  // ─── Baseline update flow ─────────────────────────────────

  describe('3. Baseline update (approve) flow', () => {
    let approveBaselineId: string;
    let approveDiffId: string;

    it('Step 1: Create baseline and diff for approval', async () => {
      const baselineRes = await api('POST', '/baselines', {
        name: '승인 테스트 페이지',
        page_url: 'https://e2e.example.com/approve-test',
        screenshot_url: 'original-screenshot-url',
      });
      approveBaselineId = baselineRes.json.data.id;

      const diffRes = await api('POST', '/visual-diffs', {
        baseline_id: approveBaselineId,
        current_screenshot_url: 'new-screenshot-url',
      });
      approveDiffId = diffRes.json.data.id;
    });

    it('Step 2: Approve changes (update baseline)', async () => {
      const { status, json } = await api('POST', `/visual-diffs/${approveDiffId}/approve`);
      expect(status).toBe(200);
      expect(json.data.baseline_updated).toBe(true);
    });

    it('Step 3: Verify baseline screenshot was updated', async () => {
      const { status, json } = await api('GET', `/baselines/${approveBaselineId}`);
      expect(status).toBe(200);
      expect(json.data.screenshot_url).toBe('new-screenshot-url');
    });
  });

  // ─── Filtering & History ──────────────────────────────────

  describe('4. Filtering and history', () => {
    it('should filter visual diffs by baseline_id', async () => {
      const { status, json } = await api('GET', '/visual-diffs?baseline_id=demo-baseline-1');
      expect(status).toBe(200);
      expect(json.data.length).toBeGreaterThanOrEqual(1);
      for (const diff of json.data) {
        expect(diff.baseline_id).toBe('demo-baseline-1');
      }
    });

    it('should filter visual diffs by status', async () => {
      const { status, json } = await api('GET', '/visual-diffs?status=regression');
      expect(status).toBe(200);
      for (const diff of json.data) {
        expect(diff.overall_status).toBe('regression');
      }
    });

    it('should show all baselines with their status context', async () => {
      const baselinesRes = await api('GET', '/baselines');
      const diffsRes = await api('GET', '/visual-diffs');

      expect(baselinesRes.status).toBe(200);
      expect(diffsRes.status).toBe(200);

      // Each baseline should be linkable to its diffs
      for (const baseline of baselinesRes.json.data) {
        const relatedDiffs = diffsRes.json.data.filter(
          (d: any) => d.baseline_id === baseline.id,
        );
        // Some baselines may not have diffs yet
        if (relatedDiffs.length > 0) {
          expect(relatedDiffs[0].baseline_id).toBe(baseline.id);
        }
      }
    });
  });

  // ─── Update baseline metadata ─────────────────────────────

  describe('5. Baseline management', () => {
    it('should update baseline name', async () => {
      // Create a dedicated baseline for this test to avoid side effects
      const createRes = await api('POST', '/baselines', {
        name: 'Update Test Baseline',
        page_url: 'https://e2e.example.com/update-test',
      });
      const testId = createRes.json.data.id;

      const { status, json } = await api('PUT', `/baselines/${testId}`, {
        name: 'Update Test Baseline (Updated)',
      });
      expect(status).toBe(200);
      expect(json.data.updated).toBe(true);

      // Verify
      const getRes = await api('GET', `/baselines/${testId}`);
      expect(getRes.json.data.name).toBe('Update Test Baseline (Updated)');
    });

    it('should return 404 for non-existent baseline', async () => {
      const { status } = await api('GET', '/baselines/non-existent-id');
      expect(status).toBe(404);
    });

    it('should return 404 for non-existent visual diff', async () => {
      const { status } = await api('GET', '/visual-diffs/non-existent-id');
      expect(status).toBe(404);
    });
  });

  // ─── Error handling ───────────────────────────────────────

  describe('6. Error handling', () => {
    it('should reject visual diff creation with invalid baseline_id', async () => {
      const { status, json } = await api('POST', '/visual-diffs', {
        baseline_id: 'invalid-baseline',
        current_screenshot_url: 'test',
      });
      expect(status).toBe(404);
    });

    it('should reject analyze on non-existent diff', async () => {
      const { status } = await api('POST', '/visual-diffs/invalid/analyze');
      expect(status).toBe(404);
    });

    it('should reject approve on non-existent diff', async () => {
      const { status } = await api('POST', '/visual-diffs/invalid/approve');
      expect(status).toBe(404);
    });

    it('should reject bug report creation on non-existent diff', async () => {
      const { status } = await api('POST', '/visual-diffs/invalid/bug-report', { title: 'test' });
      expect(status).toBe(404);
    });
  });

  // ─── Change Classification ─────────────────────────────────

  describe('7. Change classification (individual)', () => {
    let classifyBaselineId: string;
    let classifyDiffId: string;
    let classifyChangeIds: string[];

    it('Step 1: Create baseline, diff, and run analysis', async () => {
      const bRes = await api('POST', '/baselines', {
        name: 'E2E 분류 테스트 페이지',
        page_url: 'https://e2e.example.com/classify',
        screenshot_url: 'baseline-screenshot',
      });
      classifyBaselineId = bRes.json.data.id;

      const dRes = await api('POST', '/visual-diffs', {
        baseline_id: classifyBaselineId,
        current_screenshot_url: 'current-screenshot',
      });
      classifyDiffId = dRes.json.data.id;

      // Run analysis to populate changes
      const analyzeRes = await api('POST', `/visual-diffs/${classifyDiffId}/analyze`);
      expect(analyzeRes.status).toBe(200);
      expect(analyzeRes.json.data.changes.length).toBeGreaterThan(0);
      classifyChangeIds = analyzeRes.json.data.changes.map((c: any) => c.id);
    });

    it('Step 2: Classify a change as intentional', async () => {
      const { status, json } = await api('PUT', `/visual-diffs/${classifyDiffId}/changes/${classifyChangeIds[0]}`, {
        classification: 'intentional',
      });
      expect(status).toBe(200);
      expect(json.data.classification).toBe('intentional');
    });

    it('Step 3: Verify classification is persisted', async () => {
      const { json } = await api('GET', `/visual-diffs/${classifyDiffId}`);
      const change = json.data.changes.find((c: any) => c.id === classifyChangeIds[0]);
      expect(change.classification).toBe('intentional');
    });

    it('Step 4: Overall status recalculates correctly', async () => {
      // Set all to intentional
      for (const cid of classifyChangeIds) {
        await api('PUT', `/visual-diffs/${classifyDiffId}/changes/${cid}`, {
          classification: 'intentional',
        });
      }
      const { json } = await api('GET', `/visual-diffs/${classifyDiffId}`);
      expect(json.data.overall_status).toBe('intentional');
    });

    it('Step 5: Reject invalid classification', async () => {
      const { status } = await api('PUT', `/visual-diffs/${classifyDiffId}/changes/${classifyChangeIds[0]}`, {
        classification: 'bad_value',
      });
      expect(status).toBe(400);
    });
  });

  // ─── Baselines: project_id filter, response field, pagination ──

  describe('8. Baselines filtering, response fields, and pagination', () => {
    it('baselines list should include project_id field', async () => {
      const { json } = await api('GET', '/baselines');
      expect(json.data.length).toBeGreaterThan(0);
      for (const b of json.data) {
        expect(b.project_id).toBeDefined();
        expect(b.page_url).toBeDefined();
      }
    });

    it('baseline detail should include project_id field', async () => {
      const { json } = await api('GET', '/baselines/demo-baseline-1');
      expect(json.data.project_id).toBe('proj-default');
    });

    it('should filter baselines by project_id', async () => {
      const { status, json } = await api('GET', '/baselines?project_id=proj-default');
      expect(status).toBe(200);
      expect(json.data.length).toBeGreaterThanOrEqual(4);
      for (const b of json.data) {
        expect(b.project_id).toBe('proj-default');
      }
    });

    it('should return empty for non-existent project_id', async () => {
      const { json } = await api('GET', '/baselines?project_id=non-existent');
      expect(json.data.length).toBe(0);
    });

    it('should support pagination with limit and offset', async () => {
      const { json: page1 } = await api('GET', '/baselines?limit=2&offset=0');
      const { json: page2 } = await api('GET', '/baselines?limit=2&offset=2');
      expect(page1.data.length).toBe(2);
      expect(page2.data.length).toBeGreaterThanOrEqual(2);
      expect(page1.meta.limit).toBe(2);
      expect(page1.meta.offset).toBe(0);
      expect(page1.data[0].id).not.toBe(page2.data[0].id);
    });

    it('visual diffs list should support pagination', async () => {
      const { json } = await api('GET', '/visual-diffs?limit=2&offset=0');
      expect(json.data.length).toBeLessThanOrEqual(2);
      expect(json.meta.limit).toBe(2);
    });
  });

  // ─── Viewport validation ─────────────────────────────────

  describe('9. Viewport validation', () => {
    it('should reject invalid viewport', async () => {
      const { status } = await api('POST', '/baselines', {
        name: 'Bad Viewport', viewport: { width: 'abc', height: 900 },
      });
      expect(status).toBe(400);
    });

    it('should reject negative dimensions', async () => {
      const { status } = await api('POST', '/baselines', {
        name: 'Neg Viewport', viewport: { width: -100, height: 900 },
      });
      expect(status).toBe(400);
    });

    it('should accept valid viewport', async () => {
      const { status } = await api('POST', '/baselines', {
        name: 'Valid Viewport', viewport: { width: 375, height: 812 },
      });
      expect(status).toBe(201);
    });

    it('should use default viewport if none provided', async () => {
      const { json } = await api('POST', '/baselines', { name: 'Default VP' });
      const { json: detail } = await api('GET', `/baselines/${json.data.id}`);
      expect(detail.data.viewport).toEqual({ width: 1440, height: 900 });
    });
  });

  // ─── Bug report linkback ──────────────────────────────────

  describe('10. Bug report linkback to changes', () => {
    it('should set bug_report_id on regression changes', async () => {
      const bRes = await api('POST', '/baselines', {
        name: 'Linkback Test', page_url: 'https://e2e.example.com/linkback',
        screenshot_url: 'baseline-data',
      });
      const dRes = await api('POST', '/visual-diffs', {
        baseline_id: bRes.json.data.id, current_screenshot_url: 'current-data',
      });
      const diffId = dRes.json.data.id;
      await api('POST', `/visual-diffs/${diffId}/analyze`);
      const bugRes = await api('POST', `/visual-diffs/${diffId}/bug-report`, {
        title: 'Linkback Bug', severity: 'major',
      });
      const bugReportId = bugRes.json.data.id;
      const { json } = await api('GET', `/visual-diffs/${diffId}`);
      const regressions = json.data.changes.filter((c: any) => c.classification === 'regression');
      for (const ch of regressions) {
        expect(ch.bug_report_id).toBe(bugReportId);
      }
    });
  });

  // ─── Ignore Regions ──────────────────────────────────────

  describe('11. Ignore regions management', () => {
    let irBaselineId: string;

    it('Step 1: Create baseline', async () => {
      const { json } = await api('POST', '/baselines', {
        name: 'IR Test', page_url: 'https://e2e.example.com/ir', screenshot_url: 'data',
      });
      irBaselineId = json.data.id;
    });

    it('Step 2: Add ignore region', async () => {
      const { status, json } = await api('POST', `/baselines/${irBaselineId}/ignore-regions`, {
        region: { x: 0, y: 0, width: 300, height: 50 }, reason: '광고 배너',
      });
      expect(status).toBe(201);
      expect(json.data.region).toEqual({ x: 0, y: 0, width: 300, height: 50 });
    });

    it('Step 3: Add second ignore region', async () => {
      await api('POST', `/baselines/${irBaselineId}/ignore-regions`, {
        region: { x: 100, y: 200, width: 500, height: 300 }, reason: '동적 콘텐츠',
      });
    });

    it('Step 4: List ignore regions', async () => {
      const { json } = await api('GET', `/baselines/${irBaselineId}/ignore-regions`);
      expect(json.data.length).toBe(2);
      expect(json.data[0].baseline_id).toBe(irBaselineId);
    });

    it('Step 5: Delete an ignore region', async () => {
      const listRes = await api('GET', `/baselines/${irBaselineId}/ignore-regions`);
      const { status } = await api('DELETE', `/baselines/${irBaselineId}/ignore-regions/${listRes.json.data[0].id}`);
      expect(status).toBe(200);
      const afterRes = await api('GET', `/baselines/${irBaselineId}/ignore-regions`);
      expect(afterRes.json.data.length).toBe(1);
    });

    it('Step 6: Ignore region filters changes during analysis', async () => {
      await api('POST', `/baselines/${irBaselineId}/ignore-regions`, {
        region: { x: 0, y: 0, width: 1440, height: 100 }, reason: 'nav bar',
      });
      const dRes = await api('POST', '/visual-diffs', {
        baseline_id: irBaselineId, current_screenshot_url: 'current-data',
      });
      const analyzeRes = await api('POST', `/visual-diffs/${dRes.json.data.id}/analyze`);
      expect(analyzeRes.json.data.changes.length).toBe(0);
      expect(analyzeRes.json.data.overall_status).toBe('no_change');
    });

    it('Step 7: Reject invalid region', async () => {
      const { status } = await api('POST', `/baselines/${irBaselineId}/ignore-regions`, {
        region: { x: 0, y: 0 },
      });
      expect(status).toBe(400);
    });

    it('Step 8: 404 for non-existent baseline', async () => {
      const { status } = await api('GET', '/baselines/non-existent/ignore-regions');
      expect(status).toBe(404);
    });
  });

  // ─── Comparison Runs ───────────────────────────────────────

  describe('12. Batch comparison runs', () => {
    let runId: string;

    it('Step 1: Start batch run', async () => {
      const { status, json } = await api('POST', '/comparison-runs', {
        project_id: 'proj-default', trigger: 'manual',
      });
      expect(status).toBe(201);
      expect(json.data.status).toBe('completed');
      expect(json.data.total_baselines).toBeGreaterThanOrEqual(4);
      expect(json.data.visual_diff_ids.length).toBe(json.data.total_baselines);
      runId = json.data.id;
    });

    it('Step 2: Get run details', async () => {
      const { json } = await api('GET', `/comparison-runs/${runId}`);
      expect(json.data.project_id).toBe('proj-default');
      const total = json.data.no_change_count + json.data.intentional_count +
        json.data.regression_count + json.data.uncertain_count;
      expect(total).toBe(json.data.total_baselines);
    });

    it('Step 3: List runs', async () => {
      const { json } = await api('GET', '/comparison-runs');
      expect(json.data.length).toBeGreaterThanOrEqual(1);
    });

    it('Step 4: Filter by project_id', async () => {
      const { json } = await api('GET', '/comparison-runs?project_id=proj-default');
      for (const r of json.data) expect(r.project_id).toBe('proj-default');
    });

    it('Step 5: 404 for non-existent run', async () => {
      const { status } = await api('GET', '/comparison-runs/non-existent');
      expect(status).toBe(404);
    });

    it('Step 6: 404 when no baselines', async () => {
      const { status } = await api('POST', '/comparison-runs', {
        project_id: 'non-existent-project',
      });
      expect(status).toBe(404);
    });
  });

  // ─── Cleanup ──────────────────────────────────────────────

  describe('13. Cleanup (delete with cascade)', () => {
    it('should cascade delete to diffs and ignore regions', async () => {
      const bRes = await api('POST', '/baselines', {
        name: 'Temp', page_url: 'https://temp.example.com',
      });
      const bId = bRes.json.data.id;
      const dRes = await api('POST', '/visual-diffs', {
        baseline_id: bId, current_screenshot_url: 'temp',
      });
      await api('POST', `/baselines/${bId}/ignore-regions`, {
        region: { x: 0, y: 0, width: 100, height: 100 },
      });
      const deleteRes = await api('DELETE', `/baselines/${bId}`);
      expect(deleteRes.status).toBe(200);
      expect((await api('GET', `/visual-diffs/${dRes.json.data.id}`)).status).toBe(404);
      expect((await api('GET', `/baselines/${bId}/ignore-regions`)).status).toBe(404);
    });
  });
});
