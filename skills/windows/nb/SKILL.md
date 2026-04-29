---
name: nb
description: "Manage notes via nb CLI: create, search, edit."
version: 1.0.0
author: Hermes Agent
license: MIT
platforms: [windows, linux, macos]
metadata:
  hermes:
    tags: [Notes, Windows, CLI, note-taking, markdown, git]
    related_skills: [obsidian]
prerequisites:
  commands: [nb]
---

# nb (Note-Taking)

Use `nb` to manage plain text and Markdown notes directly from the terminal. Notes can be synced via Git.

## Prerequisites

- **Windows** environment
- Install: `scoop install nb`
- Git (optional, for versioning and sync)

## When to Use

- User asks to create, view, or search local notes
- Saving information to a lightweight text/markdown system
- Organizing notes into notebooks
- Exporting notes or managing pure CLI knowledge base

## When NOT to Use

- Obsidian vault management → use the `obsidian` skill
- Quick agent-only memory states → use the `memory` tool instead

## Quick Reference

### View Notes

```bash
nb ls                             # List all notes
nb ls "Notebook Name"             # List notes in a notebook
nb search "query"                 # Search notes content
```

### Create Notes

```bash
nb add "Note content here"        # Quick add a note
nb add -t "Note Title" "Content"  # Quick add with title
```

### Edit Notes

```bash
nb edit <id>                      # Open note in default CLI editor
nb set <id> "New content"         # Overwrite note content
```

### Delete Notes

```bash
nb delete <id>                    # Delete note by ID
```

### Notebooks (Folders)

```bash
nb notebooks                      # List all notebooks
nb notebooks add "Work"           # Create a notebook
```

## Limitations

- Pure text/markdown focus, no native image rendering in CLI
- Interactive editor requires terminal access (use `pty=true` if needed)

## Rules

1. Prefer `nb` when user wants a lightweight, fast local note system.
2. Use the `memory` tool for agent-internal states that don't need user visibility.
3. Use the `obsidian` skill for rich, bidirectional knowledge management.