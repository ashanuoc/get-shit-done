#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# GSD Autopilot Script
# Generated: {{timestamp}}
# Project: {{project_name}}
# Model: {{autopilot_model}}
# ═══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

# Signal to GSD commands that we're in autopilot mode
export GSD_AUTOPILOT=1

# ─────────────────────────────────────────────────────────────────────────────
# Configuration
# ─────────────────────────────────────────────────────────────────────────────

PROJECT_DIR="{{project_dir}}"
PROJECT_NAME="{{project_name}}"
PHASES=({{phases}})
CHECKPOINT_MODE="{{checkpoint_mode}}"
MAX_RETRIES={{max_retries}}
BUDGET_LIMIT={{budget_limit}}
WEBHOOK_URL="{{webhook_url}}"

# Model selection (from config)
AUTOPILOT_MODEL="{{autopilot_model}}"

# ─────────────────────────────────────────────────────────────────────────────
# Derived paths
# ─────────────────────────────────────────────────────────────────────────────

LOG_DIR="$PROJECT_DIR/.planning/logs"
CHECKPOINT_DIR="$PROJECT_DIR/.planning/checkpoints"
STATE_FILE="$PROJECT_DIR/.planning/STATE.md"
ACTIVITY_PIPE="$PROJECT_DIR/.planning/logs/activity.pipe"

cd "$PROJECT_DIR"
mkdir -p "$LOG_DIR" "$CHECKPOINT_DIR/pending" "$CHECKPOINT_DIR/approved"

# ─────────────────────────────────────────────────────────────────────────────
# Logging
# ─────────────────────────────────────────────────────────────────────────────

log() {
  local level="$1"
  local message="$2"
  local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
  echo "[$timestamp] [$level] $message" >> "$LOG_DIR/autopilot.log"
}

notify() {
  local message="$1"
  printf "\a"  # Terminal bell
  log "NOTIFY" "$message"
  [ -n "$WEBHOOK_URL" ] && curl -s -X POST "$WEBHOOK_URL" -H "Content-Type: application/json" -d "{\"text\": \"$message\"}" > /dev/null 2>&1 || true
}

# ─────────────────────────────────────────────────────────────────────────────
# Model Execution
# ─────────────────────────────────────────────────────────────────────────────

execute_claude() {
  local prompt="$1"
  shift

  # For GLM-4.7, check if CCR is available
  if [ "$AUTOPILOT_MODEL" = "glm-4.7" ]; then
    if ! command -v ccr &> /dev/null; then
      log "ERROR" "GLM-4.7 selected but CCR not installed."
      echo "ERROR: GLM-4.7 requires CCR. Install with:"
      echo "  git clone https://github.com/musistudio/claude-code-router.git"
      echo "  cd claude-code-router && npm install && npm link"
      echo ""
      echo "Or edit .planning/config.json and change autopilot_model to 'default' or 'claude-3-5-sonnet-latest'"
      echo ""
      echo "Falling back to default model..."
      echo "$prompt" | claude -p "$@" 2>&1
      return
    else
      log "INFO" "Using GLM-4.7 via CCR"
      echo "$prompt" | ccr code --model glm-4.7 -p "$@" 2>&1
      return
    fi
  fi

  # Use model flag if specified
  if [ "$AUTOPILOT_MODEL" = "default" ]; then
    log "INFO" "Using default Claude model"
    echo "$prompt" | claude -p "$@" 2>&1
  else
    log "INFO" "Using model: $AUTOPILOT_MODEL"
    echo "$prompt" | claude -p --model "$AUTOPILOT_MODEL" "$@" 2>&1
  fi
}

# ─────────────────────────────────────────────────────────────────────────────
# Phase Execution
# ─────────────────────────────────────────────────────────────────────────────

execute_phase() {
  local phase="$1"
  local phase_log="$LOG_DIR/phase-${phase}-$(date +%Y%m%d-%H%M%S).log"
  local attempt=1

  log "INFO" "Starting phase $phase"

  while [ $attempt -le $MAX_RETRIES ]; do
    # Check if phase needs planning
    if [ ! -f ".planning/phases/${phase}-PLAN.md" ]; then
      log "INFO" "Planning phase $phase"

      execute_claude "/gsd:plan-phase $phase" \
          --allowedTools "Read,Write,Edit,Glob,Grep,Bash,Task,TodoWrite,AskUserQuestion" \
          >> "$phase_log"

      if [ $? -ne 0 ]; then
        log "ERROR" "Planning failed for phase $phase (attempt $attempt)"
        ((attempt++))
        sleep 5
        continue
      fi
    fi

    # Execute phase
    log "INFO" "Executing phase $phase"

    execute_claude "/gsd:execute-phase $phase" \
        --allowedTools "Read,Write,Edit,Glob,Grep,Bash,Task,TodoWrite,AskUserQuestion" \
        >> "$phase_log"

    if [ $? -eq 0 ]; then
      log "SUCCESS" "Phase $phase completed"
      notify "Phase $phase complete"
      return 0
    else
      log "ERROR" "Execution failed for phase $phase (attempt $attempt)"
      ((attempt++))
      sleep 5
    fi
  done

  log "ERROR" "Phase $phase failed after $MAX_RETRIES attempts"
  notify "Phase $phase FAILED"
  return 1
}

# ─────────────────────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────────────────────

main() {
  echo ""
  echo "═══════════════════════════════════════════════════════════════"
  echo "  GSD AUTOPILOT - $PROJECT_NAME"
  echo "═══════════════════════════════════════════════════════════════"
  echo ""
  echo "Model: $AUTOPILOT_MODEL"
  echo "Phases: ${PHASES[*]}"
  echo "Starting in 3 seconds..."
  echo ""
  sleep 3

  for phase in "${PHASES[@]}"; do
    if ! execute_phase "$phase"; then
      echo "Autopilot stopped at phase $phase"
      exit 1
    fi
  done

  echo ""
  echo "═══════════════════════════════════════════════════════════════"
  echo "  MILESTONE COMPLETE!"
  echo "═══════════════════════════════════════════════════════════════"
  echo ""
  echo "All phases completed successfully."
  echo "Logs: $LOG_DIR/"
  echo ""
}

main "$@"
