use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{
    env,
    path::{Path, PathBuf},
    time::{Duration, Instant},
};
use tokio::{process::Command, time::timeout};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct EnvironmentSettings {
    ollama_url: String,
    mlx_url: String,
    llama_bench_path: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ToolCheck {
    available: bool,
    detail: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct EnvironmentStatus {
    ollama: ToolCheck,
    mlx_server: ToolCheck,
    llamacpp: ToolCheck,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RunRequest {
    backend: String,
    model: String,
    prompt: String,
    max_tokens: u32,
    num_ctx: Option<u32>,
    temperature: f32,
    ollama_url: String,
    mlx_url: String,
    mlx_model: String,
    llama_bench_path: String,
    llama_hf: String,
    llama_prompt_tokens: Option<u32>,
    n_gpu_layers: Option<u32>,
    flash_attention: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct RunResult {
    backend: String,
    model: String,
    summary: String,
    response_text: String,
    prompt_tokens: u64,
    output_tokens: u64,
    prompt_tps: Option<f64>,
    generation_tps: Option<f64>,
    load_s: Option<f64>,
    total_s: Option<f64>,
    wall_s: f64,
    peak_memory_gb: Option<f64>,
    done_reason: Option<String>,
    raw: String,
}

#[tauri::command]
async fn check_environment(settings: EnvironmentSettings) -> EnvironmentStatus {
    let client = match reqwest::Client::builder()
        .timeout(Duration::from_secs(2))
        .build()
    {
        Ok(client) => client,
        Err(error) => {
            let detail = format!("HTTP client setup failed: {error}");
            return EnvironmentStatus {
                ollama: ToolCheck {
                    available: false,
                    detail: detail.clone(),
                },
                mlx_server: ToolCheck {
                    available: false,
                    detail: detail.clone(),
                },
                llamacpp: ToolCheck {
                    available: false,
                    detail,
                },
            };
        }
    };

    let ollama = check_ollama(&client, &settings.ollama_url).await;
    let mlx_server = check_mlx_server(&client, &settings.mlx_url).await;
    let llamacpp = check_llamacpp(&settings.llama_bench_path);

    EnvironmentStatus {
        ollama,
        mlx_server,
        llamacpp,
    }
}

#[tauri::command]
async fn run_preset(request: RunRequest) -> Result<RunResult, String> {
    match request.backend.as_str() {
        "ollama" => run_ollama(request).await,
        "mlx_server" => run_mlx_server(request).await,
        "llamacpp" => run_llamacpp(request).await,
        other => Err(format!("unsupported backend: {other}")),
    }
}

async fn check_ollama(client: &reqwest::Client, base_url: &str) -> ToolCheck {
    let url = format!("{}/api/tags", normalize_url(base_url));
    match client.get(url).send().await {
        Ok(response) if response.status().is_success() => {
            let value: Value = response.json().await.unwrap_or(Value::Null);
            let models = value
                .get("models")
                .and_then(Value::as_array)
                .map(|items| {
                    items
                        .iter()
                        .filter_map(|item| item.get("name").and_then(Value::as_str))
                        .take(4)
                        .collect::<Vec<_>>()
                        .join(", ")
                })
                .unwrap_or_default();
            ToolCheck {
                available: true,
                detail: if models.is_empty() {
                    "running".into()
                } else {
                    format!("running: {models}")
                },
            }
        }
        Ok(response) => ToolCheck {
            available: false,
            detail: format!("HTTP {}", response.status()),
        },
        Err(error) => ToolCheck {
            available: false,
            detail: short_error(error),
        },
    }
}

async fn check_mlx_server(client: &reqwest::Client, base_url: &str) -> ToolCheck {
    let url = format!("{}/v1/models", normalize_url(base_url));
    match client.get(url).send().await {
        Ok(response) => {
            let status = response.status();
            ToolCheck {
                available: status.is_success() || status.as_u16() == 404 || status.as_u16() == 405,
                detail: if status.is_success() {
                    "server responded".into()
                } else {
                    format!("server HTTP {status}")
                },
            }
        }
        Err(error) => ToolCheck {
            available: false,
            detail: short_error(error),
        },
    }
}

fn check_llamacpp(configured_path: &str) -> ToolCheck {
    match resolve_executable(configured_path, "llama-bench") {
        Ok(path) => ToolCheck {
            available: true,
            detail: path.display().to_string(),
        },
        Err(detail) => ToolCheck {
            available: false,
            detail,
        },
    }
}

async fn run_ollama(request: RunRequest) -> Result<RunResult, String> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(900))
        .build()
        .map_err(|error| error.to_string())?;
    let url = format!("{}/api/generate", normalize_url(&request.ollama_url));
    let payload = json!({
        "model": request.model,
        "prompt": request.prompt,
        "stream": false,
        "think": false,
        "options": {
            "temperature": request.temperature,
            "num_ctx": request.num_ctx.unwrap_or(4096),
            "num_predict": request.max_tokens
        }
    });

    let started = Instant::now();
    let response = client
        .post(url)
        .json(&payload)
        .send()
        .await
        .map_err(|error| format!("Ollama request failed: {}", short_error(error)))?;
    let status = response.status();
    let body = response
        .text()
        .await
        .map_err(|error| format!("Ollama response read failed: {}", short_error(error)))?;
    let wall_s = started.elapsed().as_secs_f64();

    if !status.is_success() {
        return Err(format!("Ollama HTTP {status}: {body}"));
    }

    let value: Value = serde_json::from_str(&body)
        .map_err(|error| format!("Ollama returned invalid JSON: {error}"))?;

    let prompt_tokens = as_u64(&value, "prompt_eval_count").unwrap_or(0);
    let output_tokens = as_u64(&value, "eval_count").unwrap_or(0);
    let prompt_duration = as_u64(&value, "prompt_eval_duration").unwrap_or(0);
    let eval_duration = as_u64(&value, "eval_duration").unwrap_or(0);
    let prompt_tps = tps(prompt_tokens, prompt_duration);
    let generation_tps = tps(output_tokens, eval_duration);
    let response_text = value
        .get("response")
        .and_then(Value::as_str)
        .unwrap_or("")
        .to_string();
    let done_reason = value
        .get("done_reason")
        .and_then(Value::as_str)
        .map(ToOwned::to_owned);

    Ok(RunResult {
        backend: "ollama".into(),
        model: value
            .get("model")
            .and_then(Value::as_str)
            .unwrap_or("ollama")
            .to_string(),
        summary: format!(
            "Ollama: {} tokens in {:.2}s",
            output_tokens,
            seconds_from_nanos(eval_duration).unwrap_or(wall_s)
        ),
        response_text,
        prompt_tokens,
        output_tokens,
        prompt_tps,
        generation_tps,
        load_s: as_u64(&value, "load_duration").and_then(seconds_from_nanos),
        total_s: as_u64(&value, "total_duration").and_then(seconds_from_nanos),
        wall_s,
        peak_memory_gb: None,
        done_reason,
        raw: pretty(&value),
    })
}

async fn run_mlx_server(request: RunRequest) -> Result<RunResult, String> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(900))
        .build()
        .map_err(|error| error.to_string())?;
    let url = format!("{}/v1/chat/completions", normalize_url(&request.mlx_url));
    let model = if request.mlx_model.trim().is_empty() {
        request.model.clone()
    } else {
        request.mlx_model.clone()
    };
    let payload = json!({
        "model": model,
        "messages": [{"role": "user", "content": request.prompt}],
        "temperature": request.temperature,
        "max_tokens": request.max_tokens,
        "stream": false,
        "verbose": false
    });

    let started = Instant::now();
    let response = client
        .post(url)
        .json(&payload)
        .send()
        .await
        .map_err(|error| format!("MLX server request failed: {}", short_error(error)))?;
    let status = response.status();
    let body = response
        .text()
        .await
        .map_err(|error| format!("MLX server response read failed: {}", short_error(error)))?;
    let wall_s = started.elapsed().as_secs_f64();

    if !status.is_success() {
        return Err(format!("MLX server HTTP {status}: {body}"));
    }

    let value: Value = serde_json::from_str(&body)
        .map_err(|error| format!("MLX server returned invalid JSON: {error}"))?;
    let usage = value.get("usage").unwrap_or(&Value::Null);
    let response_text = value
        .pointer("/choices/0/message/content")
        .and_then(Value::as_str)
        .or_else(|| value.pointer("/choices/0/text").and_then(Value::as_str))
        .unwrap_or("")
        .to_string();
    let prompt_tokens = nested_u64(usage, &["input_tokens", "prompt_tokens"]).unwrap_or(0);
    let output_tokens = nested_u64(usage, &["output_tokens", "completion_tokens"]).unwrap_or(0);
    let prompt_tps = nested_f64(usage, &["prompt_tps"]);
    let generation_tps = nested_f64(usage, &["generation_tps"]);
    let peak_memory_gb = nested_f64(usage, &["peak_memory", "peak_memory_gb"]);

    Ok(RunResult {
        backend: "mlx_server".into(),
        model,
        summary: format!("MLX server: {} tokens in {:.2}s", output_tokens, wall_s),
        response_text,
        prompt_tokens,
        output_tokens,
        prompt_tps,
        generation_tps,
        load_s: None,
        total_s: None,
        wall_s,
        peak_memory_gb,
        done_reason: value
            .pointer("/choices/0/finish_reason")
            .and_then(Value::as_str)
            .map(ToOwned::to_owned),
        raw: pretty(&value),
    })
}

async fn run_llamacpp(request: RunRequest) -> Result<RunResult, String> {
    let bench_path = resolve_executable(&request.llama_bench_path, "llama-bench")?;
    let hf = if request.llama_hf.trim().is_empty() {
        "ggml-org/gemma-4-E4B-it-GGUF:Q4_K_M"
    } else {
        request.llama_hf.trim()
    };
    let prompt_tokens = request.llama_prompt_tokens.unwrap_or(512);
    let n_gpu_layers = request.n_gpu_layers.unwrap_or(99);
    let flash_attention = if request.flash_attention { "1" } else { "0" };

    let started = Instant::now();
    let mut command = Command::new(&bench_path);
    command
        .arg("-hf")
        .arg(hf)
        .arg("-p")
        .arg(prompt_tokens.to_string())
        .arg("-n")
        .arg(request.max_tokens.to_string())
        .arg("-r")
        .arg("1")
        .arg("-ngl")
        .arg(n_gpu_layers.to_string())
        .arg("-fa")
        .arg(flash_attention)
        .arg("-o")
        .arg("json")
        .kill_on_drop(true);

    let output = timeout(Duration::from_secs(900), command.output())
        .await
        .map_err(|_| "llama-bench timed out after 900s".to_string())?
        .map_err(|error| format!("failed to launch llama-bench: {error}"))?;
    let wall_s = started.elapsed().as_secs_f64();

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();
    if !output.status.success() {
        return Err(format!(
            "llama-bench exited with {}: {}",
            output.status,
            stderr.trim()
        ));
    }

    let json_text = extract_json_array(&stdout)?;
    let value: Value = serde_json::from_str(json_text)
        .map_err(|error| format!("llama-bench returned invalid JSON: {error}"))?;
    let rows = value
        .as_array()
        .ok_or_else(|| "llama-bench JSON was not an array".to_string())?;

    let mut prompt_tps = None;
    let mut generation_tps = None;
    let mut measured_prompt_tokens = 0;
    let mut measured_output_tokens = 0;
    let mut bench_seconds = 0.0;

    for row in rows {
        let n_prompt = as_u64(row, "n_prompt").unwrap_or(0);
        let n_gen = as_u64(row, "n_gen").unwrap_or(0);
        let avg_ts = as_f64(row, "avg_ts");
        bench_seconds += as_u64(row, "avg_ns")
            .and_then(seconds_from_nanos)
            .unwrap_or(0.0);
        if n_prompt > 0 {
            measured_prompt_tokens = n_prompt;
            prompt_tps = avg_ts;
        }
        if n_gen > 0 {
            measured_output_tokens = n_gen;
            generation_tps = avg_ts;
        }
    }

    Ok(RunResult {
        backend: "llamacpp".into(),
        model: hf.to_string(),
        summary: format!(
            "llama-bench: p{} / n{} in {:.2}s",
            measured_prompt_tokens, measured_output_tokens, bench_seconds
        ),
        response_text: "llama-bench は生成テキストを返さず、prompt processing と generation の速度だけを測定します。".into(),
        prompt_tokens: measured_prompt_tokens,
        output_tokens: measured_output_tokens,
        prompt_tps,
        generation_tps,
        load_s: None,
        total_s: Some(bench_seconds),
        wall_s,
        peak_memory_gb: None,
        done_reason: None,
        raw: pretty(&value),
    })
}

fn normalize_url(url: &str) -> String {
    let trimmed = url.trim().trim_end_matches('/');
    if trimmed.is_empty() {
        "http://127.0.0.1".into()
    } else {
        trimmed.into()
    }
}

fn tps(tokens: u64, duration_ns: u64) -> Option<f64> {
    let seconds = seconds_from_nanos(duration_ns)?;
    if tokens == 0 || seconds <= 0.0 {
        None
    } else {
        Some(tokens as f64 / seconds)
    }
}

fn seconds_from_nanos(value: u64) -> Option<f64> {
    if value == 0 {
        None
    } else {
        Some(value as f64 / 1_000_000_000.0)
    }
}

fn as_u64(value: &Value, key: &str) -> Option<u64> {
    value.get(key).and_then(|item| {
        item.as_u64().or_else(|| {
            item.as_f64().and_then(|float| {
                if float.is_finite() && float >= 0.0 {
                    Some(float as u64)
                } else {
                    None
                }
            })
        })
    })
}

fn as_f64(value: &Value, key: &str) -> Option<f64> {
    value.get(key).and_then(|item| {
        item.as_f64().or_else(|| {
            item.as_u64().map(|number| number as f64).or_else(|| {
                item.as_str()
                    .and_then(|text| text.parse::<f64>().ok())
                    .filter(|number| number.is_finite())
            })
        })
    })
}

fn nested_u64(value: &Value, keys: &[&str]) -> Option<u64> {
    keys.iter().find_map(|key| as_u64(value, key))
}

fn nested_f64(value: &Value, keys: &[&str]) -> Option<f64> {
    keys.iter().find_map(|key| as_f64(value, key))
}

fn pretty(value: &Value) -> String {
    serde_json::to_string_pretty(value).unwrap_or_else(|_| value.to_string())
}

fn extract_json_array(stdout: &str) -> Result<&str, String> {
    let start = stdout
        .find('[')
        .ok_or_else(|| format!("could not find JSON array in stdout: {stdout}"))?;
    let end = stdout
        .rfind(']')
        .ok_or_else(|| format!("could not find JSON array end in stdout: {stdout}"))?;
    Ok(&stdout[start..=end])
}

fn resolve_executable(configured_path: &str, fallback_name: &str) -> Result<PathBuf, String> {
    let configured = configured_path.trim();
    if !configured.is_empty() {
        let path = PathBuf::from(configured);
        return if is_executable_file(&path) {
            Ok(path)
        } else {
            Err(format!("not executable: {}", path.display()))
        };
    }

    find_in_path(fallback_name).ok_or_else(|| format!("{fallback_name} was not found in PATH"))
}

fn find_in_path(name: &str) -> Option<PathBuf> {
    let paths = env::var_os("PATH")?;
    env::split_paths(&paths)
        .map(|dir| dir.join(name))
        .find(|candidate| is_executable_file(candidate))
}

fn is_executable_file(path: &Path) -> bool {
    path.is_file()
}

fn short_error(error: reqwest::Error) -> String {
    if error.is_connect() {
        "connection failed".into()
    } else if error.is_timeout() {
        "timeout".into()
    } else {
        error.to_string()
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![check_environment, run_preset])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
