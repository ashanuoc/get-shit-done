# Simple Usage: Just Pick One Model

## What You Want

**Just select ONE model** to use for the entire autopilot run. Simple!

## Method 1: Just Use CCR Directly (Easiest)

### Setup CCR Once (5 min)

```bash
# Install CCR
git clone https://github.com/musistudio/claude-code-router.git
cd claude-code-router && npm install && npm link
```

Create `~/.claude-code-router/config.json`:

```json
{
  "APIKEY": "your-api-key-here",
  "Providers": [
    {
      "name": "anthropic",
      "api_base_url": "https://api.anthropic.com",
      "api_key": "your-anthropic-key",
      "models": ["claude-3-5-sonnet-latest", "claude-3-5-opus-latest"]
    },
    {
      "name": "z-ai",
      "api_base_url": "https://open.bigmodel.cn/api/paas/v4/",
      "api_key": "your-z-ai-key",
      "models": ["glm-4.7"]
    }
  ],
  "Router": {
    "default": "anthropic,claude-3-5-sonnet-latest"
  }
}
```

### Start CCR (keep running)

```bash
ccr start
```

### Run Autopilot With Any Model You Want

**Use GLM-4.7 (cheap):**
```bash
cd /your/project
ccr code --model glm-4.7 -- bash .planning/autopilot.sh
```

**Use Sonnet (balanced):**
```bash
cd /your/project
ccr code --model claude-3-5-sonnet-latest -- bash .planning/autopilot.sh
```

**Use Opus (expensive but powerful):**
```bash
cd /your/project
ccr code --model claude-3-5-opus-latest -- bash .planning/autopilot.sh
```

**That's it!** Just change `--model` to whatever you want.

---

## Method 2: Set Default in Phase Models (Also Simple)

### Edit `.planning/phase-models.json`:

```json
{
  "default_model": "glm-4.7",
  "phases": {
    "1": { "model": "glm-4.7" },
    "2": { "model": "glm-4.7" },
    "3": { "model": "glm-4.7" },
    "gaps": { "model": "glm-4.7" }
  }
}
```

**Change `"default_model"`** to whatever you want:
- `"glm-4.7"` for cheap runs
- `"claude-3-5-sonnet-latest"` for balanced
- `"claude-3-5-opus-latest"` for premium

Then run normally:
```bash
bash .planning/autopilot.sh
```

---

## Method 3: Even Simpler - Just Edit Default

The template defaults to Sonnet. **Just edit one line:**

```bash
# Edit the template once
nano ~/.claude/get-shit-done/templates/phase-models-template.json
```

Change:
```json
"default_model": "claude-3-5-sonnet-latest",
```

To:
```json
"default_model": "glm-4.7",
```

**Now every new project** uses GLM-4.7 by default!

---

## Cost Examples

### Budget Mode (GLM-4.7)
```
Phase 1: $0.10
Phase 2: $0.10
Phase 3: $0.10
Total: $0.30
```

### Balanced Mode (Sonnet)
```
Phase 1: $0.50
Phase 2: $0.50
Phase 3: $0.50
Total: $1.50
```

### Premium Mode (Opus)
```
Phase 1: $2.00
Phase 2: $2.00
Phase 3: $2.00
Total: $6.00
```

**Pick one model, run everything with it. Done!**

---

## Recommended Approach

**For maximum simplicity:**

1. Install CCR
2. Configure with your API keys
3. Just use `ccr code --model YOUR_CHOICE -- bash .planning/autopilot.sh`

**Change model by changing the `--model` flag. That's it!**

No per-phase config needed. No complex JSON. Just pick your model and go.
