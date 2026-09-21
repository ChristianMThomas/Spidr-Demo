---
name: "source-command-git-workflow"
description: "Migrated source command `git-workflow`"
---

# source-command-git-workflow

Use this skill when the user asks to run the migrated source command `git-workflow`.

## Command Template

# Git Workflow

Run the full git workflow for the current working branch: stage all changes, commit with a summary message, and push to remote.

## Steps

1. **Check git status** — run `git status` to see what files have changed. Show the user the summary of changed files.

2. **Stage all changes** — run `git add .` to stage everything. Git's own `.gitignore` already excludes `spidr-landing/`, `.env` files, `node_modules`, `dist`, and `.Codex/*`, so no extra exclusion flags are needed.

3. **Draft a commit message** — review the diff (`git diff --cached --stat`) to understand what changed. Write a commit message that:
   - Is **3–4 sentences maximum** — a concise summary of what was updated and why
   - Uses plain present-tense language ("Add...", "Fix...", "Update...")
   - Includes **only the author's name** — do NOT add any `Co-Authored-By` trailer or any mention of Codex
   - The format is just the message body with no extra metadata

4. **Confirm before committing** — show the drafted commit message to the user and ask for approval or edits before running `git commit`.

5. **Commit** — run `git commit -m "<approved message>"` with only the approved message. No `Co-Authored-By` line. No Codex attribution.

6. **Push** — run `git push` to push the branch to remote. If the branch has no upstream yet, run `git push --set-upstream origin <branch-name>`.

## Rules

- **Never use `git add -A` with force flags** — always use `git add .` which respects `.gitignore`.
- **Never add `Co-Authored-By: Codex` or any AI attribution** to commit messages.
- **Always ask the user before running any `rm` or `git rm` command.** Describe exactly what will be deleted and wait for explicit confirmation.
- If the push fails due to a diverged remote, report the error to the user and ask how to proceed — do not force push without explicit instruction.
- If there are no staged changes after `git add .`, report that to the user and stop.
