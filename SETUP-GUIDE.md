# Simple Setup Guide: CCR + GSD Autopilot

## What You're Getting

This lets you run GSD autopilot with **different AI models for different phases**. Use cheap models (GLM-4.7, ~$0.10/phase) for simple work and expensive models (Opus, ~$2/phase) only for complex phases. **Save ~50% on costs!**

---

## Step 1: Install CCR (5 minutes)

Open your terminal and run:

```bash
# Clone CCR
git clone https://github.com/musistudio/claude-code-router.git

# Go into directory
cd claude-code-router

# Install
npm install

# Link globally (so you can use 'ccr' command anywhere)
npm link
```

✅ **Test it worked:**
```bash
ccr --help
```
You should see CCR commands. If not, restart your terminal.

---

## Step 2: Get API Keys (5 minutes)

You need at least **one** API key. Get them from:

1. **Anthropic** (Claude models) - https://console.anthropic.com/
   - Get your API key

2. **Z-AI** (GLM-4.7 - super cheap) - https://open.bigmodel.cn/
   - Sign up, get API key from dashboard

3. **OpenRouter** (Multiple models) - https://openrouter.ai/keys
   - Sign up, get API key

**Minimum needed:** Just Anthropic key to start. Add others later for savings.

---

## Step 3: Configure CCR (3 minutes)

Create the config file:

```bash
mkdir -p ~/.claude-code-router
nano ~/.claude-code-router/config.json
```

**Paste this template** (replace `YOUR_API_KEY` with your actual keys):

```json
{
  "APIKEY": "YOUR_ANTHROPIC_KEY_HERE",
  "LOG": true,
  "Providers": [
    {
      "name": "anthropic",
      "api_base_url": "https://api.anthropic.com",
      "api_key": "YOUR_ANTHROPIC_KEY_HERE",
      "models": ["claude-3-5-sonnet-latest", "claude-3-5-opus-latest"]
    }
  ],
  "Router": {
    "default": "anthropic,claude-3-5-sonnet-latest"
  }
}
```

**Save** (Ctrl+X, Y, Enter in nano)

---

## Step 4: Start CCR Service (1 minute)

```bash
# Start the router
ccr start
```

✅ **Test it's working:**
```bash
curl http://127.0.0.1:3456/health
```
Should return `{"status":"ok"}`

Keep this terminal open! CCR needs to stay running.

---

## Step 5: Create GSD Project (2 minutes)

Open **Claude Code** and run:

```bash
/gsd:new-project
```

Answer the questions about your project.

---

## Step 6: Customize Models Per Phase (5 minutes)

After creating the project, edit the model config:

```bash
nano .planning/phase-models.json
```

**Change the models** based on your needs. Example:

```json
{
  "default_model": "claude-3-5-sonnet-latest",
  "phases": {
    "1": {
      "model": "claude-3-5-sonnet-latest",
      "reasoning": "Setup - use reliable Sonnet"
    },
    "2": {
      "model": "claude-3-5-opus-latest", 
      "reasoning": "Complex work - use powerful Opus"
    },
    "3": {
      "model": "claude-3-5-sonnet-latest",
      "reasoning": "Standard dev - use Sonnet"
    }
  }
}
```

**Save** (Ctrl+X, Y, Enter)

---

## Step 7: Run Autopilot! (30 seconds)

In Claude Code:

```bash
/gsd:autopilot
```

It will show you the plan. Copy the command it gives you.

---

## Step 8: Execute in Separate Terminal (1 minute)

**Open a NEW terminal** (keep the first one running CCR):

```bash
# Go to your project
cd /path/to/your/project

# Run the autopilot script
bash .planning/autopilot.sh
```

**Watch it work!** The display will show which model is used for each phase.

---

## That's It! 🎉

Your autopilot is now running with **per-phase model selection**.

### What You'll See

```
PHASE 2: Core Implementation
[INFO] Configured CCR for model: claude-3-5-opus-latest via anthropic
[INFO] Executing phase 2

PHASE 3: Testing
[INFO] Configured CCR for model: claude-3-5-sonnet-latest via anthropic
[INFO] Executing phase 3
```

### Cost Example

After completion, you'll see:
```
Phases: 3 completed
Cost: $1.25
```

vs. ~$3.50 using only Opus = **64% savings!**

---

## Adding More Providers (Later)

Want to use GLM-4.7 for even more savings?

**1. Get Z-AI key** from https://open.bigmodel.cn/

**2. Update CCR config:**

```json
{
  "APIKEY": "YOUR_ZAI_KEY_HERE",
  "Providers": [
    {
      "name": "anthropic",
      "api_base_url": "https://api.anthropic.com", 
      "api_key": "YOUR_ANTHROPIC_KEY_HERE",
      "models": ["claude-3-5-sonnet-latest", "claude-3-5-opus-latest"]
    },
    {
      "name": "z-ai",
      "api_base_url": "https://open.bigmodel.cn/api/paas/v4/",
      "api_key": "YOUR_ZAI_KEY_HERE",
      "models": ["glm-4.7"]
    }
  ],
  "Router": {
    "default": "anthropic,claude-3-5-sonnet-latest",
    "background": "z-ai,glm-4.7"
  }
}
```

**3. Restart CCR:**
```bash
ccr restart
```

**4. Update phase models:**
```json
{
  "phases": {
    "1": { "model": "claude-3-5-sonnet-latest" },
    "2": { "model": "claude-3-5-opus-latest" },
    "3": { "model": "glm-4.7" },
    "gaps": { "model": "glm-4.7" }
  }
}
```

Now GLM-4.7 (~$0.10/phase) handles simple work!

---

## Quick Reference

### Commands
```bash
# Install CCR
git clone https://github.com/musistudio/claude-code-router.git && cd claude-code-router && npm install && npm link

# Start CCR (keep this running)
ccr start

# Test CCR
curl http://127.0.0.1:3456/health

# Restart CCR after config changes
ccr restart

# Check CCR status
ccr status
```

### Files
```
~/.claude-code-router/config.json  - CCR configuration
.planning/phase-models.json        - GSD per-phase models
.planning/autopilot.sh             - Generated autopilot script
.planning/logs/autopilot.log       - Execution logs
```

### What Each Model Costs (Rough Estimates)
- **claude-3-5-sonnet-latest**: ~$0.50/phase
- **claude-3-5-opus-latest**: ~$2.00/phase
- **glm-4.7**: ~$0.10/phase

### Troubleshooting

**"ccr: command not found"**
- Restart terminal, or run `source ~/.zshrc` / `source ~/.bashrc`
- Verify install: `which ccr`

**"CCR not detected"**
- Make sure CCR is running: `ccr start`
- Check port: `curl http://127.0.0.1:3456/health`

**"Model not available"**
- Verify model in CCR config: `cat ~/.claude-code-router/config.json | grep models`
- Check API key is valid

**Phase models file missing**
- Run `/gsd:autopilot` again to regenerate
- Or copy template: `cp ~/.claude/get-shit-done/templates/phase-models-template.json .planning/phase-models.json`

---

## Next Steps

1. **Test on a small project** first to get comfortable
2. **Monitor costs** in the logs - tweak models to optimize
3. **Add more providers** (Z-AI, OpenRouter) for maximum savings
4. **Read the full docs** at `get-shit-done/references/ccr-integration.md` for advanced features

**Happy automating!** 🚀
