---
name: trl-fine-tuning
description: "TRL: Transformer Reinforcement Learning — SFT, DPO, GRPO, PPO fine-tuning with HuggingFace."
version: 1.0.0
metadata:
  hermes:
    tags: [LLM, fine-tuning, TRL, RLHF, DPO, GRPO, PPO, SFT, reward-modeling, training, GPU]
    related_skills: [unsloth, axolotl, vllm, huggingface-hub]
---

# TRL Fine-tuning (Transformer Reinforcement Learning)

## Platform Requirements

> **Windows users — WSL2 required.**
>
> TRL itself is a Python package that technically installs on Windows, but production training workflows are **not supported on native Windows** because the high-performance components TRL relies on are Linux-only:
> - **GRPO / PPO** requires [vLLM](../../../inference/vllm/SKILL.md) for fast rollout generation — vLLM is Linux-only
> - **`adamw_8bit`** optimizer requires bitsandbytes CUDA kernels — no native Windows build for training
> - **Flash Attention 2** (`attn_implementation="flash_attention_2"`) requires Linux build toolchain
> - **DeepSpeed** distributed training — Linux-only
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
> **Cloud alternatives (no local setup):**
> - [Google Colab](https://colab.research.google.com/) — free T4/A100 GPU
> - [Kaggle Notebooks](https://www.kaggle.com/code) — free P100/T4
> - [RunPod](https://runpod.io/) — pay-per-hour A100/H100

## When to use

Use TRL when users need:
- **SFT (Supervised Fine-tuning)**: instruction tuning, chat model training
- **DPO / IPO / KTO**: preference alignment without a reward model
- **GRPO**: DeepSeek-R1-style reasoning model training with verifiable rewards
- **PPO**: full RLHF pipeline with a separate reward model
- **Reward modeling**: train a reward model from human preference data

TRL is the standard HuggingFace library for RLHF — use it when you need full control over the training algorithm. For simpler fine-tuning with faster iteration, see [`unsloth`](../unsloth/SKILL.md) (which wraps TRL with speed optimizations).

## Stack

| Component | Tool |
|-----------|------|
| Core | TRL (`pip install trl`) |
| Models | HuggingFace Transformers |
| Quantization | bitsandbytes (4/8-bit), PEFT / LoRA |
| Rollouts (GRPO) | vLLM (optional, for fast generation) |
| Logging | Weights & Biases / TensorBoard |
| Multi-GPU | `accelerate launch` |

## Installation

### Linux / WSL2

```bash
pip install trl transformers peft bitsandbytes accelerate datasets
# Optional: Flash Attention 2 (significant speedup)
pip install flash-attn --no-build-isolation
# Optional: vLLM for GRPO rollouts
pip install vllm
```

## Training Modes

### SFT (Supervised Fine-tuning)

```python
from trl import SFTTrainer, SFTConfig
from transformers import AutoModelForCausalLM, AutoTokenizer
from datasets import load_dataset
import torch

model = AutoModelForCausalLM.from_pretrained(
    "Qwen/Qwen2.5-1.5B-Instruct",
    torch_dtype=torch.bfloat16,
    attn_implementation="flash_attention_2",  # Linux only
    device_map="auto",
)
tokenizer = AutoTokenizer.from_pretrained("Qwen/Qwen2.5-1.5B-Instruct")

dataset = load_dataset("trl-lib/Capybara", split="train")

trainer = SFTTrainer(
    model=model,
    tokenizer=tokenizer,
    train_dataset=dataset,
    args=SFTConfig(
        output_dir="outputs/sft",
        max_seq_length=2048,
        per_device_train_batch_size=2,
        gradient_accumulation_steps=4,
        learning_rate=2e-4,
        num_train_epochs=3,
        optim="adamw_8bit",
        bf16=True,
        logging_steps=10,
    ),
)
trainer.train()
```

### DPO (Direct Preference Optimization)

```python
from trl import DPOTrainer, DPOConfig

# Dataset format: {"prompt": str, "chosen": str, "rejected": str}
dataset = load_dataset("trl-lib/ultrafeedback_binarized", split="train")

trainer = DPOTrainer(
    model=model,
    ref_model=None,       # None = use implicit reference (PEFT LoRA)
    tokenizer=tokenizer,
    train_dataset=dataset,
    args=DPOConfig(
        output_dir="outputs/dpo",
        beta=0.1,          # KL penalty coefficient
        max_length=1024,
        max_prompt_length=512,
        per_device_train_batch_size=2,
        gradient_accumulation_steps=4,
        learning_rate=5e-6,
        num_train_epochs=1,
        bf16=True,
    ),
)
trainer.train()
```

### GRPO (Group Relative Policy Optimization) — Reasoning Models

See `templates/basic_grpo_training.py` for the full production-ready GRPO template.

```python
from trl import GRPOTrainer, GRPOConfig

def correctness_reward(prompts, completions, answer, **kwargs):
    """Return reward based on answer correctness."""
    return [1.0 if extract_answer(c[0]["content"]) == a else 0.0
            for c, a in zip(completions, answer)]

def format_reward(completions, **kwargs):
    """Reward proper <reasoning>/<answer> XML format."""
    import re
    pattern = r'<reasoning>.*?</reasoning>\s*<answer>.*?</answer>'
    return [0.5 if re.search(pattern, c[0]["content"], re.DOTALL) else 0.0
            for c in completions]

trainer = GRPOTrainer(
    model=model,
    processing_class=tokenizer,
    reward_funcs=[format_reward, correctness_reward],
    args=GRPOConfig(
        output_dir="outputs/grpo",
        num_generations=8,          # completions sampled per prompt
        max_prompt_length=256,
        max_completion_length=512,
        per_device_train_batch_size=1,
        gradient_accumulation_steps=4,
        learning_rate=5e-6,
        num_train_epochs=1,
        bf16=True,
        use_vllm=True,              # fast rollouts (requires vLLM on Linux)
    ),
    train_dataset=dataset,
)
trainer.train()
```

## Multi-GPU Training

```bash
# 2 GPUs with accelerate
accelerate launch --num_processes 2 train.py

# With DeepSpeed ZeRO-2
accelerate launch --config_file deepspeed_z2.yaml train.py
```

## LoRA / QLoRA Integration

```python
from peft import LoraConfig, get_peft_model
from transformers import BitsAndBytesConfig

# 4-bit quantization (QLoRA)
bnb_config = BitsAndBytesConfig(
    load_in_4bit=True,
    bnb_4bit_quant_type="nf4",
    bnb_4bit_compute_dtype=torch.bfloat16,
)
model = AutoModelForCausalLM.from_pretrained(
    "meta-llama/Llama-3.2-3B-Instruct",
    quantization_config=bnb_config,
    device_map="auto",
)

lora_config = LoraConfig(
    r=16, lora_alpha=32,
    target_modules=["q_proj", "v_proj", "k_proj", "o_proj",
                    "gate_proj", "up_proj", "down_proj"],
    lora_dropout=0.05, task_type="CAUSAL_LM",
)
model = get_peft_model(model, lora_config)
```

## References

| File | Contents |
|------|----------|
| `references/sft-training.md` | SFTTrainer config, dataset formats, packing |
| `references/dpo-variants.md` | DPO, IPO, KTO, ORPO comparisons and configs |
| `references/grpo-training.md` | GRPO full guide, reward functions, vLLM rollouts |
| `references/reward-modeling.md` | RewardTrainer, preference data collection |
| `references/online-rl.md` | PPO, online DPO, iterative training |
| `templates/basic_grpo_training.py` | Ready-to-run GRPO training script with reward functions |
