# Custom Agent & Skill Documentation

This document satisfies the hackathon requirement of at least one custom agent and one custom skill, committed and documented.

---

## Custom Agent: Repo Analyst

**Purpose:** Reads a codebase or repository's activity data and produces structured, human-readable summaries.

**Powers these commands:**
- `decode doc` — generates architecture/README documentation from source
- `decode doc --explain` — produces a plain-English explanation of the project or a specific part of it
- `decode github analyze` — turns raw commit/PR data into a readable activity summary

**Scope & access:**
- Read-only access to project source files and GitHub API data
- No write access to the filesystem (writing is handled separately by the AI Assistant fallback flow, which has its own approval gate)

**Invocation:** Triggered internally by the `doc` and `github analyze` command handlers; not directly user-invoked as a standalone agent command.

---

## Custom Skill: API Contract Verifier

**Purpose:** Given an API route and (optionally) an expected schema, checks the live response and diagnoses mismatches or failures in plain language.

**Powers:** `decode api check`

**Logic:**
1. Fires the request
2. Compares status code, response time, and response shape against expectations (from an OpenAPI spec if provided, or basic sanity checks otherwise)
3. Produces a diagnosis string for any failure (e.g. "expected `id` field of type number, received string")

**Scope & access:** Network access to the target API only; no filesystem or repo access.

---

## Custom Skill (Bonus): Doc Generator

**Purpose:** Reusable skill that takes a project's file tree and key source files and generates structured documentation (architecture overview, README, or explainer) in a consistent format.

**Note:** This skill was used to help draft/refine this project's own documentation — a working example of DeCode's Doc Generator feature applied to itself.

---

## Design Principle Across Both

Every agent/skill in this project follows the same safety rule defined in `AGENTS.md`: read-heavy analysis is fully autonomous, but any action that writes to disk requires explicit human approval via the diff-and-confirm flow in the AI Assistant.
