---
name: ollama-eval
description: "Run lightweight model evaluation and prompt testing via Ollama."
version: 1.0.0
author: Hermes Agent
license: MIT
platforms: [windows, linux, macos]
metadata:
  hermes:
    tags: [evaluation, testing, Windows, CLI, ollama]
prerequisites:
  commands: [ollama]
---

# Ollama (Evaluation & Testing)

Use `ollama` to quickly load models and run batch prompts for evaluation. This replaces heavy academic evaluation harnesses (like lm-evaluation-harness) with a nimble, scriptable interface.

## Prerequisites

- **Windows** environment
- Install: `scoop install ollama`
- The target model must be pulled (`ollama pull <model>`) or built via Modelfile.

## When to Use

- Running a predefined set of prompts to test model output quality.
- Comparing outputs between two different local models.
- Rapid prototyping of system prompts via `Modelfile`.

## When NOT to Use

- Strict academic benchmark scoring (MMLU, HumanEval) which requires exact datasets and harness logic.

## Quick Reference

### Run a Single Eval Prompt

```bash
ollama run llama3 "Explain quantum computing in one sentence."
```

### Batch Evaluation via CLI Pipeline

```bash
# Agent can pipe a file of prompts into ollama for sequential evaluation
cat prompts.txt | ollama run llama3
```

### Create an Eval-Specific Modelfile

```text
FROM llama3
SYSTEM "You are an evaluator. Grade the following response from 1 to 10."
```
```bash
ollama create eval-model -f Modelfile
ollama run eval-model "..."
```

## Rules

1. Before running evals, use `ollama list` to verify the requested model exists locally.
2. For programmatic evaluation, use the Ollama REST API (`http://localhost:11434/api/generate`) via curl to get structured JSON outputs.
3. Keep the evaluation dataset small; this is intended for lightweight testing, not full-scale academic benchmarking.
```

---