---
name: ntfy
description: "Send push notifications to user devices via ntfy."
version: 1.0.0
author: Hermes Agent
license: MIT
platforms: [windows, linux, macos]
metadata:
  hermes:
    tags: [ntfy, push, notification, alerts, Windows, CLI]
prerequisites:
  commands: [ntfy]
---

# ntfy (Push Notifications)

Use `ntfy` to send push notifications to the user's mobile devices or other endpoints via HTTP Pub/Sub.

## Prerequisites

- **Windows** environment
- Install: `scoop install ntfy`
- User must be subscribed to the target topic on their mobile device (via ntfy app).

## When to Use

- User asks the agent to "ping my phone" or "send me an alert"
- Pushing warnings, task completion status, or location data to the user
- Device interconnection and signaling

## When NOT to Use

- Hardware-level location tracking (ntfy is for messaging, not GPS tracking)
- Complex two-way conversational messaging → use Signal-cli or similar

## Quick Reference

### Send Basic Notification

```bash
ntfy publish my_topic "Your task has finished!"
```

### Send with Title and Priority

```bash
ntfy publish \
  --title "Server Alert" \
  --priority high \
  my_topic "CPU usage is over 90%"
```

### Send with Tags (Emojis)

```bash
ntfy publish --tags warning,skull my_topic "Critical error"
```

### Send with Actions (Buttons)

```bash
ntfy publish \
  --action "view, Open Site, [https://example.com](https://example.com)" \
  my_topic "Deployment complete"
```

## Limitations

- This is a one-way push notification system (Pub/Sub).
- Topics are public by default unless authenticated server is configured. Do not send sensitive passwords over public topics.

## Rules

1. Verify the user's topic name before sending.
2. Use appropriate priorities (`min`, `low`, `default`, `high`, `urgent`).
3. For "Find My" replacement scenarios, use `ntfy` to trigger a loud alert on the phone (`--priority urgent`).