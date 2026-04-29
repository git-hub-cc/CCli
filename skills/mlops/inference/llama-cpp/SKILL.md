---
name: llama-cpp
description: "Run local LLM inference via llama.cpp (CLI and Server modes)."
version: 1.0.0
author: Hermes Agent
license: MIT
platforms: [windows, linux, macos]
metadata:
  hermes:
    tags: [LLM, inference, Windows, CLI, gguf, openai-api]
prerequisites:
  commands: [llama-cli, llama-server]
---

# llama.cpp (Inference)

Use `llama.cpp` to run local inference for GGUF models. It is highly optimized for CPU and CPU+GPU mixed inference without heavy Python dependencies.

## Prerequisites

- **Windows** environment
- Install: `scoop install llama.cpp`
- A downloaded `.gguf` model file.

## When to Use

- User wants to chat with a local model via terminal.
- Agent needs to spin up a temporary OpenAI-compatible API endpoint for inference.
- Hardware is constrained or pure Windows native execution is required.

## When NOT to Use

- When the model is not in GGUF format (requires conversion first).
- For large scale, multi-node distributed inference (use vLLM on Linux instead).

## Quick Reference

### CLI Interactive Mode

```bash
llama-cli -m models/llama-3-8b.gguf -p "You are a helpful assistant." -cnv
```

### Start OpenAI-Compatible Server

```bash
llama-server -m models/llama-3-8b.gguf --port 8080
```
*(Once started, the agent can send standard OpenAI API REST requests to `http://localhost:8080/v1`)*

## Rules

1. Always verify the `.gguf` file path before executing.
2. Use `-ngl` (number of GPU layers) to offload to GPU if the user specifies GPU acceleration (e.g., `-ngl 33`).
3. If running as a server, ensure the port is not occupied.
```

---