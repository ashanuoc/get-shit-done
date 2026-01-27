<purpose>
Create a complete GSD approach through conversational discovery. An approach is a cohesive methodology - a workflow with supporting references, agents, and templates that work together.

You are a thinking partner, not an interviewer. The user knows what they want to achieve differently. Your job is to understand their vision and translate it into GSD components.
</purpose>

<required_reading>
@~/.claude/get-shit-done/skills/gsd-extend/references/extension-anatomy.md
</required_reading>

<philosophy>
**User = methodology designer. Claude = builder.**

The user knows:
- What frustrates them about current workflow
- What they imagine working better
- When they'd use this approach
- What success looks like

The user doesn't know (and shouldn't need to):
- GSD extension architecture
- Workflow vs agent vs reference distinctions
- XML structure and frontmatter format
- How to wire components together

Ask about their vision. You figure out the implementation.
</philosophy>

<process>

<step name="open_conversation" priority="first">
**Display stage banner:**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► CREATE APPROACH
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Open the conversation:**

Ask inline (freeform, NOT AskUserQuestion):

"What would you like GSD to do differently? Describe the workflow or approach you have in mind."

Wait for their response. This gives you context to ask intelligent follow-up questions.
</step>

<step name="follow_the_thread">
Based on what they said, ask follow-up questions that dig into their response.

**Use AskUserQuestion with options that probe what they mentioned:**
- Interpretations of vague terms
- Clarifications on triggers
- Concrete examples of what success looks like

**Keep following threads.** Each answer opens new threads. Ask about:
- What frustrates them about the current approach
- What specifically would be different
- When this approach applies vs doesn't
- What outputs or artifacts they expect
- What domain knowledge would help

**Example follow-up patterns:**

If they mention "spike first":
- "When you say spike, do you mean throwaway code or a minimal prototype?"
- "What happens after the spike? Formal plans, or iterate on the spike?"
- "How do you know when the spike is done?"

If they mention "security review":
- "At what point - before commit, before PR, after each task?"
- "What should it check? OWASP top 10, or specific patterns?"
- "Should it block on findings or just report?"

If they mention "API first":
- "OpenAPI spec, or informal contract?"
- "Generate code from spec, or just validate against it?"
- "Who writes the spec - you or Claude?"

**The 4-then-check pattern:**

After ~4 questions on a thread, check:

- header: "Thread"
- question: "More questions about [topic], or move on?"
- options:
  - "More questions" — I want to clarify further
  - "Move on" — I've said enough about this

If "More questions" → ask 4 more, then check again.
</step>

<step name="identify_components">
As you converse, mentally map what they're describing to GSD components:

**Workflow signals:**
- "First I want to..., then..." → sequence of steps
- "At this point, check..." → verification step
- "If X happens, then..." → conditional logic
- "This replaces..." → override built-in

**Reference signals:**
- "Claude should know about..." → domain knowledge
- "There are patterns for..." → best practices
- "Watch out for..." → anti-patterns
- "In our codebase, we..." → project conventions

**Agent signals:**
- "Specialized analysis of..." → focused worker
- "Review for..." → auditing task
- "Research..." → investigation task
- "Generate..." → creation task

**Template signals:**
- "The output should look like..." → structured format
- "Always include..." → required sections
- "Following this format..." → consistency need

Don't surface this analysis. Just track it internally.
</step>

<step name="ready_check">
When you could design the approach, use AskUserQuestion:

- header: "Ready?"
- question: "I think I understand what you're after. Ready to design the approach?"
- options:
  - "Design it" — Let's see what you've got
  - "Keep exploring" — I want to share more

If "Keep exploring" — ask what they want to add, or identify gaps and probe naturally.

Loop until "Design it" selected.
</step>

<step name="present_design">
Present the approach design:

```
## Proposed Approach: {name}

Based on our conversation, here's what I'll create:

**Workflow:** {name}.md
- Triggers: {when it activates}
- {Replaces: {built-in} OR Adds new capability}
- Flow:
  1. {step 1}
  2. {step 2}
  3. {step 3}

{If reference needed:}
**Reference:** {name}-patterns.md
- Domain knowledge about: {what}
- Loaded when: {triggers}

{If agent needed:}
**Agent:** {name}-{role}.md
- Purpose: {what it does}
- Spawned: {when in the workflow}

{If template needed:}
**Template:** {name}-{artifact}.md
- Produces: {what artifact}
- Used by: {workflow step}

---

Does this capture your approach?
```

Use AskUserQuestion:
- header: "Design"
- question: "Does this design capture what you described?"
- options:
  - "Yes, create it" — Build all the components
  - "Adjust" — Let me tell you what's different
  - "Start over" — I want to describe it differently

If "Adjust" — get their feedback, update design, present again.
If "Start over" — return to open_conversation.
</step>

<step name="determine_scope">
Use AskUserQuestion:

- header: "Scope"
- question: "Where should this approach be available?"
- options:
  - "All my projects (Recommended)" — Install to ~/.claude/gsd-extensions/
  - "This project only" — Install to .planning/extensions/
</step>

<step name="generate_components">
Create all components with proper cross-references.

**1. Create directories:**

```bash
if [[ "$SCOPE" == "global" ]]; then
  BASE="$HOME/.claude/gsd-extensions"
else
  BASE=".planning/extensions"
fi

mkdir -p "$BASE/workflows"
[[ -n "$NEEDS_REFERENCE" ]] && mkdir -p "$BASE/references"
[[ -n "$NEEDS_AGENT" ]] && mkdir -p "$BASE/agents"
[[ -n "$NEEDS_TEMPLATE" ]] && mkdir -p "$BASE/templates"
```

**2. Generate each component:**

For each component, use the appropriate structure from references/:
- Workflow: @references/workflow-structure.md
- Agent: @references/agent-structure.md
- Reference: @references/reference-structure.md
- Template: @references/template-structure.md

**3. Wire components together:**

In the workflow, add @-references to other components:

```xml
<required_reading>
@{BASE}/references/{name}-patterns.md
</required_reading>

<step name="spawn_specialized_agent">
Task(
  prompt="@{BASE}/agents/{name}-{role}.md

  <context>
  {context from workflow state}
  </context>",
  subagent_type="general-purpose",
  model="sonnet",
  description="{brief}"
)
</step>

<output>
Use template: @{BASE}/templates/{name}-{artifact}.md
</output>
```
</step>

<step name="validate">
Validate all components:

```bash
echo "Validating approach..."

for file in "$BASE"/*/"${PREFIX}"*.md; do
  echo "  Checking: $(basename $file)"

  # YAML frontmatter
  head -5 "$file" | grep -q "^---" && echo "    ✓ Frontmatter" || echo "    ✗ Missing frontmatter"

  # Required fields
  grep -q "^name:" "$file" && echo "    ✓ Name field" || echo "    ✗ Missing name"
  grep -q "^description:" "$file" && echo "    ✓ Description" || echo "    ✗ Missing description"
done

# Check cross-references resolve
echo "  Checking references..."
grep -ohE '@[~./][^[:space:]<>]+' "$BASE/workflows/${PREFIX}"*.md 2>/dev/null | while read ref; do
  path="${ref#@}"
  path="${path/#\~/$HOME}"
  [[ -f "$path" ]] && echo "    ✓ $ref" || echo "    ✗ $ref NOT FOUND"
done

echo "Validation complete."
```
</step>

<step name="present_result">
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► APPROACH CREATED ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## {Approach Name}

| Component | Location |
|-----------|----------|
| Workflow | {path} |
| Reference | {path} |
| Agent | {path} |
| Template | {path} |

───────────────────────────────────────────────────────────────

## How to Use

{If replaces built-in:}
Automatically activates when you run `{command}`.
GSD uses your workflow instead of the built-in.

{If new capability:}
Reference in your plans or workflows:
@{workflow_path}

Or invoke the workflow step name from your commands.

───────────────────────────────────────────────────────────────

## To Customize

Edit files directly:
{list paths}

## To Remove

/gsd:extend remove {name}

───────────────────────────────────────────────────────────────
```
</step>

</process>

<success_criteria>
- [ ] User's vision fully understood through conversation
- [ ] Follow-up questions probed what user mentioned (not generic)
- [ ] User confirmed design before generation
- [ ] All needed components identified and created
- [ ] Components properly cross-referenced
- [ ] All components pass validation
- [ ] User knows how to use and customize the approach
</success_criteria>
