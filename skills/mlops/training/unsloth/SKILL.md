---
name: unsloth
description: "Unsloth: 2x faster LLM fine-tuning with 70% less VRAM. LoRA/QLoRA for Llama, Mistral, Qwen, Gemma."
version: 1.0.0
metadata:
  hermes:
    tags: [LLM, fine-tuning, LoRA, QLoRA, RLHF, GRPO, unsloth, training, GPU]
    related_skills: [trl-fine-tuning, axolotl, vllm, huggingface-hub]
---

# Unsloth Fine-tuning

## Platform Requirements

> **Windows users — WSL2 required.**
>
> Unsloth officially supports **Linux** and **Windows via WSL2 (Windows Subsystem for Linux 2)**. Native Windows (CMD / PowerShell) is **not supported** because Unsloth depends on:
> - [OpenAI Triton](https://github.com/openai/triton) — no native Windows wheel
> - Custom CUDA kernels compiled for Linux toolchains
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
> Alternatively: use [Google Colab](https://colab.research.google.com/), [RunPod](https://runpod.io/), or any Linux cloud GPU — Unsloth works out of the box on all of them.

## When to use

Use when users request: fast LLM fine-tuning, low-VRAM fine-tuning, LoRA/QLoRA, instruction tuning, RLHF/GRPO training, or when they want to fine-tune Llama, Mistral, Qwen, Phi, Gemma, or other open models with limited GPU memory.

Unsloth achieves **2x faster training** and **50-70% less VRAM** than standard HuggingFace training via hand-written GPU kernels and dynamic 4-bit quantization.

## Stack

| Component | Tool |
|-----------|------|
| Core | Unsloth (pip) |
| Training loop | Hugging Face TRL (`SFTTrainer`, `GRPOTrainer`) |
| Models | HuggingFace Hub / local safetensors |
| Quantization | bitsandbytes 4-bit / LoRA |
| Export | GGUF (for Ollama/llama.cpp), 16-bit safetensors (for vLLM) |

## Installation

### Linux / WSL2 (Ubuntu 22.04+)

```bash
# CUDA 12.1+ required
pip install unsloth

# Or with specific CUDA version:
pip install "unsloth[cu121-torch240]"  # CUDA 12.1, PyTorch 2.4.0

# Verify
python -c "import unsloth; print('Unsloth OK')"
```

### Docker (cross-platform)

```bash
docker pull unsloth/unsloth:latest
docker run --gpus all -it --rm -v $(pwd):/workspace unsloth/unsloth:latest bash
```

See references `llms.md` § Docker for the full official Docker guide.

## Workflow

### 1. Load Model + LoRA

```python
from unsloth import FastLanguageModel
import torch

model, tokenizer = FastLanguageModel.from_pretrained(
    model_name="unsloth/Llama-3.2-3B-Instruct",
    max_seq_length=2048,
    dtype=None,           # auto-detect: float16 on older GPUs, bfloat16 on Ampere+
    load_in_4bit=True,    # QLoRA — halves VRAM
)

model = FastLanguageModel.get_peft_model(
    model,
    r=16,                              # LoRA rank (8-64 typical)
    target_modules=["q_proj", "k_proj", "v_proj", "o_proj",
                    "gate_proj", "up_proj", "down_proj"],
    lora_alpha=16,
    lora_dropout=0,                    # 0 is optimized
    bias="none",
    use_gradient_checkpointing="unsloth",  # saves 30% more VRAM
    random_state=42,
)
```

### 2. Prepare Dataset

```python
from datasets import load_dataset

dataset = load_dataset("iamtarun/python_code_instructions_18k_alpaca", split="train")

# Apply chat template
def format_prompt(examples):
    return {"text": [
        tokenizer.apply_chat_template(
            [{"role": "user", "content": ex["instruction"] + "\n" + ex["input"]},
             {"role": "assistant", "content": ex["output"]}],
            tokenize=False, add_generation_prompt=False
        )
        for ex in zip(examples["instruction"], examples["input"], examples["output"])
    ]}
# ... (use standard HF datasets map)
```

### 3. Train (SFT)

```python
from trl import SFTTrainer
from transformers import TrainingArguments

trainer = SFTTrainer(
    model=model,
    tokenizer=tokenizer,
    train_dataset=dataset,
    dataset_text_field="text",
    max_seq_length=2048,
    args=TrainingArguments(
        per_device_train_batch_size=2,
        gradient_accumulation_steps=4,
        warmup_steps=5,
        max_steps=60,
        learning_rate=2e-4,
        fp16=not torch.cuda.is_bf16_supported(),
        bf16=torch.cuda.is_bf16_supported(),
        logging_steps=1,
        optim="adamw_8bit",
        output_dir="outputs",
    ),
)
trainer.train()
```

### 4. Save / Export

```python
# Save LoRA adapter (merge + save 16-bit for vLLM)
model.save_pretrained_merged("model_merged", tokenizer, save_method="merged_16bit")

# Save as GGUF for Ollama / llama.cpp
model.save_pretrained_gguf("model_gguf", tokenizer, quantization_method="q4_k_m")

# Push to HuggingFace Hub
model.push_to_hub_merged("username/my-model", tokenizer, save_method="merged_16bit", token="hf_...")
```

## GRPO / RLHF

See `references/llms.md` for the full GRPO / reasoning model tutorial.

```python
from trl import GRPOTrainer, GRPOConfig

trainer = GRPOTrainer(
    model=model,
    processing_class=tokenizer,
    reward_funcs=[my_reward_fn],
    args=GRPOConfig(
        use_vllm=True,              # fast rollouts via vLLM (Linux only)
        learning_rate=5e-6,
        num_generations=8,
        max_completion_length=512,
        output_dir="grpo_output",
    ),
    train_dataset=dataset,
)
trainer.train()
```

## VRAM Requirements

| Model Size | 4-bit QLoRA | 16-bit Full |
|------------|-------------|-------------|
| 1B–3B | 3–5 GB | 6–10 GB |
| 7B–8B | 5–8 GB | 16–20 GB |
| 13B | 8–12 GB | 26–30 GB |
| 70B | 40–48 GB | 140+ GB |

## References

| File | Contents |
|------|----------|
| `references/llms.md` | Condensed official Unsloth docs index |
| `references/llms-txt.md` | Full Unsloth docs (text-only) |
| `references/llms-full.md` | Complete Unsloth reference (all pages) |
| `references/index.md` | Reference index |
