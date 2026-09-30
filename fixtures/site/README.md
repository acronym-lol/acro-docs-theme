---
title: Sampler
last_reviewed: 2026-09-30
---

# Sampler

Every element a documentation page can use, so the theme can be judged in one place. This paragraph is DM Sans at a readable measure, with `inline code` in mono.

## Callouts

> [!NOTE]
> A note is neutral: context worth knowing that changes nothing.

> [!TIP]
> A tip is green: a better way to do something you were already doing.

> [!INFO]
> Info is blue: a fact about how the system behaves.

> [!WARNING]
> A warning is amber: you can do this, but understand the consequence first.

> [!DANGER]
> Danger is amber with a heavier edge: this breaks things or loses data.

## Code

```python
from acro_audio import Engine

engine = Engine(port=7400, sample_rate=48_000)  # comment
engine.add_source("ambience", gain=-6.0, loop=True)
```

## Tables

| Parameter     | Type  | Default | Description                    |
| ------------- | ----- | ------- | ------------------------------ |
| `port`        | int   | `7400`  | OSC port the engine listens on |
| `sample_rate` | int   | `48000` | Must match the audio device    |

> A plain quote, set aside from the text around it.

---

### A third-level heading

Text after a divider.
