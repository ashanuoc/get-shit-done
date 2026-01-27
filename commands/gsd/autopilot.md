---
name: gsd:autopilot
description: Fully automated milestone execution from existing roadmap
argument-hint: "[--from-phase N] [--dry-run] [--background] [--model file.json]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
  - AskUserQuestion
---

<objective>
Generate and run a shell script that autonomously executes all remaining phases in the current milestone.

Each phase: plan → execute → verify → handle gaps → next phase.

The shell script outer loop provides infinite context (each `claude -p` gets fresh 200k). State persists in `.planning/` enabling resume after interruption.

**Requires:** `.planning/ROADMAP.md` (run `/gsd:new-project` first)
</objective>

<execution_context>
@~/.claude/get-shit-done/references/ui-brand.md
@~/.claude/get-shit-done/templates/autopilot-script.sh
</execution_context>

<context>
Arguments: $ARGUMENTS

**Flags:**
- `--from-phase N` — Start from specific phase (default: first incomplete)
- `--dry-run` — Generate script but don't run it
- `--background` — Run detached with nohup (default: attached with streaming output)
- `--model file.json` — Use custom phase models config (default: .planning/phase-models.json)
</context>

**Model Configuration:**

The autopilot supports per-phase model selection via CCR (Claude Code Router). When CCR is detected:
1. Creates `.planning/phase-models.json` from template (first run)
2. Allows custom model per phase for different task types
3. Falls back to native `claude` command if CCR unavailable

Example configuration structure:
```json
{
  "default_model": "claude-3-5-sonnet-latest",
  "phases": {
    "1": { "model": "claude-3-5-sonnet-latest" },
    "2": { "model": "claude-3-5-opus-latest" },
    "gaps": { "model": "claude-3-5-sonnet-latest" }
  },
  "provider_routing": {
    "claude-3-5-sonnet-latest": {
      "provider": "anthropic",
      "base_url": "https://api.anthropic.com"
    },
    "glm-4.7": {
      "provider": "z-ai",
      "base_url": "https://open.bigmodel.cn/api/paas/v4/"
    }
  }
}
```

**Benefits:**
- Use expensive models (Opus) only for complex phases
- Use GLM-4.7 for cost-effective routine tasks
- Mix providers (Anthropic + OpenAI + Z-AI) for optimization
- Per-phase routing matches task complexity to model capability

**New: Beautiful Ink TUI**

The autopilot now includes a stunning React/Ink-based terminal UI that provides:

- **Rich visual components** with proper layouts, borders, and spacing
- **Real-time phase progress** with completion tracking
- **Live activity feed** with emoji indicators and color coding
- **Cost and time statistics** with visual progress bars
- **Smooth animations** and transitions
- **Professional terminal graphics** using modern Ink components

**Requirements:** Node.js 16+ for the Ink TUI. Falls back to bash TUI if unavailable.

**Auto-detection:** The autopilot automatically detects and uses the Ink TUI if:
1. Node.js is installed
2. The TUI package is available (installed with GSD)

Otherwise, it gracefully falls back to the classic bash display.

## Example TUI Layout

```
╔═══════════════════════════════════════════════════════════════╗
║     ██████╗ ███████╗██████╗                                     ║
║    ██╔════╝ ██╔════╝██╔══██╗                                    ║
║    ██║  ███╗███████╗██║  ██║                                    ║
║    ██║   ██║╚════██║██║  ██║                                    ║
║    ╚██████╔╝███████║██████╔╝                                     ║
║     ╚═════╝ ╚══════╝╚═════╝                                      ║
║                                                                   ║
║          GET SHIT DONE - AUTOPILOT                                ║
╚═══════════════════════════════════════════════════════════════╝

┌─────────────────────────────────┬─────────────────────────────────┐
│ ┌─────────────────────────────┐ │ ┌─────────────────────────────┐ │
│ │ PHASE 1: Project Setup      │ │ │ Activity Feed               │ │
│ │                             │ │ │                             │ │
│ │ Progress ████████░░░░░ 50%  │ │ │ [14:32:15] 🔧 BUILDING:     │ │
│ │                             │ │ │   src/components/App.tsx    │ │
│ │ Stages                      │ │ │                             │ │
│ │ ✓ RESEARCH                 2m │ │ [14:32:01] ✓ COMMIT:        │ │
│ │ ✓ PLANNING                 1m │ │   Initial commit            │ │
│ │ ○ BUILDING                active│ │                             │ │
│ └─────────────────────────────┘ │ └─────────────────────────────┘ │
└─────────────────────────────────┴─────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ 📊 Execution Stats                              Elapsed: 5m 23s │
│ Phases ██████████████░░░░░░░░░░░░░░░░░░░ 2/5                        │
│ Time   5m 23s (remaining: ~13m)                                  │
│ Tokens: 45,230                Cost: $0.68                        │
└─────────────────────────────────────────────────────────────────┘
```
</context>

<process>

## 1. Validate Prerequisites

```bash
# Check roadmap exists
if [ ! -f .planning/ROADMAP.md ]; then
  echo "ERROR: No roadmap found. Run /gsd:new-project first."
  exit 1
fi

# Check not already running
if [ -f .planning/autopilot.lock ]; then
  PID=$(cat .planning/autopilot.lock)
  if ps -p $PID > /dev/null 2>&1; then
    echo "ERROR: Autopilot already running (PID: $PID)"
    echo "To force restart: rm .planning/autopilot.lock"
    exit 1
  fi
fi
```

## 2. Parse Roadmap State

```bash
# Get incomplete phases
INCOMPLETE=$(grep -E "^- \[ \] \*\*Phase" .planning/ROADMAP.md | sed 's/.*Phase \([0-9.]*\).*/\1/' | tr '\n' ' ')

# Get completed phases
COMPLETED=$(grep -E "^- \[x\] \*\*Phase" .planning/ROADMAP.md | sed 's/.*Phase \([0-9.]*\).*/\1/' | tr '\n' ' ')

# Check autopilot state for resume
if [ -f .planning/STATE.md ]; then
  AUTOPILOT_STATUS=$(grep "^- \*\*Mode:\*\*" .planning/STATE.md | sed 's/.*: //')
  LAST_PHASE=$(grep "^- \*\*Current Phase:\*\*" .planning/STATE.md | sed 's/.*: //')
fi
```

**If no incomplete phases:** Report milestone already complete, offer `/gsd:complete-milestone`.

**If `--from-phase N` specified:** Validate phase exists, use as start point.

**If autopilot was interrupted (Mode: running):** Auto-resume from last phase.

## 3. Load Config

```bash
# Read config values
CHECKPOINT_MODE=$(cat .planning/config.json 2>/dev/null | grep -o '"checkpoint_mode"[[:space:]]*:[[:space:]]*"[^"]*"' | grep -o '"[^"]*"$' | tr -d '"' || echo "queue")
MAX_RETRIES=$(cat .planning/config.json 2>/dev/null | grep -o '"max_retries"[[:space:]]*:[[:space:]]*[0-9]*' | grep -o '[0-9]*$' || echo "3")
BUDGET_LIMIT=$(cat .planning/config.json 2>/dev/null | grep -o '"budget_limit_usd"[[:space:]]*:[[:space:]]*[0-9.]*' | grep -o '[0-9.]*$' || echo "0")
WEBHOOK_URL=$(cat .planning/config.json 2>/dev/null | grep -o '"notify_webhook"[[:space:]]*:[[:space:]]*"[^"]*"' | grep -o '"[^"]*"$' | tr -d '"' || echo "")
MODEL_PROFILE=$(cat .planning/config.json 2>/dev/null | grep -o '"model_profile"[[:space:]]*:[[:space:]]*"[^"]*"' | grep -o '"[^"]*"$' | tr -d '"' || echo "balanced")
```

**Check for CCR availability:**
```bash
if command -v ccr &> /dev/null; then
  CCR_AVAILABLE=true
  if [ ! -f .planning/phase-models.json ]; then
    # Copy template
    cp ~/.claude/get-shit-done/templates/phase-models-template.json .planning/phase-models.json
    echo "Created .planning/phase-models.json from template"
  fi
else
  CCR_AVAILABLE=false
fi
```

**Load model configuration:**
```bash
if [ "$CCR_AVAILABLE" = true ] && [ -f .planning/phase-models.json ]; then
  PHASE_MODELS_CONFIG=".planning/phase-models.json"
else
  PHASE_MODELS_CONFIG=""
fi
```

## 4. Present Execution Plan

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► AUTOPILOT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Milestone:** [from ROADMAP.md]

| Status | Phases |
|--------|--------|
| ✓ Complete | {completed_phases} |
| ○ Remaining | {incomplete_phases} |

**Settings:**
- Checkpoint mode: {queue|skip}
- Max retries: {N}
- Budget limit: ${N} (0 = unlimited)
- Notifications: {webhook|bell|none}
- Model Routing: {CCR|native claude}

───────────────────────────────────────────────────────────────

**Model Configuration:**
{if CCR_AVAILABLE}
Available models from .planning/phase-models.json:
- Default: {default_model}
- Per-phase routing: enabled
{/if}
{if !CCR_AVAILABLE}
Using native claude command (CCR not detected)
{/if}

───────────────────────────────────────────────────────────────

**Execution Plan:**

For each remaining phase:
1. Load model config for phase
2. Plan phase (if no plans exist)
3. Execute phase (parallel waves)
4. Verify phase goal
5. If gaps found → plan gaps → execute gaps → re-verify
6. Move to next phase

Checkpoints queued to: `.planning/checkpoints/pending/`

───────────────────────────────────────────────────────────────
```

## 5. Generate Script

Read template from `@~/.claude/get-shit-done/templates/autopilot-script.sh` and fill:
- `{{project_dir}}` — Current directory (absolute path)
- `{{project_name}}` — From PROJECT.md
- `{{phases}}` — Array of incomplete phase numbers
- `{{checkpoint_mode}}` — queue or skip
- `{{max_retries}}` — From config
- `{{budget_limit}}` — From config (0 = unlimited)
- `{{webhook_url}}` — From config (empty = disabled)
- `{{model_profile}}` — From config
- `{{timestamp}}` — Current datetime

Write to `.planning/autopilot.sh`:
```bash
mkdir -p .planning/logs .planning/checkpoints/pending .planning/checkpoints/approved
chmod +x .planning/autopilot.sh
```

**Ensure gitignore entries exist** (autopilot transient files should not be committed):
```bash
# Add to .gitignore if not already present
GITIGNORE_ENTRIES="
# GSD autopilot (transient files)
.planning/autopilot.sh
.planning/autopilot.lock
.planning/logs/
.planning/checkpoints/
.planning/phase-models.json
"

if [ -f .gitignore ]; then
  if ! grep -q "GSD autopilot" .gitignore; then
    echo "$GITIGNORE_ENTRIES" >> .gitignore
  fi
else
  echo "$GITIGNORE_ENTRIES" > .gitignore
fi
```

**Copy phase models template:**
```bash
if [ -n "$PHASE_MODELS_CONFIG" ] && [ ! -f ".planning/phase-models.json" ]; then
  cp ~/.claude/get-shit-done/templates/phase-models-template.json \
     .planning/phase-models.json
  echo "Created .planning/phase-models.json from template"
  echo "Edit this file to customize per-phase model selection"
fi
```

**Update gitignore for phase models:**
```bash
if ! grep -q "phase-models.json" .gitignore; then
  echo ".planning/phase-models.json" >> .gitignore
fi
```

## 6. Present Run Instructions

**IMPORTANT:** The autopilot script must run **outside** of Claude Code in a separate terminal. Claude Code's Bash tool has a 10-minute timeout which would interrupt long-running execution.

Present the following:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► AUTOPILOT READY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Script generated: .planning/autopilot.sh
Model config: {if CCR_AVAILABLE}.planning/phase-models.json{else}CCR not detected - using default model{endif}

───────────────────────────────────────────────────────────────

## Run in a separate terminal

**Attached (recommended — see output live):**
```
cd {project_dir} && bash .planning/autopilot.sh
```

**Background (for overnight runs):**
```
cd {project_dir} && nohup bash .planning/autopilot.sh > .planning/logs/autopilot.log 2>&1 &
```

**With CCR model routing:**
```
cd {project_dir} && ccr code --model {default_model} -- bash .planning/autopilot.sh
```

**Monitor logs:**
```
tail -f .planning/logs/autopilot.log
```

───────────────────────────────────────────────────────────────

**Model Selection:**
- Phase models configured in .planning/phase-models.json
- CCR detected: {if CCR_AVAILABLE}Yes - using per-phase routing{else}No - using native claude{endif}
- Edit phase-models.json to customize models per phase

**Why a separate terminal?**
Claude Code's Bash tool has a 10-minute timeout. Autopilot runs for
hours across multiple phases — it needs to run independently.

**Resume after interruption:**
Just run the script again. It detects completed phases and continues.

**Check on checkpoints:**
`/gsd:checkpoints` — review and approve any pending human input

───────────────────────────────────────────────────────────────
```

## 7. Update State

Before presenting instructions, update STATE.md to mark autopilot as ready:

```markdown
## Autopilot

- **Mode:** running
- **Started:** [timestamp]
- **Current Phase:** [first phase]
- **Phases Remaining:** [list]
- **Checkpoints Pending:** (none yet)
- **Last Error:** none
```

</process>

<checkpoint_queue>
Plans with `autonomous: false` pause at checkpoints.

**Queue structure:**
```
.planning/checkpoints/
├── pending/
│   └── phase-03-plan-02.json    # Waiting for user
└── approved/
    └── phase-03-plan-02.json    # User approved, ready to continue
```

**Pending checkpoint format:**
```json
{
  "phase": "03",
  "plan": "02",
  "plan_name": "OAuth Integration",
  "checkpoint_type": "auth-gate",
  "awaiting": "OAuth client credentials for Google",
  "context": "Plan paused after task 2. Tasks 3-4 require OAuth setup.",
  "created": "2026-01-26T14:30:00Z",
  "completed_tasks": [
    {"task": 1, "commit": "abc123", "name": "Create OAuth service skeleton"},
    {"task": 2, "commit": "def456", "name": "Add Google OAuth config structure"}
  ]
}
```

**Approved checkpoint format:**
```json
{
  "phase": "03",
  "plan": "02",
  "approved": true,
  "response": "Client ID: xxx, Secret: yyy",
  "approved_at": "2026-01-26T15:00:00Z"
}
```

**Workflow:**
1. Executor hits checkpoint → writes to `pending/`
2. Autopilot logs checkpoint, continues with other phases
3. User reviews `pending/` (manually or via `/gsd:checkpoints`)
4. User creates approval in `approved/`
5. Next autopilot run (or current if phase revisited) picks up approval
6. Continuation agent spawned with approval context
</checkpoint_queue>

<cost_tracking>
Track token usage for budget enforcement:

**Per-phase logging:**
After each `claude -p` call, parse output for token counts:
```bash
# Extract from claude -p output (format varies)
TOKENS=$(grep -o 'tokens: [0-9]*' "$LOG_FILE" | tail -1 | grep -o '[0-9]*')
```

**Accumulate in state:**
```markdown
## Cost Tracking

| Phase | Tokens | Est. Cost |
|-------|--------|-----------|
| 1 | 45,230 | $0.68 |
| 2 | 62,100 | $0.93 |
| Total | 107,330 | $1.61 |
```

**Budget check:**
```bash
if [ "$BUDGET_LIMIT" -gt 0 ]; then
  TOTAL_COST=$(calculate_cost)
  if (( $(echo "$TOTAL_COST > $BUDGET_LIMIT" | bc -l) )); then
    notify "Budget exceeded: \$$TOTAL_COST / \$$BUDGET_LIMIT"
    update_state "paused" "budget_exceeded"
    exit 0
  fi
fi
```
</cost_tracking>

<notifications>
**Terminal bell:**
```bash
echo -e "\a"  # On completion or error
```

**Webhook:**
```bash
notify() {
  local message="$1"
  local status="${2:-info}"

  if [ -n "$WEBHOOK_URL" ]; then
    curl -s -X POST "$WEBHOOK_URL" \
      -H "Content-Type: application/json" \
      -d "{\"text\": \"GSD Autopilot: $message\", \"status\": \"$status\"}" \
      > /dev/null 2>&1
  fi

  # Always terminal bell
  echo -e "\a"
}
```

**Notification triggers:**
- Phase complete
- Checkpoint queued
- Error/retry
- Budget warning (80%)
- Budget exceeded
- Milestone complete
</notifications>

<success_criteria>
- [ ] Roadmap exists validation
- [ ] Lock file prevents concurrent runs
- [ ] Incomplete phases parsed from ROADMAP.md
- [ ] Resume detection from STATE.md
- [ ] Config loaded (checkpoint mode, retries, budget, webhook)
- [ ] Execution plan presented clearly
- [ ] User confirms before running
- [ ] Script generated with project-specific values
- [ ] Execution mode matches user choice
- [ ] STATE.md updated with autopilot section
- [ ] Logs written to .planning/logs/
</success_criteria>
