export interface Baseline {
  id: string;
  project_id: string;
  name: string;
  page_url: string;
  viewport: { width: number; height: number };
  screenshot_url: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export type VisualChangeType =
  | 'layout_shift'
  | 'text_change'
  | 'color_change'
  | 'element_missing'
  | 'element_added'
  | 'size_change'
  | 'other';

export interface VisualChange {
  id: string;
  visual_diff_id: string;
  region: { x: number; y: number; width: number; height: number };
  type: VisualChangeType;
  classification: 'intentional' | 'regression' | 'uncertain';
  confidence: number;
  description: string;
  bug_report_id?: string;
}

export interface VisualDiff {
  id: string;
  baseline_id: string;
  project_id: string;
  current_screenshot_url: string;
  diff_image_url: string;
  changes: VisualChange[];
  overall_status: 'no_change' | 'intentional' | 'regression' | 'mixed';
  ai_analysis_status: 'pending' | 'processing' | 'completed' | 'failed';
  created_by: string;
  created_at: string;
}
