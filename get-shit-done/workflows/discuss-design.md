---
name: discuss-design
description: Design phase-specific UI through conversation, then generate mockups
triggers: [custom]
replaces: null
requires: [ui-principles, framework-patterns]
---

<purpose>
Design phase-specific UI elements through conversation before planning. Creates mockups for visual review, ensuring design decisions are made before implementation time is spent.
</purpose>

<when_to_use>
- Before planning a phase with UI components
- When you want to visualize before coding
- When UI decisions need iteration
- To create component mockups for review
</when_to_use>

<required_reading>
@~/.claude/get-shit-done/references/ui-principles.md
@~/.claude/get-shit-done/references/framework-patterns.md
</required_reading>

<process>

<step name="display_banner" priority="first">
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► DISCUSS DESIGN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```
</step>

<step name="parse_phase">
Extract phase number from argument.

If no phase provided:
```bash
# List available phases
ls -d .planning/phases/*/ 2>/dev/null | head -10
```

Ask via AskUserQuestion:
- header: "Phase"
- question: "Which phase are you designing for?"
- options: [list phases found, or freeform input]

Load phase details from ROADMAP.md:
```bash
grep -A 20 "^## Phase ${PHASE_NUM}" .planning/ROADMAP.md
```
</step>

<step name="load_design_system">
Check for project design system:

```bash
if [[ -f ".planning/DESIGN-SYSTEM.md" ]]; then
  echo "Design system found - loading as context"
  # Read and summarize key points
else
  echo "No design system - will use ui-principles defaults"
fi
```

If design system exists, load and summarize key constraints:
- Color palette
- Typography scale
- Component patterns
- Framework-specific notes
</step>

<step name="detect_framework">
```bash
if [[ -f "package.json" ]]; then
  if grep -q '"next"' package.json; then
    FRAMEWORK="nextjs"
  elif grep -q '"react"' package.json; then
    FRAMEWORK="react"
  fi
elif ls *.xcodeproj 2>/dev/null || [[ -f "Package.swift" ]]; then
  FRAMEWORK="swift"
elif [[ -f "requirements.txt" ]]; then
  FRAMEWORK="python"
else
  FRAMEWORK="html"
fi
```

State: "I'll create {FRAMEWORK} mockups for this phase."
</step>

<step name="phase_context">
Display phase summary:

```
## Phase {number}: {name}

**Goal:** {phase goal from roadmap}

**Relevant requirements:**
{requirements that involve UI}
```

Ask inline (freeform):
"What UI elements does this phase need? Describe the screens, components, or interactions you're envisioning."

Wait for response.
</step>

<step name="visual_references">
Ask via AskUserQuestion:
- header: "References"
- question: "Do you have visual references for this specific phase?"
- options:
  - "Yes, images/screenshots" - I'll provide files
  - "Yes, URLs" - I'll share example sites
  - "Both" - Images and URLs
  - "No, use design system" - Work from existing system

**If references provided:**
Analyze and extract:
- Specific component patterns
- Layout approaches
- Interaction patterns

"From your references, I see: [analysis]"
</step>

<step name="component_discovery">
Based on user description, identify components needed.

For each component, ask follow-up questions:
- "For the {component}, what states should it have?"
- "What data does it display?"
- "What actions can users take?"

Use 4-then-check pattern:
After ~4 questions, ask:
- header: "More?"
- question: "More questions about {component}, or move on?"
- options:
  - "More questions" - I want to clarify further
  - "Move on" - I've said enough

Continue until all components understood.
</step>

<step name="layout_discussion">
Ask about layout:
- "How should these components be arranged?"
- "What's the primary action on this screen?"
- "How does it behave on mobile?"

Probe for:
- Content hierarchy
- Navigation patterns
- Responsive behavior
</step>

<step name="interaction_discussion">
For interactive components:
- "What happens when user clicks {action}?"
- "How should loading states look?"
- "What error states are possible?"

Document:
- User flows
- State transitions
- Feedback patterns
</step>

<step name="design_summary">
Present design summary:

```
## Design Summary: Phase {number}

### Components
{list with brief specs}

### Layout
{layout description}

### Interactions
{key interactions}

### States
{loading, error, empty states}
```

Ask via AskUserQuestion:
- header: "Ready?"
- question: "Ready to generate mockups?"
- options:
  - "Generate mockups" - Create the visual files
  - "Adjust design" - I want to change something
  - "Add more" - I have more components to discuss
</step>

<step name="generate_mockups">
Create phase directory:
```bash
PHASE_DIR=".planning/phases/${PHASE_NUM}-${PHASE_NAME}"
mkdir -p "$PHASE_DIR/mockups"
```

Spawn design specialist agent:

Task(
  prompt="@~/.claude/agents/design-specialist.md

  <context>
  **Phase:** {phase_number} - {phase_name}
  **Framework:** {detected_framework}
  **Design System:** @.planning/DESIGN-SYSTEM.md

  **Components to create:**
  {component_specs}

  **Layout:**
  {layout_description}

  **States:**
  {state_requirements}
  </context>

  Create mockups in: {PHASE_DIR}/mockups/",
  subagent_type="general-purpose",
  model="sonnet",
  description="Generate phase mockups"
)
</step>

<step name="review_mockups">
After mockups generated, present for review:

```
## Mockups Created

{list of files}

### Preview

Run:
{preview command based on framework}
```

Ask via AskUserQuestion:
- header: "Review"
- question: "Review the mockups. What's the verdict?"
- options:
  - "Approved" - These look good, proceed
  - "Iterate" - I want changes
  - "Major revision" - Start fresh on specific components

**If "Iterate":**
Ask what changes needed, update mockups, re-present.

Loop until "Approved".
</step>

<step name="create_design_doc">
Generate phase design document:

Write `.planning/phases/{phase}/${PHASE}-DESIGN.md` using template:
@~/.claude/get-shit-done/templates/phase-design.md

Include:
- All component specs
- Layout decisions
- State definitions
- Mockup file references
- Implementation notes
</step>

<step name="present_result">
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► DESIGN COMPLETE ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## Phase {number}: {name}

**Components designed:** {count}
**Mockups created:** {count}
**Status:** Approved

### Files

| File | Purpose |
|------|---------|
| {PHASE}-DESIGN.md | Design specifications |
{mockup_files}

───────────────────────────────────────────────────────────────

## What's Next

The design is ready for implementation.

Option 1: Plan the phase
  /gsd:plan-phase {phase_number}

Option 2: View mockups
  {preview_command}

Option 3: Edit design
  Open .planning/phases/{phase}/${PHASE}-DESIGN.md

The planner will automatically load {PHASE}-DESIGN.md as context.

───────────────────────────────────────────────────────────────
```
</step>

</process>

<success_criteria>
- [ ] Phase requirements understood
- [ ] Design system loaded (if exists)
- [ ] All UI components identified
- [ ] Component specs complete with states
- [ ] Layout documented
- [ ] Mockups generated in framework-appropriate format
- [ ] User approved mockups
- [ ] {PHASE}-DESIGN.md created
- [ ] User knows next steps
</success_criteria>
