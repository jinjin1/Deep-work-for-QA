import { describe, it, expect } from 'vitest';
import {
  computePixelDiff,
  clusterChangedPixels,
  generateMockVisualAnalysis,
  classifyOverallStatus,
  runVisualComparison,
  type PixelDiffResult,
  type BoundingBox,
  type VisualAnalysisResult,
} from './visual-comparison';

describe('Visual Comparison Engine', () => {
  // ─── Stage 1: Pixel Diff ─────────────────────────────────────

  describe('computePixelDiff', () => {
    it('should return no diff for identical images (same data)', () => {
      // 2x2 red image
      const data = new Uint8Array([
        255, 0, 0, 255, 255, 0, 0, 255,
        255, 0, 0, 255, 255, 0, 0, 255,
      ]);
      const result = computePixelDiff(data, data, 2, 2);
      expect(result.diffCount).toBe(0);
      expect(result.diffPercentage).toBe(0);
      expect(result.changedPixels).toEqual([]);
    });

    it('should detect pixel differences between two images', () => {
      // 2x2 images
      const baseline = new Uint8Array([
        255, 0, 0, 255, 0, 255, 0, 255,
        0, 0, 255, 255, 255, 255, 255, 255,
      ]);
      const current = new Uint8Array([
        255, 0, 0, 255, 0, 255, 0, 255,
        0, 0, 255, 255, 0, 0, 0, 255, // bottom-right pixel changed
      ]);
      const result = computePixelDiff(baseline, current, 2, 2);
      expect(result.diffCount).toBe(1);
      expect(result.diffPercentage).toBe(25); // 1/4 pixels
      expect(result.changedPixels).toContainEqual({ x: 1, y: 1 });
    });

    it('should respect threshold for minor color differences', () => {
      // Baseline: (100, 100, 100), Current: (105, 100, 100) - small diff
      const baseline = new Uint8Array([100, 100, 100, 255]);
      const current = new Uint8Array([105, 100, 100, 255]);

      // With high threshold (20%), should not flag as different
      const result = computePixelDiff(baseline, current, 1, 1, 0.2);
      expect(result.diffCount).toBe(0);

      // With low threshold (1%), should flag
      const result2 = computePixelDiff(baseline, current, 1, 1, 0.01);
      expect(result2.diffCount).toBe(1);
    });

    it('should handle ignore regions', () => {
      // 4x4 image with changes in a region we want to ignore
      const size = 4 * 4 * 4; // 4x4 pixels, RGBA
      const baseline = new Uint8Array(size).fill(100);
      const current = new Uint8Array(size).fill(100);

      // Change pixels at (2,2) and (3,3) - these are in the ignore region
      const idx22 = (2 * 4 + 2) * 4;
      current[idx22] = 200;
      const idx33 = (3 * 4 + 3) * 4;
      current[idx33] = 200;

      const ignoreRegions: BoundingBox[] = [{ x: 2, y: 2, width: 2, height: 2 }];
      const result = computePixelDiff(baseline, current, 4, 4, 0.1, ignoreRegions);
      expect(result.diffCount).toBe(0);
    });
  });

  // ─── Stage 1: Clustering ─────────────────────────────────────

  describe('clusterChangedPixels', () => {
    it('should return empty array for no changed pixels', () => {
      const result = clusterChangedPixels([]);
      expect(result).toEqual([]);
    });

    it('should group adjacent pixels into a single bounding box', () => {
      const pixels = [
        { x: 10, y: 10 },
        { x: 11, y: 10 },
        { x: 10, y: 11 },
        { x: 11, y: 11 },
      ];
      // padding=0, minArea=1 for raw clustering test
      const clusters = clusterChangedPixels(pixels, 0, 1);
      expect(clusters.length).toBe(1);
      expect(clusters[0]).toEqual({ x: 10, y: 10, width: 2, height: 2 });
    });

    it('should create separate clusters for distant pixel groups', () => {
      const pixels = [
        // Cluster 1: top-left
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        // Cluster 2: far away (beyond proximity threshold of 20px)
        { x: 100, y: 100 },
        { x: 101, y: 100 },
      ];
      const clusters = clusterChangedPixels(pixels, 0, 1);
      expect(clusters.length).toBe(2);
    });

    it('should filter out clusters smaller than minArea', () => {
      // Single pixel cluster
      const pixels = [{ x: 50, y: 50 }];
      const clusters = clusterChangedPixels(pixels, 10, 100);
      expect(clusters.length).toBe(0); // area=1 < minArea=100
    });

    it('should add padding to bounding boxes', () => {
      const pixels = [
        { x: 10, y: 10 },
        { x: 11, y: 10 },
      ];
      const clusters = clusterChangedPixels(pixels, 5, 1);
      // With 5px padding: x=5, y=5, width=12, height=6
      expect(clusters[0].x).toBe(5);
      expect(clusters[0].y).toBe(5);
    });
  });

  // ─── Stage 2: Mock AI Analysis ────────────────────────────────

  describe('generateMockVisualAnalysis', () => {
    it('should return no_change when there are no diff regions', () => {
      const result = generateMockVisualAnalysis([], 'https://example.com');
      expect(result.overall_status).toBe('no_change');
      expect(result.changes).toEqual([]);
      expect(result.summary).toContain('변경');
    });

    it('should classify changes for each diff region', () => {
      const regions: BoundingBox[] = [
        { x: 0, y: 0, width: 1440, height: 60 }, // nav-like region (top bar)
        { x: 200, y: 400, width: 600, height: 300 }, // content region
      ];
      const result = generateMockVisualAnalysis(regions, 'https://example.com');
      expect(result.changes.length).toBe(2);

      for (const change of result.changes) {
        expect(change.type).toBeDefined();
        expect(['layout_shift', 'text_change', 'color_change', 'element_missing', 'element_added', 'size_change', 'other']).toContain(change.type);
        expect(['intentional', 'regression', 'uncertain']).toContain(change.classification);
        expect(change.confidence).toBeGreaterThanOrEqual(0);
        expect(change.confidence).toBeLessThanOrEqual(1);
        expect(change.description).toBeTruthy();
        expect(change.region).toBeDefined();
      }
    });

    it('should include an id for each change', () => {
      const regions: BoundingBox[] = [{ x: 0, y: 0, width: 100, height: 100 }];
      const result = generateMockVisualAnalysis(regions, 'https://example.com');
      expect(result.changes[0].id).toBeTruthy();
    });

    it('should return a summary string', () => {
      const regions: BoundingBox[] = [{ x: 10, y: 10, width: 50, height: 50 }];
      const result = generateMockVisualAnalysis(regions, 'https://example.com');
      expect(typeof result.summary).toBe('string');
      expect(result.summary.length).toBeGreaterThan(0);
    });
  });

  // ─── Overall status classification ───────────────────────────

  describe('classifyOverallStatus', () => {
    it('should return no_change for empty changes', () => {
      expect(classifyOverallStatus([])).toBe('no_change');
    });

    it('should return intentional when all changes are intentional', () => {
      const changes = [
        { classification: 'intentional' as const },
        { classification: 'intentional' as const },
      ];
      expect(classifyOverallStatus(changes)).toBe('intentional');
    });

    it('should return regression when all changes are regression', () => {
      const changes = [
        { classification: 'regression' as const },
        { classification: 'regression' as const },
      ];
      expect(classifyOverallStatus(changes)).toBe('regression');
    });

    it('should return mixed when there are both intentional and regression changes', () => {
      const changes = [
        { classification: 'intentional' as const },
        { classification: 'regression' as const },
      ];
      expect(classifyOverallStatus(changes)).toBe('mixed');
    });

    it('should return regression when any regression exists mixed with uncertain', () => {
      const changes = [
        { classification: 'uncertain' as const },
        { classification: 'regression' as const },
      ];
      expect(classifyOverallStatus(changes)).toBe('mixed');
    });

    it('should return mixed when all changes are uncertain', () => {
      const changes = [
        { classification: 'uncertain' as const },
        { classification: 'uncertain' as const },
      ];
      expect(classifyOverallStatus(changes)).toBe('mixed');
    });

    it('should handle single change correctly', () => {
      expect(classifyOverallStatus([{ classification: 'regression' as const }])).toBe('regression');
      expect(classifyOverallStatus([{ classification: 'intentional' as const }])).toBe('intentional');
      expect(classifyOverallStatus([{ classification: 'uncertain' as const }])).toBe('mixed');
    });
  });

  // ─── Full Pipeline: runVisualComparison ─────────────────────

  describe('runVisualComparison', () => {
    it('should return no_change for identical images', () => {
      const data = new Uint8Array([
        255, 0, 0, 255, 255, 0, 0, 255,
        255, 0, 0, 255, 255, 0, 0, 255,
      ]);
      const result = runVisualComparison(data, data, 2, 2, 'https://example.com');
      expect(result.overall_status).toBe('no_change');
      expect(result.changes).toEqual([]);
      expect(result.diffPixelCount).toBe(0);
      expect(result.diffPercentage).toBe(0);
      expect(result.summary).toContain('변경');
    });

    it('should detect changes and produce full analysis for different images', () => {
      // 10x10 image - baseline all black, current has a 5x5 white block
      const size = 10 * 10 * 4;
      const baseline = new Uint8Array(size).fill(0);
      // Set alpha to 255
      for (let i = 3; i < size; i += 4) baseline[i] = 255;

      const current = new Uint8Array(baseline);
      // Make a 5x5 white block at (2,2)
      for (let y = 2; y < 7; y++) {
        for (let x = 2; x < 7; x++) {
          const idx = (y * 10 + x) * 4;
          current[idx] = 255;
          current[idx + 1] = 255;
          current[idx + 2] = 255;
        }
      }

      const result = runVisualComparison(baseline, current, 10, 10, 'https://example.com');
      expect(result.diffPixelCount).toBe(25); // 5x5 block
      expect(result.diffPercentage).toBe(25); // 25 out of 100 pixels
      expect(result.changes.length).toBeGreaterThan(0);
      expect(result.overall_status).not.toBe('no_change');
    });

    it('should respect ignore regions in full pipeline', () => {
      const size = 10 * 10 * 4;
      const baseline = new Uint8Array(size).fill(0);
      for (let i = 3; i < size; i += 4) baseline[i] = 255;

      const current = new Uint8Array(baseline);
      // Change all pixels in a 5x5 region at (0,0)
      for (let y = 0; y < 5; y++) {
        for (let x = 0; x < 5; x++) {
          const idx = (y * 10 + x) * 4;
          current[idx] = 255;
          current[idx + 1] = 255;
          current[idx + 2] = 255;
        }
      }

      const ignoreRegions: BoundingBox[] = [{ x: 0, y: 0, width: 5, height: 5 }];
      const result = runVisualComparison(baseline, current, 10, 10, 'https://example.com', ignoreRegions);
      expect(result.diffPixelCount).toBe(0);
      expect(result.overall_status).toBe('no_change');
    });
  });
});
