import { test, expect } from '@playwright/test';
import { api, createBugReportViaAPI } from './helpers';

test.describe('Extension → API → Web: End-to-End Flow', () => {
  test('plugin creates a bug report and it appears on the web dashboard', async ({ page }) => {
    // 1. Simulate extension: create a bug report via API
    const bugReport = await createBugReportViaAPI({
      title: 'E2E: 로그인 버튼 깨짐',
      severity: 'critical',
    });
    expect(bugReport.id).toBeTruthy();

    // 2. Open dashboard and verify it shows up
    await page.goto('/');
    await expect(page.locator('text=E2E: 로그인 버튼 깨짐')).toBeVisible({ timeout: 15000 });

    // 3. Verify severity indicator (critical shows red dot)
    const row = page.locator('tr', { hasText: 'E2E: 로그인 버튼 깨짐' });
    await expect(row.locator('text=Critical')).toBeVisible();
  });

  test('plugin creates multiple bug reports with different severities', async ({ page }) => {
    const reports = await Promise.all([
      createBugReportViaAPI({ title: 'E2E: Critical 버그', severity: 'critical' }),
      createBugReportViaAPI({ title: 'E2E: Minor 버그', severity: 'minor' }),
      createBugReportViaAPI({ title: 'E2E: Trivial 버그', severity: 'trivial' }),
    ]);

    await page.goto('/');

    // All reports should appear
    for (const r of reports) {
      await expect(page.locator(`text=${r.title}`)).toBeVisible({ timeout: 15000 });
    }

    // Stats should reflect new critical bugs
    const criticalAlert = page.locator('text=Critical 버그');
    await expect(criticalAlert.first()).toBeVisible();
  });

  test('clicking a bug report navigates to detail page', async ({ page }) => {
    const bugReport = await createBugReportViaAPI({
      title: 'E2E: 네비게이션 테스트',
      severity: 'major',
    });

    await page.goto('/');
    await page.locator('tr', { hasText: 'E2E: 네비게이션 테스트' }).click();

    // Should navigate to detail page
    await expect(page).toHaveURL(`/bug-reports/${bugReport.id}`);
    await expect(page.locator('h2', { hasText: 'E2E: 네비게이션 테스트' })).toBeVisible();
  });

  test('full flow: create via plugin → view detail → update status → verify on list', async ({ page }) => {
    // 1. Create bug via API (simulating extension)
    const bugReport = await createBugReportViaAPI({
      title: 'E2E: 풀 플로우 테스트',
      severity: 'major',
      console_logs: [
        { level: 'error', message: 'ReferenceError: foo is not defined', timestamp: 500 },
        { level: 'warn', message: 'Performance warning', timestamp: 800 },
      ],
      network_logs: [
        { method: 'GET', url: 'https://api.example.com/users', status: 200, duration: 120, type: 'fetch' },
        { method: 'POST', url: 'https://api.example.com/save', status: 500, duration: 3000, type: 'xhr' },
      ],
    });

    // 2. Navigate to detail page
    await page.goto(`/bug-reports/${bugReport.id}`);
    await expect(page.locator('h2', { hasText: 'E2E: 풀 플로우 테스트' })).toBeVisible();

    // 3. Verify environment info
    await expect(page.locator('text=Chrome 120')).toBeVisible();

    // 4. Expand console logs and verify
    await page.locator('button', { hasText: '콘솔 로그' }).click();
    await expect(page.locator('text=ReferenceError: foo is not defined')).toBeVisible();
    await expect(page.locator('text=Performance warning')).toBeVisible();

    // 5. Expand network logs and verify
    await page.locator('button', { hasText: '네트워크 로그' }).click();
    await expect(page.locator('text=https://api.example.com/save')).toBeVisible();

    // 6. Update status to "In Progress"
    await page.locator('button', { hasText: 'In Progress' }).click();
    // Wait for status to update
    await expect(page.locator('button', { hasText: 'In Progress' })).toHaveClass(/bg-text-primary/);

    // 7. Go back to list and verify status
    await page.goto('/bug-reports');
    const row = page.locator('tr', { hasText: 'E2E: 풀 플로우 테스트' }).first();
    await expect(row).toBeVisible({ timeout: 10000 });
  });

  test('visual regression flow: create baseline → compare → create bug → see on web', async ({ page }) => {
    // 1. Create baseline (simulating extension/CI)
    const { json: baselineRes } = await api('POST', '/baselines', {
      name: 'E2E Baseline - Homepage',
      page_url: 'https://example.com',
      viewport: { width: 1920, height: 1080 },
      screenshot_url: 'data:image/png;base64,baseline-data',
    });
    const baselineId = baselineRes.data.id;

    // 2. Create visual diff
    const { json: diffRes } = await api('POST', '/visual-diffs', {
      baseline_id: baselineId,
      current_screenshot_url: 'data:image/png;base64,current-data',
    });
    const diffId = diffRes.data.id;

    // 3. Run analysis
    await api('POST', `/visual-diffs/${diffId}/analyze`);

    // 4. Create bug report from regression
    const { json: bugRes } = await api('POST', `/visual-diffs/${diffId}/bug-report`, {
      title: 'E2E: 시각적 회귀 - 홈페이지 레이아웃',
      severity: 'critical',
    });
    const bugId = bugRes.data.id;

    // 5. Verify on web dashboard
    await page.goto('/');
    await expect(page.locator('text=E2E: 시각적 회귀 - 홈페이지 레이아웃')).toBeVisible({ timeout: 15000 });

    // 6. Check detail page
    await page.goto(`/bug-reports/${bugId}`);
    await expect(page.locator('h2', { hasText: 'E2E: 시각적 회귀 - 홈페이지 레이아웃' })).toBeVisible();
  });
});
