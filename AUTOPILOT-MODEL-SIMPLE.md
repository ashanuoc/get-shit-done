# Simple Autopilot Model Selection

## The Problem

When running `/gsd:autopilot`, you want to pick **which model** the bash script uses. But currently it's:
- Not discoverable (no UI prompt)
- Hidden behind CCR complexity
- Mixed up with `model_profile`

## The Solution

### 1. During Project Creation

Added to `/gsd:new-project`:

```
┌─────────────────────────────────────────────┐
│  Autopilot Model                             │
│  Which model should autopilot use?          │
│                                             │
│  ○ Default Model                            │
│    Use your system's default Claude         │
│                                             │
│  ○ Claude 3.5 Sonnet                        │
│    Good balance of quality and cost         │
│                                             │
│  ○ GLM-4.7 (via CCR)                        │
│    Budget option — requires CCR setup       │
└─────────────────────────────────────────────┘
```

### 2. Stored in Config

`.planning/config.json`:
```json
{
  "autopilot_model": "default|claude-3-5-sonnet-latest|glm-4.7"
}
```

### 3. Used in Autopilot Script

Generated `autopilot.sh`:
```bash
# Read from config
AUTOPILOT_MODEL=$(cat .planning/config.json | grep -o '"autopilot_model"[[:space:]]*:[[:space:]]*"[^"]*"' | sed 's/.*: *"\([^"]*\)".*/\1/')

# Use it
echo "/gsd:execute-phase $phase" | claude -p --model "$AUTOPILOT_MODEL"
```

### 4. CCR Only If Needed

If GLM-4.7 selected:
- Show message: "Setup CCR first: [instructions]"
- Autopilot script uses `ccr code --model glm-4.7`

If Claude selected:
- Use native `claude -p --model X`
- No CCR needed

## User Flow

```
1. /gsd:new-project
   → Asked: "Which model for autopilot?"
   → User picks: Claude 3.5 Sonnet
   
2. Config saved: "autopilot_model": "claude-3-5-sonnet-latest"

3. /gsd:autopilot
   → Reads config
   → Generates: echo "command" | claude -p --model claude-3-5-sonnet-latest

4. bash .planning/autopilot.sh
   → Uses selected model
```

## Cost Savings Example

**Default (no selection):**
- Uses whatever claude command you have
- Cost unknown

**With model selection:**
- Pick GLM-4.7: ~$0.10/phase
- Pick Sonnet: ~$0.50/phase
- Pick Opus: ~$2.00/phase

**User knows exactly what they're paying for.**

## Benefits

✅ **Discoverable** - Asked during project creation
✅ **Clear** - Separate from planning quality settings  
✅ **Simple** - No CCR complexity unless GLM-4.7
✅ **Transparent** - See model in config and logs
✅ **Flexible** - Change anytime by editing config.json

## Implementation

**Modified files:**
1. `/gsd:new-project` - Added autopilot model question
2. `autopilot-script.sh` - Read model from config
3. Template - Generate with model flag

**No CCR integration needed** unless GLM-4.7 is selected.

That's it!
