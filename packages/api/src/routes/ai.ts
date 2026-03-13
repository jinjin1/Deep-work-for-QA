import { Hono } from 'hono';
import { v4 as uuid } from 'uuid';

export const aiRoutes = new Hono();

interface EventTarget {
  tag?: string;
  id?: string;
  className?: string;
  textContent?: string;
}

interface BugReportEvent {
  type: string;
  target?: string | EventTarget;
  tagName?: string;
  text?: string;
  value?: string;
  selector?: string;
  url?: string;
  timestamp?: number;
  [key: string]: unknown;
}

interface ReproStep {
  step_number: number;
  action: string;
  target: string;
  description: string;
}

/** Extract a human-readable label from an event target (string or object). */
function resolveTargetLabel(event: BugReportEvent): string {
  // Direct string properties take priority
  if (event.text) return event.text;
  if (event.selector) return event.selector;

  // Handle object target (from extension capture)
  if (event.target && typeof event.target === 'object') {
    const t = event.target as EventTarget;
    // Prefer textContent > id > className > tag
    if (t.textContent?.trim()) return `${t.tag || 'element'} "${t.textContent.trim()}"`;
    if (t.id) return `${t.tag || 'element'}#${t.id}`;
    if (t.className) return `${t.tag || 'element'}.${t.className.split(' ')[0]}`;
    if (t.tag) return t.tag;
  }

  // Plain string target
  if (typeof event.target === 'string') return event.target;

  return event.tagName || 'element';
}

/**
 * Generate mock reproduction steps from an array of recorded events.
 * This will later be replaced with actual Claude API calls.
 */
export function generateMockReproSteps(events: BugReportEvent[]): {
  steps: ReproStep[];
  summary: string;
} {
  if (!events || events.length === 0) {
    return {
      steps: [
        {
          step_number: 1,
          action: 'navigate',
          target: 'page',
          description: 'Navigate to the page where the issue occurs.',
        },
      ],
      summary: 'No recorded events were provided. Manual reproduction steps are needed.',
    };
  }

  const steps: ReproStep[] = [];
  let stepNumber = 1;

  for (const event of events) {
    const targetLabel = resolveTargetLabel(event);

    switch (event.type) {
      case 'click':
        steps.push({
          step_number: stepNumber++,
          action: 'click',
          target: targetLabel,
          description: `Click on the '${targetLabel}'${event.tagName ? ` (${event.tagName})` : ''}.`,
        });
        break;

      case 'input':
      case 'change':
        steps.push({
          step_number: stepNumber++,
          action: 'input',
          target: targetLabel,
          description: `Enter '${event.value || '(value)'}' into the '${targetLabel}' field.`,
        });
        break;

      case 'navigate':
      case 'navigation':
      case 'pageview':
        steps.push({
          step_number: stepNumber++,
          action: 'navigate',
          target: event.url || targetLabel,
          description: `Navigate to ${event.url || targetLabel}.`,
        });
        break;

      case 'scroll':
        steps.push({
          step_number: stepNumber++,
          action: 'scroll',
          target: targetLabel,
          description: `Scroll on the page${targetLabel !== 'element' ? ` near '${targetLabel}'` : ''}.`,
        });
        break;

      case 'keypress':
      case 'keydown':
        steps.push({
          step_number: stepNumber++,
          action: 'keypress',
          target: targetLabel,
          description: `Press '${event.value || event.text || 'key'}' on '${targetLabel}'.`,
        });
        break;

      case 'submit':
        steps.push({
          step_number: stepNumber++,
          action: 'submit',
          target: targetLabel,
          description: `Submit the form '${targetLabel}'.`,
        });
        break;

      case 'hover':
      case 'mouseover':
        steps.push({
          step_number: stepNumber++,
          action: 'hover',
          target: targetLabel,
          description: `Hover over '${targetLabel}'.`,
        });
        break;

      case 'error':
      case 'console_error':
        steps.push({
          step_number: stepNumber++,
          action: 'observe',
          target: 'console',
          description: `Observe error: ${event.text || event.value || 'An error occurred'}.`,
        });
        break;

      default:
        steps.push({
          step_number: stepNumber++,
          action: event.type,
          target: targetLabel,
          description: `Perform '${event.type}' on '${targetLabel}'.`,
        });
        break;
    }
  }

  const actionTypes = [...new Set(events.map((e) => e.type))];
  const summary = `Bug reproduction involves ${steps.length} step(s) including: ${actionTypes.join(', ')}. Follow the steps sequentially to reproduce the reported issue.`;

  return { steps, summary };
}

// POST /v1/ai/repro-steps
aiRoutes.post('/repro-steps', async (c) => {
  const body = await c.req.json();
  const { events, console_logs, page_url, environment } = body;

  const result = generateMockReproSteps(events || []);

  return c.json({
    data: {
      ...result,
      page_url: page_url || null,
      environment: environment || null,
      console_log_count: Array.isArray(console_logs) ? console_logs.length : 0,
      generated_at: new Date().toISOString(),
      model: 'mock-v1',
    },
    meta: { request_id: uuid(), timestamp: new Date().toISOString() },
  });
});
