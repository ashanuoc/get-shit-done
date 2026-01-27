# Simple Autopilot Model Selection Flow

## The Right Way

**Not asked during project creation** (only if you use autopilot)
**Asked when running `/gsd:autopilot`** (when you actually need it)

---

## Flow 1: Normal Project (No Autopilot)

```
1. /gsd:new-project
   → No model questions asked
   
2. Work normally:
   /gsd:plan-phase 1
   /gsd:execute-phase 1
   
3. Never use autopilot
   → No model selection needed
```

---

## Flow 2: Autopilot Project

```
1. /gsd:new-project
   → No model questions asked
   
2. /gsd:autopilot
   → PROMPTS: "Which model for autopilot?"
   
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
   
3. User picks: Claude 3.5 Sonnet
   
4. .planning/config.json updated:
   {"autopilot": {"model": "claude-3-5-sonnet-latest"}}
   
5. Autopilot script generated with model
   
6. bash .planning/autopilot.sh
   → Uses selected model
```

---

## Benefits

✅ **Not annoying** - Only asked if you use autopilot
✅ **Optional** - Skip if you don't need it
✅ **Discoverable** - Asked at the right time
✅ **Flexible** - Change model anytime

---

## Implementation

**Modified:**
1. `/gsd:new-project` - REMOVED model question
2. `/gsd:autopilot` - ADD model prompt
3. Autopilot script - Use config value

**No changes needed for normal projects!**
