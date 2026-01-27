<purpose>
Checkpoint handling extension for execute-plan.md. Load this file when a plan contains checkpoints.
</purpose>

<detection>
Load this file if plan has checkpoints:
```bash
grep -q 'type="checkpoint' .planning/phases/XX-name/{phase}-{plan}-PLAN.md && echo "has_checkpoints"
```
</detection>

<step name="parse_segments">
**Intelligent segmentation: Parse plan into execution segments.**

Plans are divided into segments by checkpoints. Each segment is routed to optimal execution context (subagent or main).

**1. Check for checkpoints:**

```bash
# Find all checkpoints and their types
grep -n "type=\"checkpoint" .planning/phases/XX-name/{phase}-{plan}-PLAN.md
```

**2. Analyze execution strategy:**

**If NO checkpoints found:**

- **Fully autonomous plan** - spawn single subagent for entire plan
- Subagent gets fresh 200k context, executes all tasks, creates SUMMARY, commits
- Main context: Just orchestration (~5% usage)

**If checkpoints found, parse into segments:**

Segment = tasks between checkpoints (or start→first checkpoint, or last checkpoint→end)

**For each segment, determine routing:**

```
Segment routing rules:

IF segment has no prior checkpoint:
  → SUBAGENT (first segment, nothing to depend on)

IF segment follows checkpoint:human-verify:
  → SUBAGENT (verification is just confirmation, doesn't affect next work)

IF segment follows checkpoint:decision OR checkpoint:human-action:
  → MAIN CONTEXT (next tasks need the decision/result)
```

**3. Execution pattern:**

**Pattern A: Fully autonomous (no checkpoints)**

```
Spawn subagent → execute all tasks → SUMMARY → commit → report back
```

**Pattern B: Segmented with verify-only checkpoints**

```
Segment 1 (tasks 1-3): Spawn subagent → execute → report back
Checkpoint 4 (human-verify): Main context → you verify → continue
Segment 2 (tasks 5-6): Spawn NEW subagent → execute → report back
Checkpoint 7 (human-verify): Main context → you verify → continue
Aggregate results → SUMMARY → commit
```

**Pattern C: Decision-dependent (must stay in main)**

```
Checkpoint 1 (decision): Main context → you decide → continue in main
Tasks 2-5: Main context (need decision from checkpoint 1)
No segmentation benefit - execute entirely in main
```

**4. Why segment:** Fresh context per subagent preserves peak quality. Main context stays lean (~15% usage).

**5. Implementation:**

**For fully autonomous plans:**

```
1. Run init_agent_tracking step first (see step below)

2. Use Task tool with subagent_type="gsd-executor" and model="{executor_model}":

   Prompt: "Execute plan at .planning/phases/{phase}-{plan}-PLAN.md

   This is an autonomous plan (no checkpoints). Execute all tasks, create SUMMARY.md in phase directory, commit with message following plan's commit guidance.

   Follow all deviation rules and authentication gate protocols from the plan.

   When complete, report: plan name, tasks completed, SUMMARY path, commit hash."

3. After Task tool returns with agent_id:

   a. Write agent_id to current-agent-id.txt:
      echo "[agent_id]" > .planning/current-agent-id.txt

   b. Append spawn entry to agent-history.json:
      {
        "agent_id": "[agent_id from Task response]",
        "task_description": "Execute full plan {phase}-{plan} (autonomous)",
        "phase": "{phase}",
        "plan": "{plan}",
        "segment": null,
        "timestamp": "[ISO timestamp]",
        "status": "spawned",
        "completion_timestamp": null
      }

4. Wait for subagent to complete

5. After subagent completes successfully:

   a. Update agent-history.json entry:
      - Find entry with matching agent_id
      - Set status: "completed"
      - Set completion_timestamp: "[ISO timestamp]"

   b. Clear current-agent-id.txt:
      rm .planning/current-agent-id.txt

6. Report completion to user
```

**For segmented plans (has verify-only checkpoints):**

```
Execute segment-by-segment:

For each autonomous segment:
  Spawn subagent with prompt: "Execute tasks [X-Y] from plan at .planning/phases/{phase}-{plan}-PLAN.md. Read the plan for full context and deviation rules. Do NOT create SUMMARY or commit - just execute these tasks and report results."

  Wait for subagent completion

For each checkpoint:
  Execute in main context
  Wait for user interaction
  Continue to next segment

After all segments complete:
  Aggregate all results
  Create SUMMARY.md
  Commit with all changes
```

**For decision-dependent plans:**

```
Execute in main context (standard flow below)
No subagent routing
Quality maintained through small scope (2-3 tasks per plan)
```

See step name="segment_execution" for detailed segment execution loop.
</step>

<step name="init_agent_tracking">
**Initialize agent tracking for subagent resume capability.**

Before spawning any subagents, set up tracking infrastructure:

**1. Create/verify tracking files:**

```bash
# Create agent history file if doesn't exist
if [ ! -f .planning/agent-history.json ]; then
  echo '{"version":"1.0","max_entries":50,"entries":[]}' > .planning/agent-history.json
fi

# Clear any stale current-agent-id (from interrupted sessions)
# Will be populated when subagent spawns
rm -f .planning/current-agent-id.txt
```

**2. Check for interrupted agents (resume detection):**

```bash
# Check if current-agent-id.txt exists from previous interrupted session
if [ -f .planning/current-agent-id.txt ]; then
  INTERRUPTED_ID=$(cat .planning/current-agent-id.txt)
  echo "Found interrupted agent: $INTERRUPTED_ID"
fi
```

**If interrupted agent found:**
- The agent ID file exists from a previous session that didn't complete
- This agent can potentially be resumed using Task tool's `resume` parameter
- Present to user: "Previous session was interrupted. Resume agent [ID] or start fresh?"
- If resume: Use Task tool with `resume` parameter set to the interrupted ID
- If fresh: Clear the file and proceed normally

**3. Prune old entries (housekeeping):**

If agent-history.json has more than `max_entries`:
- Remove oldest entries with status "completed"
- Never remove entries with status "spawned" (may need resume)
- Keep file under size limit for fast reads

**When to run this step:**
- Pattern A (fully autonomous): Before spawning the single subagent
- Pattern B (segmented): Before the segment execution loop
- Pattern C (main context): Skip - no subagents spawned
</step>

<step name="segment_execution">
**Detailed segment execution loop for segmented plans.**

**This step applies ONLY to segmented plans (Pattern B: has checkpoints, but they're verify-only).**

For Pattern A (fully autonomous) and Pattern C (decision-dependent), skip this step.

**Execution flow:**

````
1. Parse plan to identify segments:
   - Read plan file
   - Find checkpoint locations: grep -n "type=\"checkpoint" PLAN.md
   - Identify checkpoint types: grep "type=\"checkpoint" PLAN.md | grep -o 'checkpoint:[^"]*'
   - Build segment map:
     * Segment 1: Start → first checkpoint (tasks 1-X)
     * Checkpoint 1: Type and location
     * Segment 2: After checkpoint 1 → next checkpoint (tasks X+1 to Y)
     * Checkpoint 2: Type and location
     * ... continue for all segments

2. For each segment in order:

   A. Determine routing (apply rules from parse_segments):
      - No prior checkpoint? → Subagent
      - Prior checkpoint was human-verify? → Subagent
      - Prior checkpoint was decision/human-action? → Main context

   B. If routing = Subagent:
      ```
      Spawn Task tool with subagent_type="gsd-executor" and model="{executor_model}":

      Prompt: "Execute tasks [task numbers/names] from plan at [plan path].

      **Context:**
      - Read the full plan for objective, context files, and deviation rules
      - You are executing a SEGMENT of this plan (not the full plan)
      - Other segments will be executed separately

      **Your responsibilities:**
      - Execute only the tasks assigned to you
      - Follow all deviation rules and authentication gate protocols
      - Track deviations for later Summary
      - DO NOT create SUMMARY.md (will be created after all segments complete)
      - DO NOT commit (will be done after all segments complete)

      **Report back:**
      - Tasks completed
      - Files created/modified
      - Deviations encountered
      - Any issues or blockers"

      **After Task tool returns with agent_id:**

      1. Write agent_id to current-agent-id.txt:
         echo "[agent_id]" > .planning/current-agent-id.txt

      2. Append spawn entry to agent-history.json:
         {
           "agent_id": "[agent_id from Task response]",
           "task_description": "Execute tasks [X-Y] from plan {phase}-{plan}",
           "phase": "{phase}",
           "plan": "{plan}",
           "segment": [segment_number],
           "timestamp": "[ISO timestamp]",
           "status": "spawned",
           "completion_timestamp": null
         }

      Wait for subagent to complete
      Capture results (files changed, deviations, etc.)

      **After subagent completes successfully:**

      1. Update agent-history.json entry:
         - Find entry with matching agent_id
         - Set status: "completed"
         - Set completion_timestamp: "[ISO timestamp]"

      2. Clear current-agent-id.txt:
         rm .planning/current-agent-id.txt

      ```

   C. If routing = Main context:
      Execute tasks in main using standard execution flow (step name="execute")
      Track results locally

   D. After segment completes (whether subagent or main):
      Continue to next checkpoint/segment

3. After ALL segments complete:

   A. Aggregate results from all segments:
      - Collect files created/modified from all segments
      - Collect deviations from all segments
      - Collect decisions from all checkpoints
      - Merge into complete picture

   B. Create SUMMARY.md:
      - Use aggregated results
      - Document all work from all segments
      - Include deviations from all segments
      - Note which segments were subagented

   C. Commit:
      - Stage all files from all segments
      - Stage SUMMARY.md
      - Commit with message following plan guidance
      - Include note about segmented execution if relevant

   D. Report completion

**Example execution trace:**

````

Plan: 01-02-PLAN.md (8 tasks, 2 verify checkpoints)

Parsing segments...

- Segment 1: Tasks 1-3 (autonomous)
- Checkpoint 4: human-verify
- Segment 2: Tasks 5-6 (autonomous)
- Checkpoint 7: human-verify
- Segment 3: Task 8 (autonomous)

Routing analysis:

- Segment 1: No prior checkpoint → SUBAGENT ✓
- Checkpoint 4: Verify only → MAIN (required)
- Segment 2: After verify → SUBAGENT ✓
- Checkpoint 7: Verify only → MAIN (required)
- Segment 3: After verify → SUBAGENT ✓

Execution:
[1] Spawning subagent for tasks 1-3...
→ Subagent completes: 3 files modified, 0 deviations
[2] Executing checkpoint 4 (human-verify)...
╔═══════════════════════════════════════════════════════╗
║  CHECKPOINT: Verification Required                    ║
╚═══════════════════════════════════════════════════════╝

Progress: 3/8 tasks complete
Task: Verify database schema

Built: User and Session tables with relations

How to verify:
  1. Check src/db/schema.ts for correct types

────────────────────────────────────────────────────────
→ YOUR ACTION: Type "approved" or describe issues
────────────────────────────────────────────────────────
User: "approved"
[3] Spawning subagent for tasks 5-6...
→ Subagent completes: 2 files modified, 1 deviation (added error handling)
[4] Executing checkpoint 7 (human-verify)...
User: "approved"
[5] Spawning subagent for task 8...
→ Subagent completes: 1 file modified, 0 deviations

Aggregating results...

- Total files: 6 modified
- Total deviations: 1
- Segmented execution: 3 subagents, 2 checkpoints

Creating SUMMARY.md...
Committing...
✓ Complete

````

**Benefit:** Each subagent starts fresh (~20-30% context), enabling larger plans without quality degradation.
</step>

<step name="checkpoint_protocol">
When encountering `type="checkpoint:*"`:

**Critical: Claude automates everything with CLI/API before checkpoints.** Checkpoints are for verification and decisions, not manual work.

**Display checkpoint clearly:**

```
╔═══════════════════════════════════════════════════════╗
║  CHECKPOINT: [Type]                                   ║
╚═══════════════════════════════════════════════════════╝

Progress: {X}/{Y} tasks complete
Task: [task name]

[Display task-specific content based on type]

────────────────────────────────────────────────────────
→ YOUR ACTION: [Resume signal instruction]
────────────────────────────────────────────────────────
```

**For checkpoint:human-verify (90% of checkpoints):**

```
Built: [what was automated - deployed, built, configured]

How to verify:
  1. [Step 1 - exact command/URL]
  2. [Step 2 - what to check]
  3. [Step 3 - expected behavior]

────────────────────────────────────────────────────────
→ YOUR ACTION: Type "approved" or describe issues
────────────────────────────────────────────────────────
```

**For checkpoint:decision (9% of checkpoints):**

```
Decision needed: [decision]

Context: [why this matters]

Options:
1. [option-id]: [name]
   Pros: [pros]
   Cons: [cons]

2. [option-id]: [name]
   Pros: [pros]
   Cons: [cons]

[Resume signal - e.g., "Select: option-id"]
```

**For checkpoint:human-action (1% - rare, only for truly unavoidable manual steps):**

```
I automated: [what Claude already did via CLI/API]

Need your help with: [the ONE thing with no CLI/API - email link, 2FA code]

Instructions:
[Single unavoidable step]

I'll verify after: [verification]

[Resume signal - e.g., "Type 'done' when complete"]
```

**After displaying:** WAIT for user response. Do NOT hallucinate completion. Do NOT continue to next task.

**After user responds:**

- Run verification if specified (file exists, env var set, tests pass, etc.)
- If verification passes or N/A: continue to next task
- If verification fails: inform user, wait for resolution

See ~/.claude/get-shit-done/references/checkpoint-execution.md for complete execution protocol and automation reference.
</step>

<step name="checkpoint_return_for_orchestrator">
**When spawned by an orchestrator (execute-phase or execute-plan command):**

If you were spawned via Task tool and hit a checkpoint, you cannot directly interact with the user. Instead, RETURN to the orchestrator with structured checkpoint state so it can present to the user and spawn a fresh continuation agent.

**Return format for checkpoints:**

**Required in your return:**

1. **Completed Tasks table** - Tasks done so far with commit hashes and files created
2. **Current Task** - Which task you're on and what's blocking it
3. **Checkpoint Details** - User-facing content (verification steps, decision options, or action instructions)
4. **Awaiting** - What you need from the user

**Example return:**

```
## CHECKPOINT REACHED

**Type:** human-action
**Plan:** 01-01
**Progress:** 1/3 tasks complete

### Completed Tasks

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Initialize Next.js 15 project | d6fe73f | package.json, tsconfig.json, app/ |

### Current Task

**Task 2:** Initialize Convex backend
**Status:** blocked
**Blocked by:** Convex CLI authentication required

### Checkpoint Details

**Automation attempted:**
Ran `npx convex dev` to initialize Convex backend

**Error encountered:**
"Error: Not authenticated. Run `npx convex login` first."

**What you need to do:**
1. Run: `npx convex login`
2. Complete browser authentication
3. Run: `npx convex dev`
4. Create project when prompted

**I'll verify after:**
`cat .env.local | grep CONVEX` returns the Convex URL

### Awaiting

Type "done" when Convex is authenticated and project created.
```

**After you return:**

The orchestrator will:
1. Parse your structured return
2. Present checkpoint details to the user
3. Collect user's response
4. Spawn a FRESH continuation agent with your completed tasks state

You will NOT be resumed. A new agent continues from where you stopped, using your Completed Tasks table to know what's done.

**How to know if you were spawned:**

If you're reading this workflow because an orchestrator spawned you (vs running directly), the orchestrator's prompt will include checkpoint return instructions. Follow those instructions when you hit a checkpoint.

**If running in main context (not spawned):**

Use the standard checkpoint_protocol - display checkpoint and wait for direct user response.
</step>
