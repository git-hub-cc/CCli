---
name: axolotl
description: "Axolotl: config-driven LLM fine-tuning framework. SFT, DPO, RLHF for Llama, Mistral, Falcon, Mixtral."
version: 1.0.0
metadata:
  hermes:
    tags: [LLM, fine-tuning, axolotl, LoRA, QLoRA, DPO, SFT, training, GPU, config-driven]
    related_skills: [unsloth, trl-fine-tuning, vllm, huggingface-hub]
---

# Axolotl Fine-tuning

## Platform Requirements

> **Windows users — WSL2 required.**
>
> Axolotl is a Linux-native framework. Native Windows (CMD / PowerShell) is **not supported** because Axolotl depends on:
> - [Flash Attention 2](https://github.com/Dao-AILab/flash-attention) — Linux-only build system (requires `ninja`, gcc toolchain)
> - [DeepSpeed](https://www.deepspeed.ai/) — no native Windows support
> - [OpenAI Triton](https://github.com/openai/triton) — no native Windows wheel
> - Complex `nvcc` (CUDA Toolkit) compile steps that require Linux headers
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
> **Recommended alternatives for quick iteration on Windows:**
> - [Google Colab](https://colab.research.google.com/) + axolotl Docker image
> - [RunPod](https://runpod.io/) or [Lambda Labs](https://lambdalabs.com/) cloud GPU instances (pre-configured Linux)

## When to use

Use when users need: config-file-driven LLM fine-tuning, multi-GPU training, custom dataset formats, advanced training recipes (DPO, RLHF, Mixtral MoE), or when they want reproducible training runs managed via YAML configs rather than writing Python code.

Axolotl is the go-to framework when:
- Training requires **distributed/multi-GPU** setup (`torchrun`, DeepSpeed ZeRO)
- The dataset is in a **non-standard format** (ShareGPT, Alpaca, completion, etc.)
- Users want to version-control training configs as YAML

## Stack

| Component | Tool |
|-----------|------|
| Core | Axolotl (pip / Docker) |
| Training backends | PyTorch + FSDP / DeepSpeed ZeRO 2/3 |
| Attention | Flash Attention 2 (required for long contexts) |
| Quantization | bitsandbytes 4-bit, GPTQ |
| Multi-GPU | `torchrun` / `accelerate launch` |
| Config | YAML (per-run, version-controllable) |

## Installation

### Linux / WSL2 (recommended)

```bash
# Install from pip
pip install axolotl

# Or from source (latest features)
git clone https://github.com/axolotl-ai-cloud/axolotl
cd axolotl
pip install -e ".[flash-attn,deepspeed]"
```

### Docker (cross-platform — runs via WSL2 Docker Desktop on Windows)

```bash
# Pull official image
docker pull winglian/axolotl:main-latest

# Run training
docker run --gpus all -it --rm \
  -v $(pwd):/workspace \
  winglian/axolotl:main-latest \
  python -m axolotl.cli.train /workspace/config.yaml
```

## Workflow

### 1. Write a Config YAML

```yaml
# config.yaml — SFT example (Llama 3.2 3B)
base_model: unsloth/Llama-3.2-3B-Instruct
model_type: LlamaForCausalLM
tokenizer_type: AutoTokenizer

load_in_8bit: false
load_in_4bit: true           # QLoRA
strict: false

datasets:
  - path: iamtarun/python_code_instructions_18k_alpaca
    type: alpaca

dataset_prepared_path: data/prepared
val_set_size: 0.05
output_dir: ./outputs/llama-3b-sft

sequence_len: 2048
sample_packing: true          # flash-attention packing for speed
pad_to_sequence_len: true

adapter: lora
lora_r: 16
lora_alpha: 32
lora_dropout: 0.05
lora_target_modules:
  - q_proj
  - v_proj
  - k_proj
  - o_proj
  - gate_proj
  - up_proj
  - down_proj

gradient_accumulation_steps: 4
micro_batch_size: 2
num_epochs: 3
optimizer: adamw_bnb_8bit
lr_scheduler: cosine
learning_rate: 2e-4
train_on_inputs: false
bf16: auto
tf32: false
gradient_checkpointing: true
logging_steps: 1
flash_attention: true         # requires Flash Attention 2 (Linux only)
warmup_ratio: 0.03
saves_per_epoch: 1
```

### 2. Preprocess Dataset (optional, for speed)

```bash
python -m axolotl.cli.preprocess config.yaml
```

### 3. Train

```bash
# Single GPU
python -m axolotl.cli.train config.yaml

# Multi-GPU (2 GPUs) via torchrun
torchrun --nproc_per_node=2 -m axolotl.cli.train config.yaml

# Multi-GPU with DeepSpeed ZeRO-3
accelerate launch -m axolotl.cli.train config.yaml --deepspeed deepspeed_configs/zero3.json
```

### 4. Inference / Merge

```bash
# Merge LoRA into base model
python -m axolotl.cli.merge_lora config.yaml --lora_model_dir=./outputs/llama-3b-sft

# Quick inference test
python -m axolotl.cli.inference config.yaml \
  --lora_model_dir=./outputs/llama-3b-sft \
  --gradio                 # opens a Gradio UI
```

## Key Config Patterns

| Goal | Config key | Value |
|------|-----------|-------|
| QLoRA (4-bit) | `load_in_4bit: true` + `adapter: lora` | saves 50-70% VRAM |
| Full fine-tune | `adapter:` (omit) + `load_in_4bit: false` | needs large VRAM |
| DPO training | `rl: dpo` + `datasets[].type: chat_template.default` | RLHF alignment |
| Flash Attention | `flash_attention: true` | 2-3x throughput (Linux only) |
| Resume training | `resume_from_checkpoint: outputs/checkpoint-500` | picks up from last ckpt |
| Sample packing | `sample_packing: true` | fills context window for efficiency |

## Dataset Format Reference

See `references/dataset-formats.md` for all supported dataset types (Alpaca, ShareGPT, completion, chat, DPO pairs, and custom templates).

## References

| File | Contents |
|------|----------|
| `references/api.md` | Full Axolotl config schema reference |
| `references/dataset-formats.md` | All supported dataset formats with examples |
| `references/other.md` | Advanced configs: DeepSpeed, FSDP, curriculum learning |
| `references/index.md` | Reference index |
