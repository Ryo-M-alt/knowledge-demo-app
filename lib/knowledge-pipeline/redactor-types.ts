export type RedactorEntityDTO = {
  id: string;
  start: number;
  end: number;
  text: string | null;
  label: string;
  source: string;
  confidence: number;
};

export type RedactorStageResultDTO = {
  entities: RedactorEntityDTO[];
  masked_text: string | null;
};

export type RedactorAuditDTO = {
  entity_counts: Record<string, number>;
  stage1_count: number;
  stage2_additional_count: number;
  processing_ms: number;
};

export type RedactorResponse = {
  session_id: string;
  status: string;
  final_text: string | null;
  stage1: RedactorStageResultDTO | null;
  stage2: RedactorStageResultDTO | null;
  audit: RedactorAuditDTO | null;
};

export type RedactorArchiveEntitySpan = {
  id: string;
  start: number;
  end: number;
  label: string;
  source: string;
  confidence: number;
  stage: number;
};

export type RedactorArchiveDetail = {
  session_id: string;
  final_text: string;
  audit: RedactorAuditDTO;
  entity_spans: RedactorArchiveEntitySpan[];
  draft_id: string | null;
  knowledge_id: string | null;
};

export type RedactorSessionLinks = {
  session_id: string;
  draft_id: string | null;
  knowledge_id: string | null;
};
