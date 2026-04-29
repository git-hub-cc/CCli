---
name: signal-cli
description: Send and receive encrypted messages via signal-cli on Windows.
version: 1.0.0
author: Hermes Agent
license: MIT
platforms: [windows, linux, macos]
metadata:
  hermes:
    tags: [Signal, SMS, messaging, Windows, CLI, encryption]
prerequisites:
  commands: [signal-cli]
---

# Signal CLI

Use `signal-cli` to read and send end-to-end encrypted messages via the Signal protocol.

## Prerequisites

- **Windows** environment
- Install: `scoop install signal-cli`
- Device linked or registered via `signal-cli` (`signal-cli -a +YOUR_NUMBER link`)

## When to Use

- User asks to send a secure message
- Reading chat history or checking recent messages
- Sending attachments to Signal contacts

## When NOT to Use

- Sending unencrypted standard SMS (Signal CLI dropped SMS support, it is only for Signal messages)
- Telegram/Discord/Slack/WhatsApp messages → use the appropriate gateway channel
- Bulk/mass messaging → always confirm with user first

## Quick Reference

*(Assuming default account is configured or specified with `-a +YOUR_NUMBER`)*

### Receive / Fetch Messages

```bash
signal-cli receive --json
```

### Send Messages

```bash
# Text only
signal-cli send -m "Hello!" +14155551212

# With attachment
signal-cli send -m "Check this out" -a /path/to/image.jpg +14155551212
```

### Groups

```bash
# List groups
signal-cli listGroups

# Send to group (using group ID)
signal-cli send -m "Hi group" -g GROUP_ID
```

## JSON Output parsing

Use the `--json` flag for all read operations so the agent can accurately parse incoming messages, sender profiles, and timestamps.

## Rules

1. **Always confirm recipient and message content** before sending
2. **Never send to unknown numbers** without explicit user approval
3. **Verify file paths** exist before attaching
4. **Rate limits:** Signal enforces rate limits, do not loop message sending.

## Example Workflow

User: "Message mom that I'll be late on Signal"

```bash
# 1. Look up contact or use provided number
# 2. Confirm with user: "Found Mom. Send 'I'll be late' via Signal?"
# 3. Send after confirmation
signal-cli send -m "I'll be late" +1555123456
```