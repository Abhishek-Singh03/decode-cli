# DeCode — AI-Powered Developer Productivity CLI

### Base Planning Document — Deploy or Die: HowToAlgo x GDGoC KIIT Hackathon (Track B)

---

## 1\. Product Summary

**Name:** DeCode

**One-line pitch:** A single CLI that lets developers check their API health, understand their GitHub activity, generate/verify documentation, and get AI-assisted code edits — all from the terminal, with a human approving every change the AI makes.

**Track:** B — Developer Productivity Tools

**Why CLI:** Track B explicitly names CLI tools as a best-fit format. A CLI also removes frontend/packaging overhead, integrates directly into other developers' existing workflows and CI pipelines, and is the fastest path to a judge actually running and evaluating the tool with zero setup friction.

---

## 2\. Command Reference (Final)

### Setup & account

decode init                          Interactive setup wizard

decode connect \<api-key\>             Store an LLM/API provider key

decode disconnect                    Remove stored credentials

decode config list                   Show current config

decode config set \<key\> \<value\>      Update a config value

decode config reset                  Reset config to defaults

decode status                        Show connection status, last audit result, config path

decode help                          Show help

decode \--version                     Show version

decode \--verbose                     Verbose logging (global flag)

### API checking

decode api list                      List configured/discovered routes

decode api check \[--json\] \[--ci\]     Hit all routes, report status/latency/schema issues

### GitHub analysis

decode github connect                Authenticate with GitHub

decode github profile                Show profile analysis \+ commit record

decode github analyze \[repo\]         Analyze repo activity (defaults to current working repo)

### Documentation

decode doc \[message\]                 Generate docs folder \+ documents (guided by message if provided)

decode doc \--explain \[instruction\]   Explain the project overall or a specific part

decode doc check                     Check if docs are stale relative to source changes

### Composite check

decode audit \[--ci\] \[--json\]         Runs api check \+ doc check \+ repo health check, one summary

### Ask (read-only Q\&A)

decode ask \<question\>                Ask a question about the project — no file writes

### AI Assistant (natural-language fallback — no dedicated command)

Any input that isn't a recognized command or flag is routed to the AI assistant:

decode add error handling to the auth route

decode "fix the failing test in api-checker.test.js"

decode fix this \--file auth.js \--lines 20-45

**Design rationale:** requiring a keyword like `agent` before every natural-language request is repetitive friction for the core interaction of the tool. Instead, DeCode's parser first checks input against the known command/subcommand table; anything that doesn't match falls through to the assistant. This is the same pattern used by tools like GitHub Copilot CLI and `aider` — bare natural language *is* the primary interface, structured commands are the exception for specific, repeatable operations.

**Behavior:**

1. Parses input against known commands first (exact match required for subcommands, so there's no ambiguity)  
2. If unmatched, treats the full input as a natural-language instruction  
3. Agent reads relevant file(s) — scoped to `--file`/`--lines` if given, otherwise inferred from the instruction and project structure  
4. Proposes a diff, colorized, printed to terminal  
5. Prompts `Apply this change? (y/n)` — **nothing is written without explicit human approval**  
6. Sandbox boundary: file operations are restricted to the current project directory only; no arbitrary shell execution

**Note on collision risk:** since bare text is the fallback, make sure no real subcommand name can plausibly collide with a natural-language sentence a user might type (e.g. don't ever name a subcommand a common verb like `fix` or `add`). Current command list is safe on this front — worth re-checking anytime you add a new subcommand.

---

## 3\. Architecture

┌───────────────────────────────────────────┐

│              DeCode CLI (Node.js)           │

│  ┌─────────────┐  ┌──────────────────────┐ │

│  │ Command      │  │ NL Fallback →         │ │

│  │ Router       │  │ Agent Loop             │ │

│  │ (commander)  │  │ (unmatched input)      │ │

│  └──────┬───────┘  └──────────┬─────────────┘ │

│         │                     │                │

│  ┌──────▼─────┐ ┌───────────▼──────┐ ┌──────┐ │

│  │ API Check  │ │ GitHub Analyzer   │ │ Doc  │ │

│  │ Module     │ │ Module            │ │ Gen  │ │

│  └────────────┘ └───────────────────┘ └──────┘ │

│  ┌───────────────────────────────────────────┐ │

│  │  Agent Engine (LLM calls, diff generation,  │ │

│  │  sandboxed file read/write, approval flow)  │ │

│  └───────────────────────────────────────────┘ │

│  ┌───────────────────────────────────────────┐ │

│  │  Config Store (decode.config.json /       │ │

│  │  credentials, read by all modules)          │ │

│  └───────────────────────────────────────────┘ │

└──────────────────┬────────────────────────────┘

                    │

       ┌────────────┼────────────┐

       ▼            ▼            ▼

  GitHub API   Target Backend   LLM Provider

  (repo data)  (route checks)   (via router)

**Stack:**

- Language/framework: Node.js \+ `commander` (or Python \+ `click`/`typer` — pick based on team strength, stay consistent)  
- Terminal output: `chalk` (colors), `cli-table3` (tables), `ora` (spinners), `boxen` (summary boxes)  
- Interactive prompts: `inquirer` (for `init`, `y/n` approvals)  
- GitHub integration: GitHub REST/GraphQL API via `octokit`  
- LLM integration: routed through your chosen provider/router (Claude Code \+ your API provider)  
- Config: JSON file in project root or `~/.decode/config.json` for global settings, `.decoderc` for per-project overrides  
- Testing: Jest/Vitest (unit) \+ a CLI integration test approach (e.g. `execa` to run the built CLI and assert on stdout)

---

## 4\. Custom Agent & Skill (Non-Negotiable \#4)

- **Custom Agent — "Repo Analyst"**: reads a codebase/repo activity and produces structured summaries — powers `doc`, `doc --explain`, and `github analyze`.  
- **Custom Skill — "API Contract Verifier"**: reusable prompt/logic for checking a route's response against an expected schema and diagnosing failures — powers `api check`.

Document both in `AGENTS_AND_SKILLS.md`: what each does, what tools/data it has access to, how it's invoked, and any guardrails (e.g. sandbox boundary for the agent).

---

## 5\. Testing & CI/CD Plan

- **Unit tests**: command parsing/routing logic, API check request/response handling, GitHub data transforms, config read/write.  
- **Integration tests**: run the built CLI binary with `execa`/subprocess and assert on stdout/exit codes for each command — this replaces Playwright's role here since there's no browser UI.  
- **CI/CD (GitHub Actions)**: install deps → lint → unit tests → integration tests → build → (optional) publish check. Must be green on the latest commit at submission time.  
- **Linting**: ESLint/Prettier or Ruff/Black, ideally as a pre-commit hook.

---

## 6\. Day 1 Build Order

| Time | Task |
| :---- | :---- |
| Hour 0-1 | Repo setup, CLI framework scaffold, `.clinerules`/`AGENTS.md`, CI skeleton, config store |
| Hour 1-2.5 | `init`, `connect`/`disconnect`, `status`, `config` |
| Hour 2.5-5 | `api list`, `api check` |
| Hour 5-7.5 | `github connect`, `github profile`, `github analyze` |
| Hour 7.5-9.5 | `doc`, `doc --explain`, `doc check` |
| Hour 9.5-10.5 | `audit` (composes above) |
| Hour 10.5-13 | AI assistant fallback \+ `ask` (only if on schedule) |
| Ongoing | Commit continuously — no end-of-day dump; write architecture doc using DeCode's own `doc` command once stable |
| Final hour | Integration tests, CI green check, tagged release, demo recording |

---

## 7\. Submission Checklist

**The 5 non-negotiable gates:**

- [ ] Architecture document in repo  
- [ ] Agent rules file (`.clinerules` / `AGENTS.md` / `constitution.md`)  
- [ ] Working, demonstrable code  
- [ ] ≥1 custom agent \+ ≥1 custom skill, documented in `AGENTS_AND_SKILLS.md`  
- [ ] Green CI/CD pipeline (GitHub Actions, latest run passing)

**Everything else (drives score):**

- [ ] Spec/PRD with user stories \+ acceptance criteria  
- [ ] Automated tests (unit \+ CLI integration) passing in CI, results visible  
- [ ] Linter/static analysis config, ideally pre-commit hooks  
- [ ] Clean, progressive commit history  
- [ ] Task breakdown your agent worked through  
- [ ] Tagged release (semver \+ git tag/GitHub Release)  
- [ ] \~3-minute demo video (terminal recording — consider `asciinema` or a clean screen capture) or screenshots  
- [ ] Confirmation CI is green \+ tests pass, submitted alongside repo link

**Day 2 readiness:**

- [ ] Roadmap section documenting deferred features (visual flowchart trace, GUI companion for region-select editing) with reasoning  
- [ ] Command/module boundaries kept clean so a new requirement can slot into an existing module rather than requiring a rewrite

---

## 8\. Deferred / Roadmap (documented, not built Day 1\)

- **Visual trace of agent actions** — approximated Day 1 via step-by-step terminal output (`→ reading file...`, `→ generating diff...`); full visual version would be a companion GUI/web view in a future iteration.  
- **Region-select visual editing** — CLI-native substitute is `--file`/`--lines` targeting; a true visual selector would require a GUI companion app, noted as future work.

