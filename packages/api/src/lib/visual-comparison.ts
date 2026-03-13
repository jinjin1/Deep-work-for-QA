import { v4 as uuid } from 'uuid';

// ─── Types ──────────────────────────────────────────────────────

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PixelDiffResult {
  diffCount: number;
  diffPercentage: number;
  changedPixels: { x: number; y: number }[];
}

export type VisualChangeType =
  | 'layout_shift'
  | 'text_change'
  | 'color_change'
  | 'element_missing'
  | 'element_added'
  | 'size_change'
  | 'other';

export type ChangeClassification = 'intentional' | 'regression' | 'uncertain';

export interface VisualChangeResult {
  id: string;
  region: BoundingBox;
  type: VisualChangeType;
  classification: ChangeClassification;
  confidence: number;
  description: string;
  bug_report_id?: string;
}

export interface VisualAnalysisResult {
  changes: VisualChangeResult[];
  overall_status: 'no_change' | 'intentional' | 'regression' | 'mixed';
  summary: string;
}

// ─── Stage 1: Pixel Comparison ──────────────────────────────────

/**
 * Compute pixel-level differences between two RGBA image buffers.
 *
 * @param baseline RGBA pixel data (Uint8Array of length width*height*4)
 * @param current  RGBA pixel data (same dimensions)
 * @param width    Image width in pixels
 * @param height   Image height in pixels
 * @param threshold Color difference threshold (0-1). Default 0.1 (10%)
 * @param ignoreRegions Regions to exclude from comparison
 */
export function computePixelDiff(
  baseline: Uint8Array,
  current: Uint8Array,
  width: number,
  height: number,
  threshold = 0.1,
  ignoreRegions: BoundingBox[] = [],
): PixelDiffResult {
  const totalPixels = width * height;
  const changedPixels: { x: number; y: number }[] = [];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // Check if pixel is inside an ignore region
      if (isInIgnoreRegion(x, y, ignoreRegions)) continue;

      const idx = (y * width + x) * 4;
      const dr = Math.abs(baseline[idx] - current[idx]);
      const dg = Math.abs(baseline[idx + 1] - current[idx + 1]);
      const db = Math.abs(baseline[idx + 2] - current[idx + 2]);

      // Normalized max channel difference
      const maxDiff = Math.max(dr, dg, db) / 255;

      if (maxDiff > threshold) {
        changedPixels.push({ x, y });
      }
    }
  }

  return {
    diffCount: changedPixels.length,
    diffPercentage: totalPixels > 0 ? (changedPixels.length / totalPixels) * 100 : 0,
    changedPixels,
  };
}

function isInIgnoreRegion(px: number, py: number, regions: BoundingBox[]): boolean {
  for (const r of regions) {
    if (px >= r.x && px < r.x + r.width && py >= r.y && py < r.y + r.height) {
      return true;
    }
  }
  return false;
}

// ─── Stage 1: Clustering ────────────────────────────────────────

/**
 * Cluster changed pixels into bounding boxes using simple grid-based grouping.
 *
 * @param pixels List of changed pixel coordinates
 * @param padding Padding to add around each cluster bounding box (default 5px)
 * @param minArea Minimum area in px^2 for a cluster to be kept (default 4)
 */
export function clusterChangedPixels(
  pixels: { x: number; y: number }[],
  padding = 5,
  minArea = 4,
): BoundingBox[] {
  if (pixels.length === 0) return [];

  // Union-Find based clustering with proximity threshold
  const proximityThreshold = 20; // pixels within 20px are grouped
  const clusters: { x: number; y: number }[][] = [];

  for (const pixel of pixels) {
    let merged = false;
    for (const cluster of clusters) {
      // Check if this pixel is close to any pixel in the cluster
      for (const cp of cluster) {
        if (
          Math.abs(pixel.x - cp.x) <= proximityThreshold &&
          Math.abs(pixel.y - cp.y) <= proximityThreshold
        ) {
          cluster.push(pixel);
          merged = true;
          break;
        }
      }
      if (merged) break;
    }
    if (!merged) {
      clusters.push([pixel]);
    }
  }

  // Merge overlapping clusters
  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 0; i < clusters.length; i++) {
      for (let j = i + 1; j < clusters.length; j++) {
        if (clustersOverlap(clusters[i], clusters[j], proximityThreshold)) {
          clusters[i] = clusters[i].concat(clusters[j]);
          clusters.splice(j, 1);
          changed = true;
          break;
        }
      }
      if (changed) break;
    }
  }

  // Convert clusters to bounding boxes
  const boxes: BoundingBox[] = [];
  for (const cluster of clusters) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of cluster) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }

    const width = maxX - minX + 1;
    const height = maxY - minY + 1;
    const area = width * height;

    if (area < minArea) continue;

    boxes.push({
      x: Math.max(0, minX - padding),
      y: Math.max(0, minY - padding),
      width: width + padding * 2,
      height: height + padding * 2,
    });
  }

  return boxes;
}

function clustersOverlap(
  a: { x: number; y: number }[],
  b: { x: number; y: number }[],
  threshold: number,
): boolean {
  for (const pa of a) {
    for (const pb of b) {
      if (
        Math.abs(pa.x - pb.x) <= threshold &&
        Math.abs(pa.y - pb.y) <= threshold
      ) {
        return true;
      }
    }
  }
  return false;
}

// ─── Stage 2: Mock AI Visual Analysis ───────────────────────────

const CHANGE_TYPES: VisualChangeType[] = [
  'layout_shift', 'text_change', 'color_change',
  'element_missing', 'element_added', 'size_change', 'other',
];

const DESCRIPTIONS: Record<VisualChangeType, string[]> = {
  layout_shift: [
    '요소의 위치가 이동했습니다. 레이아웃 변경으로 인한 사이드이펙트일 수 있습니다.',
    '컨테이너 내부 요소의 정렬이 변경되었습니다.',
    '플렉스/그리드 레이아웃에서 요소 배치가 달라졌습니다.',
  ],
  text_change: [
    '텍스트 내용이 변경되었습니다. 컨텐츠 업데이트로 보입니다.',
    '헤딩 또는 본문 텍스트가 수정되었습니다.',
    '버튼/라벨의 텍스트가 업데이트되었습니다.',
  ],
  color_change: [
    '배경색 또는 전경색이 변경되었습니다.',
    '색상 테마가 업데이트된 것으로 보입니다.',
    '호버/활성 상태의 색상이 달라졌습니다.',
  ],
  element_missing: [
    '이전에 있던 UI 요소가 사라졌습니다.',
    '컴포넌트가 렌더링되지 않고 있습니다.',
    '섹션이 제거된 것으로 보입니다.',
  ],
  element_added: [
    '새로운 UI 요소가 추가되었습니다.',
    '이전에 없던 컴포넌트가 나타났습니다.',
    '새로운 기능 관련 요소가 추가된 것으로 보입니다.',
  ],
  size_change: [
    '요소의 크기(너비 또는 높이)가 변경되었습니다.',
    '컨테이너의 dimensions가 달라졌습니다.',
    '이미지나 미디어 요소의 크기가 변경되었습니다.',
  ],
  other: [
    '기타 시각적 변경이 감지되었습니다.',
    '분류하기 어려운 변경사항입니다. 수동 확인이 권장됩니다.',
  ],
};

/**
 * Generate mock AI visual analysis for detected diff regions.
 * In production, this would call Claude Vision API.
 */
export function generateMockVisualAnalysis(
  diffRegions: BoundingBox[],
  pageUrl: string,
): VisualAnalysisResult {
  if (diffRegions.length === 0) {
    return {
      changes: [],
      overall_status: 'no_change',
      summary: '시각적 변경이 감지되지 않았습니다.',
    };
  }

  const changes: VisualChangeResult[] = diffRegions.map((region, index) => {
    const type = inferChangeType(region, index);
    const classification = inferClassification(type, region);
    const confidence = 0.65 + Math.random() * 0.3; // 0.65 ~ 0.95
    const descriptions = DESCRIPTIONS[type];
    const description = descriptions[index % descriptions.length];

    return {
      id: uuid(),
      region,
      type,
      classification,
      confidence: Math.round(confidence * 100) / 100,
      description,
    };
  });

  const overall_status = classifyOverallStatus(changes);

  const regressionCount = changes.filter((c) => c.classification === 'regression').length;
  const intentionalCount = changes.filter((c) => c.classification === 'intentional').length;
  const uncertainCount = changes.filter((c) => c.classification === 'uncertain').length;

  const parts: string[] = [`${changes.length}건의 변경 감지`];
  if (regressionCount > 0) parts.push(`회귀 ${regressionCount}건`);
  if (intentionalCount > 0) parts.push(`의도적 변경 ${intentionalCount}건`);
  if (uncertainCount > 0) parts.push(`확인 필요 ${uncertainCount}건`);

  return {
    changes,
    overall_status,
    summary: parts.join(', ') + '.',
  };
}

function inferChangeType(region: BoundingBox, index: number): VisualChangeType {
  // Simple heuristic based on region position and size
  if (region.y < 80 && region.width > 500) return 'layout_shift'; // top nav area
  if (region.height < 30 && region.width > 100) return 'text_change'; // thin horizontal = text
  if (region.width < 50 && region.height < 50) return 'color_change'; // small = color dot
  // Cycle through types for variety in mock data
  const types: VisualChangeType[] = ['text_change', 'layout_shift', 'size_change', 'element_added', 'color_change'];
  return types[index % types.length];
}

function inferClassification(type: VisualChangeType, region: BoundingBox): ChangeClassification {
  // Mock heuristic: layout issues tend to be regressions, text changes tend to be intentional
  switch (type) {
    case 'layout_shift':
    case 'element_missing':
      return 'regression';
    case 'text_change':
    case 'element_added':
    case 'color_change':
      return 'intentional';
    case 'size_change':
      return 'uncertain';
    default:
      return 'uncertain';
  }
}

/**
 * Determine overall status from a list of change classifications.
 */
export function classifyOverallStatus(
  changes: { classification: ChangeClassification }[],
): 'no_change' | 'intentional' | 'regression' | 'mixed' {
  if (changes.length === 0) return 'no_change';

  const hasRegression = changes.some((c) => c.classification === 'regression');
  const hasIntentional = changes.some((c) => c.classification === 'intentional');
  const hasUncertain = changes.some((c) => c.classification === 'uncertain');

  if (hasRegression && (hasIntentional || hasUncertain)) return 'mixed';
  if (hasRegression) return 'regression';
  if (hasIntentional && hasUncertain) return 'mixed';
  if (hasIntentional) return 'intentional';
  // Only uncertain
  return 'mixed';
}

// ─── Full Pipeline ──────────────────────────────────────────────

/**
 * Run the full visual comparison pipeline.
 * Takes raw RGBA image data and returns analysis results.
 */
export function runVisualComparison(
  baselineData: Uint8Array,
  currentData: Uint8Array,
  width: number,
  height: number,
  pageUrl: string,
  ignoreRegions: BoundingBox[] = [],
  threshold = 0.1,
): VisualAnalysisResult & { diffPixelCount: number; diffPercentage: number } {
  // Stage 1: Pixel diff
  const pixelDiff = computePixelDiff(baselineData, currentData, width, height, threshold, ignoreRegions);

  // Stage 1: Clustering
  const clusters = clusterChangedPixels(pixelDiff.changedPixels);

  // Stage 2: Mock AI analysis
  const analysis = generateMockVisualAnalysis(clusters, pageUrl);

  return {
    ...analysis,
    diffPixelCount: pixelDiff.diffCount,
    diffPercentage: pixelDiff.diffPercentage,
  };
}
