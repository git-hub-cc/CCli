---
name: vllm
description: "vLLM: high-throughput LLM inference server. PagedAttention, continuous batching, OpenAI-compatible API."
version: 1.0.0
metadata:
  hermes:
    tags: [LLM, inference, vllm, serving, OpenAI, API, PagedAttention, GPU, quantization]
    related_skills: [unsloth, axolotl, llama-cpp, huggingface-hub]
---

# vLLM Inference

## Platform Requirements

> **Windows users — WSL2 required.**
>
> vLLM's official stable support is **Linux-only**. Native Windows (CMD / PowerShell) is **not supported** because vLLM depends on:
> - **PagedAttention CUDA kernels** compiled against Linux CUDA toolchain
> - [Flash Attention 2](https://github.com/Dao-AILab/flash-attention) — Linux-only build
> - [OpenAI Triton](https://github.com/openai/triton) for custom GPU ops
>
> Community attempts at Windows-native vLLM exist (see the `vllm-project/vllm` issue tracker) but are **not officially supported or stable**.
>
> **Quick WSL2 setup:**
> ```powershell
> # In PowerShell (Admin) — one-time setup
> wsl --install                  # installs WSL2 + Ubuntu
> wsl --set-default-version 2
> # After reboot, open Ubuntu from Start Menu and continue inside WSL2
> ```
> All commands below are run **inside the WSL2 terminal**.
>
> **Lightweight Windows alternative:**
> For local inference on Windows without WSL2, use [`mlops/inference/llama-cpp`](../../llama-cpp/SKILL.md) instead — llama.cpp has full native Windows support and runs CPU/GPU inference via GGUF models.

## When to use

Use when users need: high-throughput LLM serving, an OpenAI-compatible API endpoint, continuous batching for multiple concurrent users, multi-GPU tensor parallelism, or quantized model deployment (AWQ, GPTQ, FP8).

vLLM excels at **production serving** — it outperforms vanilla HuggingFace `generate()` by 10-24x throughput via PagedAttention and continuous batching.

## Stack

| Component | Tool |
|-----------|------|
| Core | vLLM (pip) |
| Attention | PagedAttention + Flash Attention 2 |
| API | OpenAI-compatible REST (`/v1/completions`, `/v1/chat/completions`) |
| Quantization | AWQ, GPTQ, FP8, INT4/INT8 |
| Multi-GPU | Tensor parallelism (`--tensor-parallel-size N`) |
| Sampling | Ray (for distributed serving) |

## Installation

### Linux / WSL2

```bash
# CUDA 12.1+ required
pip install vllm

# Verify
python -c "import vllm; print(vllm.__version__)"
```

### Docker (cross-platform — runs via WSL2 Docker Desktop on Windows)

```bash
docker run --runtime nvidia --gpus all \
    -v ~/.cache/huggingface:/root/.cache/huggingface \
    -p 8000:8000 \
    --ipc=host \
    vllm/vllm-openai:latest \
    --model meta-llama/Llama-3.2-3B-Instruct
```

## Modes

| Mode | Use case |
|------|----------|
| **OpenAI API server** | Drop-in replacement for OpenAI API; serves any HF model |
| **Offline batch inference** | Process large datasets, no server |
| **Quantized serving** | AWQ/GPTQ/FP8 for reduced VRAM |
| **Multi-GPU serving** | Tensor parallelism for 70B+ models |
| **LoRA serving** | Serve base model + multiple LoRA adapters simultaneously |

## Workflow

### Start API Server

```bash
# Basic server (Llama 3.2 3B)
vllm serve meta-llama/Llama-3.2-3B-Instruct

# With quantization (half the VRAM)
vllm serve meta-llama/Llama-3.1-8B-Instruct \
    --quantization awq \
    --dtype auto

# Multi-GPU (2 GPUs, tensor parallel)
vllm serve meta-llama/Llama-3.1-70B-Instruct \
    --tensor-parallel-size 2

# Custom port + GPU memory utilization
vllm serve Qwen/Qwen2.5-7B-Instruct \
    --port 8000 \
    --gpu-memory-utilization 0.9 \
    --max-model-len 8192
```

### Query the API (OpenAI-compatible)

```python
from openai import OpenAI

client = OpenAI(base_url="http://localhost:8000/v1", api_key="token-abc123")

response = client.chat.completions.create(
    model="meta-llama/Llama-3.2-3B-Instruct",
    messages=[{"role": "user", "content": "Explain PagedAttention in one paragraph."}],
    temperature=0.7,
    max_tokens=512,
)
print(response.choices[0].message.content)
```

### Offline Batch Inference

```python
from vllm import LLM, SamplingParams

llm = LLM(
    model="meta-llama/Llama-3.2-3B-Instruct",
    quantization="awq",          # optional
    tensor_parallel_size=1,
    gpu_memory_utilization=0.85,
)

params = SamplingParams(temperature=0.8, top_p=0.95, max_tokens=512)
prompts = ["Tell me about PagedAttention.", "What is continuous batching?"]

outputs = llm.generate(prompts, params)
for output in outputs:
    print(output.outputs[0].text)
```

### Serve a Fine-tuned Model (merged weights)

```bash
# After merging LoRA via Unsloth or PEFT:
vllm serve ./my-merged-model --trust-remote-code
```

## Key Flags Reference

| Flag | Description | Default |
|------|-------------|---------|
| `--quantization` | `awq`, `gptq`, `fp8`, `int4`, `int8` | None |
| `--tensor-parallel-size` | Number of GPUs for tensor parallelism | 1 |
| `--gpu-memory-utilization` | Fraction of GPU VRAM to use | 0.9 |
| `--max-model-len` | Maximum context length (tokens) | model default |
| `--max-num-seqs` | Maximum concurrent sequences | 256 |
| `--dtype` | `auto`, `float16`, `bfloat16` | `auto` |
| `--port` | API server port | 8000 |
| `--api-key` | Auth token for API requests | None |

## References

| File | Contents |
|------|----------|
| `references/server-deployment.md` | Full server configuration, production deployment |
| `references/quantization.md` | AWQ, GPTQ, FP8 quantization guide |
| `references/optimization.md` | Throughput tuning, batching strategies |
| `references/troubleshooting.md` | OOM errors, CUDA issues, common failures |
