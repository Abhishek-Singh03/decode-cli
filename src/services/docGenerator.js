/**
 * src/services/docGenerator.js
 * The "Doc Generator" custom skill (see AGENTS_AND_SKILLS.md): takes a
 * project's file tree and key source files and generates structured
 * documentation (architecture overview, README, or explainer) in a consistent
 * format.
 *
 * Read-only: it only produces text via the LLM client — writing the result to
 * disk is the command's job and requires human approval (AGENTS.md rule 1).
 * Nothing is fabricated: the LLM only ever sees real scanned project content,
 * and without a configured provider these calls throw a clear error.
 */
import { generateSummary } from './llmClient.js';

/** Max output tokens for full documentation generation. */
export const DOC_MAX_TOKENS = 2048;

/** Builds the prompt for architecture/README-style documentation. */
export function buildArchitecturePrompt(project, { instruction } = {}) {
  const tree = project.tree.join('\n');
  const files = project.keyFiles
    .map((f) => `### ${f.path}\n\`\`\`\n${f.content}\n\`\`\``)
    .join('\n\n');

  return [
    'You are the Doc Generator. Produce architecture documentation for the following project, in Markdown, with sections: Overview, Structure, Key Files, and Notes.',
    instruction ? `Extra guidance from the user: ${instruction}` : null,
    '',
    '## Project file tree',
    tree,
    '',
    '## Key source files',
    files,
    '',
    'Write concise, factual documentation based only on the content above. Do not invent files, features, or behaviors that are not present.',
  ]
    .filter(Boolean)
    .join('\n');
}

/** Builds the prompt for a plain-English explanation of the project or a part. */
export function buildExplainPrompt(project, { instruction } = {}) {
  const tree = project.tree.join('\n');
  const files = project.keyFiles
    .map((f) => `### ${f.path}\n\`\`\`\n${f.content}\n\`\`\``)
    .join('\n\n');

  return [
    'You are the Repo Analyst. Explain the following project in plain English for a developer.',
    instruction ? `Focus your explanation on this specific part or question: ${instruction}` : 'Give an overview of the whole project.',
    '',
    '## Project file tree',
    tree,
    '',
    '## Key source files',
    files,
    '',
    'Be clear and factual. Do not invent details that are not present in the content above.',
  ]
    .filter(Boolean)
    .join('\n');
}

/** Generates architecture documentation for a scanned project. */
export function generateArchitecture(project, options = {}) {
  const prompt = buildArchitecturePrompt(project, options);
  return generateSummary(prompt, { ...options, maxTokens: options.maxTokens || DOC_MAX_TOKENS });
}

/** Produces a plain-English explanation of a scanned project. */
export function explain(project, options = {}) {
  const prompt = buildExplainPrompt(project, options);
  return generateSummary(prompt, options);
}
