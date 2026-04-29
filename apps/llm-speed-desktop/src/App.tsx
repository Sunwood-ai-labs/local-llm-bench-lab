import { invoke } from "@tauri-apps/api/core";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Gauge,
  Play,
  RefreshCw,
  Server,
  Settings2,
  Timer,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  DEFAULT_PROMPTS,
  DEFAULT_SETTINGS,
  LIGHT_PRESET_IDS,
  PRESETS,
} from "./presets";
import type { ReactNode } from "react";
import type {
  AppSettings,
  Backend,
  BenchPreset,
  EnvironmentStatus,
  ResultRow,
  RunRequest,
  RunResult,
  ToolCheck,
} from "./types";

const SETTINGS_KEY = "llm-speed-desktop-settings";

function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function fmt(value?: number, digits = 1) {
  return typeof value === "number" && Number.isFinite(value)
    ? value.toFixed(digits)
    : "-";
}

function backendLabel(backend: Backend) {
  if (backend === "mlx_server") return "MLX";
  if (backend === "llamacpp") return "llama.cpp";
  return "Ollama";
}

function statusTone(check?: ToolCheck) {
  if (!check) return "idle";
  return check.available ? "ok" : "bad";
}

function selectedHealth(env: EnvironmentStatus | null, backend: Backend) {
  if (!env) return undefined;
  if (backend === "mlx_server") return env.mlxServer;
  if (backend === "llamacpp") return env.llamacpp;
  return env.ollama;
}

function buildRequest(
  preset: BenchPreset,
  settings: AppSettings,
  prompt: string,
  maxTokens: number,
): RunRequest {
  return {
    backend: preset.backend,
    model: preset.model,
    prompt,
    maxTokens,
    numCtx: preset.numCtx,
    temperature: 0,
    ollamaUrl: settings.ollamaUrl,
    mlxUrl: settings.mlxUrl,
    mlxModel: settings.mlxModel,
    llamaBenchPath: settings.llamaBenchPath,
    llamaHf: preset.llamaHf || settings.llamaHf,
    llamaPromptTokens: preset.llamaPromptTokens,
    nGpuLayers: preset.nGpuLayers || settings.nGpuLayers,
    flashAttention:
      typeof preset.flashAttention === "boolean"
        ? preset.flashAttention
        : settings.flashAttention,
  };
}

function resultFromError(
  preset: BenchPreset,
  message: unknown,
  startedAt: number,
): ResultRow {
  const text = message instanceof Error ? message.message : String(message);
  return {
    id: `${preset.id}-${Date.now()}`,
    presetId: preset.id,
    presetTitle: preset.title,
    expectedGenerationTps: preset.expectedGenerationTps,
    backend: preset.backend,
    model: preset.model,
    summary: "実行に失敗しました",
    responseText: text,
    promptTokens: 0,
    outputTokens: 0,
    wallS: (Date.now() - startedAt) / 1000,
    raw: text,
    createdAt: new Date().toLocaleTimeString(),
    failed: true,
  };
}

export default function App() {
  const [selectedId, setSelectedId] = useState(PRESETS[0].id);
  const [settings, setSettings] = useState<AppSettings>(loadSettings);
  const [env, setEnv] = useState<EnvironmentStatus | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [prompt, setPrompt] = useState(DEFAULT_PROMPTS.long);
  const [promptMode, setPromptMode] = useState<"short" | "long" | "custom">("long");
  const [maxTokens, setMaxTokens] = useState(PRESETS[0].maxTokens);
  const [results, setResults] = useState<ResultRow[]>([]);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);

  const selected = useMemo(
    () => PRESETS.find((preset) => preset.id === selectedId) || PRESETS[0],
    [selectedId],
  );
  const health = selectedHealth(env, selected.backend);
  const lastResult = results.find((row) => row.presetId === selected.id);
  const runningPreset = PRESETS.find((preset) => preset.id === runningId);

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    setMaxTokens(selected.maxTokens);
  }, [selected.id, selected.maxTokens]);

  useEffect(() => {
    if (!runningId) {
      setElapsed(0);
      return undefined;
    }
    const started = Date.now();
    const interval = window.setInterval(() => {
      setElapsed((Date.now() - started) / 1000);
    }, 100);
    return () => window.clearInterval(interval);
  }, [runningId]);

  async function refreshEnvironment() {
    setIsChecking(true);
    try {
      const status = await invoke<EnvironmentStatus>("check_environment", {
        settings: {
          ollamaUrl: settings.ollamaUrl,
          mlxUrl: settings.mlxUrl,
          llamaBenchPath: settings.llamaBenchPath,
        },
      });
      setEnv(status);
    } finally {
      setIsChecking(false);
    }
  }

  useEffect(() => {
    refreshEnvironment();
  }, []);

  function changePromptMode(nextMode: "short" | "long" | "custom") {
    setPromptMode(nextMode);
    if (nextMode === "short") setPrompt(DEFAULT_PROMPTS.short);
    if (nextMode === "long") setPrompt(DEFAULT_PROMPTS.long);
  }

  async function runPreset(preset: BenchPreset) {
    const started = Date.now();
    setRunningId(preset.id);
    try {
      const request = buildRequest(preset, settings, prompt, maxTokens);
      const result = await invoke<RunResult>("run_preset", { request });
      const row: ResultRow = {
        ...result,
        id: `${preset.id}-${started}`,
        presetId: preset.id,
        presetTitle: preset.title,
        expectedGenerationTps: preset.expectedGenerationTps,
        createdAt: new Date().toLocaleTimeString(),
      };
      setResults((prev) => [row, ...prev].slice(0, 24));
    } catch (error) {
      setResults((prev) => [resultFromError(preset, error, started), ...prev].slice(0, 24));
    } finally {
      setRunningId(null);
    }
  }

  async function runLightSet() {
    for (const presetId of LIGHT_PRESET_IDS) {
      const preset = PRESETS.find((item) => item.id === presetId);
      if (preset) await runPreset(preset);
    }
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <div className="eyebrow">Gemma 4 local benchmark</div>
          <h1>Local LLM Speed Lab</h1>
        </div>
        <div className="status-strip">
          <StatusPill label="Ollama" check={env?.ollama} />
          <StatusPill label="MLX" check={env?.mlxServer} />
          <StatusPill label="llama.cpp" check={env?.llamacpp} />
          <button
            className="icon-button"
            title="再チェック"
            onClick={refreshEnvironment}
            disabled={isChecking}
          >
            <RefreshCw size={17} className={isChecking ? "spin" : ""} />
          </button>
        </div>
      </header>

      <main className="workspace">
        <aside className="preset-pane">
          <div className="pane-title">
            <Gauge size={18} />
            <span>プリセット</span>
          </div>
          <div className="preset-list">
            {PRESETS.map((preset) => (
              <button
                key={preset.id}
                className={`preset-card ${selected.id === preset.id ? "active" : ""}`}
                onClick={() => setSelectedId(preset.id)}
              >
                <div className="preset-card-head">
                  <span className={`backend-chip ${preset.backend}`}>
                    {backendLabel(preset.backend)}
                  </span>
                  {preset.heavy ? <AlertTriangle size={15} /> : <Zap size={15} />}
                </div>
                <strong>{preset.title}</strong>
                <span className="target">{preset.target}</span>
                <div className="metric-row">
                  <span>{fmt(preset.expectedGenerationTps)} tok/s</span>
                  <span>{preset.expectedMemoryGb ? `${fmt(preset.expectedMemoryGb)}GB` : "bench"}</span>
                </div>
              </button>
            ))}
          </div>
        </aside>

        <section className="main-pane">
          <section className="run-panel">
            <div className="panel-head">
              <div>
                <div className="eyebrow">{backendLabel(selected.backend)}</div>
                <h2>{selected.title}</h2>
              </div>
              <div className={`health ${statusTone(health)}`}>
                {health?.available ? <CheckCircle2 size={17} /> : <AlertTriangle size={17} />}
                <span>{health?.detail || "未チェック"}</span>
              </div>
            </div>

            <div className="facts-grid">
              <Fact icon={<Activity size={17} />} label="表の生成速度" value={`${fmt(selected.expectedGenerationTps)} tok/s`} />
              <Fact icon={<Cpu size={17} />} label="Prompt" value={`${fmt(selected.expectedPromptTps)} tok/s`} />
              <Fact icon={<Server size={17} />} label="メモリ" value={selected.expectedMemoryGb ? `約${fmt(selected.expectedMemoryGb)}GB` : "未計測"} />
              <Fact icon={<Timer size={17} />} label="体感" value={selected.expectedLatency || selected.note} />
            </div>

            <div className="control-grid">
              <label className="field span-2">
                <span>プロンプト</span>
                <div className="segmented">
                  <button
                    className={promptMode === "short" ? "active" : ""}
                    onClick={() => changePromptMode("short")}
                    type="button"
                  >
                    短文
                  </button>
                  <button
                    className={promptMode === "long" ? "active" : ""}
                    onClick={() => changePromptMode("long")}
                    type="button"
                  >
                    512想定
                  </button>
                  <button
                    className={promptMode === "custom" ? "active" : ""}
                    onClick={() => changePromptMode("custom")}
                    type="button"
                  >
                    任意
                  </button>
                </div>
                <textarea
                  value={prompt}
                  onChange={(event) => {
                    setPrompt(event.target.value);
                    setPromptMode("custom");
                  }}
                />
              </label>

              <label className="field">
                <span>最大生成</span>
                <input
                  type="number"
                  min={1}
                  max={4096}
                  value={maxTokens}
                  onChange={(event) => setMaxTokens(Number(event.target.value))}
                />
              </label>

              <label className="field">
                <span>Ollama URL</span>
                <input
                  value={settings.ollamaUrl}
                  onChange={(event) =>
                    setSettings((prev) => ({ ...prev, ollamaUrl: event.target.value }))
                  }
                />
              </label>

              <label className="field">
                <span>MLX server URL</span>
                <input
                  value={settings.mlxUrl}
                  onChange={(event) =>
                    setSettings((prev) => ({ ...prev, mlxUrl: event.target.value }))
                  }
                />
              </label>

              <label className="field">
                <span>MLX model</span>
                <input
                  value={settings.mlxModel}
                  onChange={(event) =>
                    setSettings((prev) => ({ ...prev, mlxModel: event.target.value }))
                  }
                />
              </label>

              <label className="field">
                <span>llama-bench</span>
                <input
                  value={settings.llamaBenchPath}
                  placeholder="PATH の llama-bench を使う"
                  onChange={(event) =>
                    setSettings((prev) => ({ ...prev, llamaBenchPath: event.target.value }))
                  }
                />
              </label>
            </div>

            <div className="actions">
              <button
                className="primary"
                onClick={() => runPreset(selected)}
                disabled={Boolean(runningId)}
              >
                <Play size={17} />
                選択を実行
              </button>
              <button className="secondary" onClick={runLightSet} disabled={Boolean(runningId)}>
                <Gauge size={17} />
                軽量セット
              </button>
              <div className="running-meter">
                {runningPreset
                  ? `${backendLabel(runningPreset.backend)} running ${fmt(elapsed, 1)}s`
                  : "idle"}
              </div>
            </div>
          </section>

          <section className="result-section">
            <div className="section-head">
              <div>
                <div className="eyebrow">latest</div>
                <h2>実測結果</h2>
              </div>
              {lastResult && (
                <div className="last-score">
                  <span>{fmt(lastResult.generationTps)} tok/s</span>
                  <small>前回 {lastResult.createdAt}</small>
                </div>
              )}
            </div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>時刻</th>
                    <th>構成</th>
                    <th>生成</th>
                    <th>表との差</th>
                    <th>Prompt</th>
                    <th>Wall</th>
                    <th>Tokens</th>
                    <th>Memory</th>
                  </tr>
                </thead>
                <tbody>
                  {results.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="empty-cell">
                        まだ実測はありません
                      </td>
                    </tr>
                  ) : (
                    results.map((row) => {
                      const delta =
                        typeof row.generationTps === "number"
                          ? row.generationTps - row.expectedGenerationTps
                          : undefined;
                      return (
                        <tr key={row.id} className={row.failed ? "failed-row" : ""}>
                          <td>{row.createdAt}</td>
                          <td>{row.presetTitle}</td>
                          <td>{fmt(row.generationTps)} tok/s</td>
                          <td className={typeof delta === "number" && delta >= 0 ? "plus" : "minus"}>
                            {typeof delta === "number" ? `${delta >= 0 ? "+" : ""}${fmt(delta)}` : "-"}
                          </td>
                          <td>{fmt(row.promptTps)} tok/s</td>
                          <td>{fmt(row.wallS, 2)}s</td>
                          <td>{row.outputTokens || "-"}</td>
                          <td>{row.peakMemoryGb ? `${fmt(row.peakMemoryGb)}GB` : "-"}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {results[0] && (
              <div className="output-pane">
                <div className="output-head">
                  <Settings2 size={16} />
                  <span>{results[0].summary}</span>
                </div>
                <pre>{results[0].responseText || results[0].raw}</pre>
              </div>
            )}
          </section>
        </section>
      </main>
    </div>
  );
}

function StatusPill({ label, check }: { label: string; check?: ToolCheck }) {
  return (
    <div className={`status-pill ${statusTone(check)}`} title={check?.detail}>
      {check?.available ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
      <span>{label}</span>
    </div>
  );
}

function Fact({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="fact">
      {icon}
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
