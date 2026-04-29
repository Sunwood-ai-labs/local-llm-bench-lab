export type Backend = "ollama" | "mlx_server" | "llamacpp";

export interface BenchPreset {
  id: string;
  backend: Backend;
  title: string;
  model: string;
  target: string;
  expectedGenerationTps: number;
  expectedPromptTps?: number;
  expectedMemoryGb?: number;
  expectedLatency?: string;
  maxTokens: number;
  numCtx?: number;
  llamaPromptTokens?: number;
  llamaHf?: string;
  flashAttention?: boolean;
  nGpuLayers?: number;
  note: string;
  tags: string[];
  heavy?: boolean;
}

export interface AppSettings {
  ollamaUrl: string;
  mlxUrl: string;
  mlxModel: string;
  llamaBenchPath: string;
  llamaHf: string;
  nGpuLayers: number;
  flashAttention: boolean;
}

export interface EnvironmentSettings {
  ollamaUrl: string;
  mlxUrl: string;
  llamaBenchPath: string;
}

export interface ToolCheck {
  available: boolean;
  detail: string;
}

export interface EnvironmentStatus {
  ollama: ToolCheck;
  mlxServer: ToolCheck;
  llamacpp: ToolCheck;
}

export interface RunRequest {
  backend: Backend;
  model: string;
  prompt: string;
  maxTokens: number;
  numCtx?: number;
  temperature: number;
  ollamaUrl: string;
  mlxUrl: string;
  mlxModel: string;
  llamaBenchPath: string;
  llamaHf: string;
  llamaPromptTokens?: number;
  nGpuLayers?: number;
  flashAttention: boolean;
}

export interface RunResult {
  backend: Backend;
  model: string;
  summary: string;
  responseText: string;
  promptTokens: number;
  outputTokens: number;
  promptTps?: number;
  generationTps?: number;
  loadS?: number;
  totalS?: number;
  wallS: number;
  peakMemoryGb?: number;
  doneReason?: string;
  raw: string;
}

export interface ResultRow extends RunResult {
  id: string;
  presetId: string;
  presetTitle: string;
  expectedGenerationTps: number;
  createdAt: string;
  failed?: boolean;
}
