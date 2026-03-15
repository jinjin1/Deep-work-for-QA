import { test, expect } from '@playwright/test';
import { createBugReportViaAPI } from './helpers';

test.describe('Bug Report Detail Page', () => {
  test('displays all bug report fields', async ({ page }) => {
    const bugReport = await createBugReportViaAPI({
      title: 'E2E Detail: 전체 필드 표시',
      severity: 'critical',
      description: '이 버그는 결제 페이지에서 발생합니다.',
    });

    await page.goto(`/bug-reports/${bugReport.id}`);

    // Title
    await expect(page.locator('h2', { hasText: 'E2E Detail: 전체 필드 표시' })).toBeVisible();

    // Severity and status displayed in header
    await expect(page.locator('header span', { hasText: 'critical' })).toBeVisible();
    await expect(page.locator('header span', { hasText: 'open' })).toBeVisible();

    // Page URL
    await expect(page.locator('text=https://example.com/test-page')).toBeVisible();

    // Back link
    await expect(page.locator('text=목록으로')).toBeVisible();
  });

  test('shows environment info', async ({ page }) => {
    const bugReport = await createBugReportViaAPI({ title: 'E2E Detail: 환경 정보' });

    await page.goto(`/bug-reports/${bugReport.id}`);

    await expect(page.getByRole('heading', { name: '환경 정보', exact: true })).toBeVisible();
    await expect(page.locator('text=Chrome 120')).toBeVisible();
    await expect(page.locator('text=macOS')).toBeVisible();
  });

  test('console logs toggle works', async ({ page }) => {
    const bugReport = await createBugReportViaAPI({
      title: 'E2E Detail: 콘솔 로그 토글',
      console_logs: [
        { level: 'error', message: 'Test error message', timestamp: 100 },
        { level: 'warn', message: 'Test warning message', timestamp: 200 },
        { level: 'log', message: 'Test log message', timestamp: 300 },
      ],
    });

    await page.goto(`/bug-reports/${bugReport.id}`);

    // Console logs should be collapsed by default
    await expect(page.locator('text=Test error message')).not.toBeVisible();

    // Click to expand
    await page.locator('button', { hasText: '콘솔 로그' }).click();

    // Now logs should be visible
    await expect(page.locator('text=Test error message')).toBeVisible();
    await expect(page.locator('text=Test warning message')).toBeVisible();
    await expect(page.locator('text=Test log message')).toBeVisible();

    // Click to collapse
    await page.locator('button', { hasText: '콘솔 로그' }).click();
    await expect(page.locator('text=Test error message')).not.toBeVisible();
  });

  test('network logs toggle and filtering works', async ({ page }) => {
    const bugReport = await createBugReportViaAPI({
      title: 'E2E Detail: 네트워크 로그',
      network_logs: [
        { method: 'GET', url: 'https://api.example.com/data', status: 200, duration: 100, type: 'fetch' },
        { method: 'POST', url: 'https://api.example.com/error', status: 500, duration: 2000, type: 'xhr' },
        { method: 'GET', url: 'https://cdn.example.com/style.css', status: 200, duration: 50, type: 'css' },
      ],
    });

    await page.goto(`/bug-reports/${bugReport.id}`);

    // Network logs collapsed by default
    await expect(page.locator('text=https://api.example.com/error')).not.toBeVisible();

    // Expand network logs
    await page.locator('button', { hasText: '네트워크 로그' }).click();

    // Important logs (fetch/xhr and failed requests) should be visible
    await expect(page.locator('text=https://api.example.com/data')).toBeVisible();
    await expect(page.locator('text=https://api.example.com/error')).toBeVisible();

    // Failed request should show error status
    await expect(page.locator('text=500')).toBeVisible();
  });

  test('status change buttons work', async ({ page }) => {
    const bugReport = await createBugReportViaAPI({ title: 'E2E Detail: 상태 변경' });

    await page.goto(`/bug-reports/${bugReport.id}`);

    // Initial status is "open" — the Open button should be active
    const openBtn = page.locator('button', { hasText: 'Open' });
    await expect(openBtn).toBeDisabled();

    // Click "In Progress"
    await page.locator('button', { hasText: 'In Progress' }).click();
    await expect(page.locator('button', { hasText: 'In Progress' })).toBeDisabled();

    // Click "Resolved"
    await page.locator('button', { hasText: 'Resolved' }).click();
    await expect(page.locator('button', { hasText: 'Resolved' })).toBeDisabled();

    // Click "Closed"
    await page.locator('button', { hasText: 'Closed' }).click();
    await expect(page.locator('button', { hasText: 'Closed' })).toBeDisabled();
  });

  test('back navigation works', async ({ page }) => {
    const bugReport = await createBugReportViaAPI({ title: 'E2E Detail: 뒤로가기' });

    await page.goto(`/bug-reports/${bugReport.id}`);
    await page.locator('text=목록으로').click();

    await expect(page).toHaveURL('/bug-reports');
  });

  test('shows 404 for non-existent bug report', async ({ page }) => {
    await page.goto('/bug-reports/non-existent-id');

    // The page should show an error — either from API error message or fallback
    await expect(
      page.locator('text=찾을 수 없습니다')
        .or(page.locator('text=Bug report not found'))
        .or(page.locator('text=API 요청 실패'))
    ).toBeVisible({ timeout: 10000 });
  });
});
