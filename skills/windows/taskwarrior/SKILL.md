---
name: taskwarrior
description: "Manage tasks via taskwarrior CLI: add, list, complete."
version: 1.0.0
author: Hermes Agent
license: MIT
platforms: [windows, linux, macos]
metadata:
  hermes:
    tags: [Taskwarrior, tasks, todo, Windows, CLI]
prerequisites:
  commands: [task]
---

# Taskwarrior

Use `task` to manage to-dos and tasks directly from the terminal. Highly customizable and scriptable.

## Prerequisites

- **Windows** environment
- Install: `scoop install taskwarrior`

## When to Use

- User mentions "reminder", "task", or "todo list"
- Creating personal to-dos with due dates and priorities
- Managing task lists and project tags
- Complex filtering of pending tasks

## When NOT to Use

- Scheduling agent alerts → use the cronjob tool instead
- Calendar events → use Google Calendar integration
- If user says "remind me" but means an agent alert → clarify first

## Quick Reference

### View Tasks

```bash
task next                    # Show most urgent tasks
task list                    # List all pending tasks
task project:Work list       # Show tasks for a specific project
task overdue                 # Past due tasks
task all                     # Everything including completed
```

### Create Tasks

```bash
task add Buy milk
task add Call mom project:Personal due:tomorrow
task add Meeting prep due:2026-02-15T09:00 priority:H
```

### Modify / Complete / Delete

```bash
task 1 modify due:friday          # Change due date for task 1
task 1 done                       # Mark task 1 as complete
task 2 delete                     # Delete task 2
```

### Output Formats

```bash
task export                  # Export all tasks to JSON
task status:pending export   # JSON export of pending tasks
```

## Date Formats

Accepted by `due:` and date filters:
- `today`, `tomorrow`, `yesterday`, `friday`
- `YYYY-MM-DD`
- `YYYY-MM-DDTHH:MM:SS` (ISO 8601)

## Rules

1. When user says "remind me", clarify: Taskwarrior list vs agent cronjob alert
2. Always confirm task content and due date before creating
3. Use `export` to output JSON for programmatic parsing by the agent