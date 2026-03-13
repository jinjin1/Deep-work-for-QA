import { describe, it, expect, beforeAll } from 'vitest';
import { app } from '../app';

// Helper to make requests against Hono app
async function api(method: string, path: string, body?: any) {
  const opts: RequestInit = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const res = await app.request(`/v1${path}`, opts);
  const json = await res.json();
  return { status: res.status, json };
}

describe('UC-3 API Integration Tests', () => {
  let baselineId: string;
  let visualDiffId: string;

  // ─── Baselines CRUD ───────────────────────────────────────────

  describe('POST /v1/baselines', () => {
    it('should create a new baseline', async () => {
      const { status, json } = await api('POST', '/baselines', {
        name: '홈페이지 - Desktop',
        page_url: 'https://app.example.com/',
        viewport: { width: 1440, height: 900 },
        screenshot_url: 'data:image/png;base64,iVBORw0KGgoAAAANS...',
      });
      expect(status).toBe(201);
      expect(json.data.id).toBeTruthy();
      baselineId = json.data.id;
    });

    it('should create a baseline with default viewport', async () => {
      const { status, json } = await api('POST', '/baselines', {
        name: '로그인 페이지 - Mobile',
        page_url: 'https://app.example.com/login',
      });
      expect(status).toBe(201);
      expect(json.data.id).toBeTruthy();
    });
  });

  describe('GET /v1/baselines', () => {
    it('should list all baselines', async () => {
      const { status, json } = await api('GET', '/baselines');
      expect(status).toBe(200);
      expect(Array.isArray(json.data)).toBe(true);
      expect(json.data.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('GET /v1/baselines/:id', () => {
    it('should return a specific baseline', async () => {
      const { status, json } = await api('GET', `/baselines/${baselineId}`);
      expect(status).toBe(200);
      expect(json.data.id).toBe(baselineId);
      expect(json.data.name).toBe('홈페이지 - Desktop');
      expect(json.data.page_url).toBe('https://app.example.com/');
      expect(json.data.viewport).toEqual({ width: 1440, height: 900 });
    });

    it('should return 404 for non-existent baseline', async () => {
      const { status, json } = await api('GET', '/baselines/non-existent');
      expect(status).toBe(404);
      expect(json.error).toBeDefined();
    });
  });

  describe('PUT /v1/baselines/:id', () => {
    it('should update baseline name', async () => {
      const { status, json } = await api('PUT', `/baselines/${baselineId}`, {
        name: '홈페이지 - Desktop (Updated)',
      });
      expect(status).toBe(200);
      expect(json.data.updated).toBe(true);
    });

    it('should update baseline screenshot (baseline update flow)', async () => {
      const { status, json } = await api('PUT', `/baselines/${baselineId}`, {
        screenshot_url: 'data:image/png;base64,newScreenshotData...',
      });
      expect(status).toBe(200);
      expect(json.data.updated).toBe(true);
    });

    it('should return 404 for updating non-existent baseline', async () => {
      const { status } = await api('PUT', '/baselines/non-existent', {
        name: 'test',
      });
      expect(status).toBe(404);
    });
  });

  // ─── Visual Diffs ─────────────────────────────────────────────

  describe('POST /v1/visual-diffs', () => {
    it('should create a visual diff comparison', async () => {
      const { status, json } = await api('POST', '/visual-diffs', {
        baseline_id: baselineId,
        current_screenshot_url: 'data:image/png;base64,currentScreenshot...',
      });
      expect(status).toBe(201);
      expect(json.data.id).toBeTruthy();
      expect(json.data.ai_analysis_status).toBe('pending');
      visualDiffId = json.data.id;
    });

    it('should return 404 if baseline does not exist', async () => {
      const { status, json } = await api('POST', '/visual-diffs', {
        baseline_id: 'non-existent-baseline',
        current_screenshot_url: 'data:image/png;base64,test...',
      });
      expect(status).toBe(404);
    });
  });

  describe('GET /v1/visual-diffs/:id', () => {
    it('should return visual diff details', async () => {
      const { status, json } = await api('GET', `/visual-diffs/${visualDiffId}`);
      expect(status).toBe(200);
      expect(json.data.id).toBe(visualDiffId);
      expect(json.data.baseline_id).toBe(baselineId);
      expect(Array.isArray(json.data.changes)).toBe(true);
    });

    it('should return 404 for non-existent visual diff', async () => {
      const { status } = await api('GET', '/visual-diffs/non-existent');
      expect(status).toBe(404);
    });
  });

  // ─── AI Analysis Trigger ──────────────────────────────────────

  describe('POST /v1/visual-diffs/:id/analyze', () => {
    it('should trigger mock AI analysis on a visual diff', async () => {
      const { status, json } = await api('POST', `/visual-diffs/${visualDiffId}/analyze`);
      expect(status).toBe(200);
      expect(json.data.ai_analysis_status).toBe('completed');
      expect(json.data.overall_status).toBeDefined();
      expect(Array.isArray(json.data.changes)).toBe(true);
      expect(json.data.summary).toBeTruthy();
    });

    it('should return 404 for non-existent visual diff', async () => {
      const { status } = await api('POST', '/visual-diffs/non-existent/analyze');
      expect(status).toBe(404);
    });
  });

  // ─── Approve (Baseline Update) ────────────────────────────────

  describe('POST /v1/visual-diffs/:id/approve', () => {
    it('should approve changes and update baseline screenshot', async () => {
      const { status, json } = await api('POST', `/visual-diffs/${visualDiffId}/approve`);
      expect(status).toBe(200);
      expect(json.data.baseline_updated).toBe(true);
    });

    it('should return 404 for non-existent visual diff', async () => {
      const { status } = await api('POST', '/visual-diffs/non-existent/approve');
      expect(status).toBe(404);
    });
  });

  // ─── Bug Report Creation from Regression ──────────────────────

  describe('POST /v1/visual-diffs/:id/bug-report', () => {
    it('should create a bug report from a visual diff', async () => {
      const { status, json } = await api('POST', `/visual-diffs/${visualDiffId}/bug-report`, {
        title: '네비게이션 레이아웃 회귀',
        severity: 'major',
      });
      expect(status).toBe(201);
      expect(json.data.id).toBeTruthy();
      expect(json.data.visual_diff_id).toBe(visualDiffId);
    });

    it('should return 404 for non-existent visual diff', async () => {
      const { status } = await api('POST', '/visual-diffs/non-existent/bug-report', {
        title: 'test',
      });
      expect(status).toBe(404);
    });
  });

  // ─── Comparison History ───────────────────────────────────────

  describe('GET /v1/visual-diffs (list)', () => {
    it('should list visual diffs with filtering', async () => {
      const { status, json } = await api('GET', '/visual-diffs');
      expect(status).toBe(200);
      expect(Array.isArray(json.data)).toBe(true);
    });

    it('should filter by baseline_id', async () => {
      const { status, json } = await api('GET', `/visual-diffs?baseline_id=${baselineId}`);
      expect(status).toBe(200);
      expect(Array.isArray(json.data)).toBe(true);
      for (const diff of json.data) {
        expect(diff.baseline_id).toBe(baselineId);
      }
    });

    it('should filter by status', async () => {
      const { status, json } = await api('GET', '/visual-diffs?status=no_change');
      expect(status).toBe(200);
      expect(Array.isArray(json.data)).toBe(true);
    });
  });

  // ─── Cleanup ──────────────────────────────────────────────────

  describe('DELETE /v1/baselines/:id', () => {
    it('should delete a baseline and its visual diffs', async () => {
      // Create a new baseline to delete
      const { json: createJson } = await api('POST', '/baselines', {
        name: 'To Delete',
        page_url: 'https://example.com/delete-me',
      });
      const deleteId = createJson.data.id;

      const { status, json } = await api('DELETE', `/baselines/${deleteId}`);
      expect(status).toBe(200);
      expect(json.data.deleted).toBe(true);
    });
  });

  describe('DELETE /v1/visual-diffs/:id', () => {
    it('should delete a visual diff', async () => {
      const { status, json } = await api('DELETE', `/visual-diffs/${visualDiffId}`);
      expect(status).toBe(200);
      expect(json.data.deleted).toBe(true);
    });
  });
});
