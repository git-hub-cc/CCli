---
name: llama-train
description: "Perform LoRA fine-tuning using llama.cpp's training tools."
version: 1.0.0
author: Hermes Agent
license: MIT
platforms: [windows, linux, macos]
metadata:
  hermes:
    tags: [finetuning, lora, Windows, CLI, training, gguf]
prerequisites:
  commands: [llama-train-text-from-scratch, llama-export-lora]
---

# llama-train (LoRA Fine-tuning)

Use the built-in training binaries of `llama.cpp` to perform lightweight LoRA fine-tuning entirely locally on Windows. This replaces heavy frameworks like Axolotl or Unsloth.

## Prerequisites

- **Windows** environment
- Install: `scoop install llama.cpp`
- Training data prepared in plain text format.

## When to Use

- User requests to fine-tune a model on local text data.
- Creating a LoRA adapter without relying on Python, PyTorch, or CUDA toolkits.
- Extremely resource-constrained training setups.

## Quick Reference

### 1. Run LoRA Training

```bash
llama-train-text-from-scratch \
  --model-base models/llama-3-8b.gguf \
  --train-data data/train.txt \
  --lora-out lora-adapter.bin \
  --save-every 10 \
  --threads 8 \
  --ctx 512
```

### 2. Export / Merge LoRA (Optional)

```bash
llama-export-lora \
  --model-base models/llama-3-8b.gguf \
  --lora lora-adapter.bin \
  --model-out models/llama-3-8b-finetuned.gguf
```

## Rules

1. Ensure the training data is pre-processed into a clean, utf-8 text file before initiating training.
2. Adjust `--threads` according to the host CPU cores to prevent system freeze.
3. LoRA training via `llama.cpp` is primarily CPU-bound; manage user expectations regarding training speed compared to GPU-bound Unsloth on Linux.
```