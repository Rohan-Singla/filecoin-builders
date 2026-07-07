export interface ThreatAssessment {
  isThreatening: boolean;
  type: string | null;
  description: string;
  recommendedAction: string;
}

export interface Analysis {
  platform: string;
  author: string;
  contentDate: string;
  summary: string;
  keyStatements: string[];
  contentType: string;
  severity: "low" | "medium" | "high";
  threatAssessment: ThreatAssessment;
}

export interface EvidenceResult {
  evidenceId: string;
  capturedAt: string;
  sourceUrl: string | null;
  fileName?: string;
  fileType?: string;
  fileSize?: number;
  screenshotCid?: string | null;
  analysis: Analysis;
  cid: string;
  gateways: string[];
  caseId?: string;
}

export interface Case {
  id: string;
  name: string;
  createdAt: string;
  evidenceIds: string[];
}
