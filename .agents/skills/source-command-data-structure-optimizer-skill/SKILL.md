---
name: "source-command-data-structure-optimizer-skill"
description: "Audit and improve code by finding suboptimal data structures and recommending better alternatives with explicit time/space complexity tradeoffs. Use this skill whenever the user is writing, reviewing, refactoring, or optimizing code and a data structure choice is involved — including when they mention performance, Big-O, time/space complexity, \"is this efficient,\" slow loops, `.includes()`/linear scans, array `shift`/`unshift`, re-sorting, frequent lookups, queues, stacks, heaps, or \"what's the best structure for X.\" Also trigger proactively when reviewing a function that repeatedly searches, inserts into, or reorders a collection, even if the user only asks to \"review\" or \"clean up\" code. Supports Java, Python, and JavaScript/TypeScript."
---

# source-command-data-structure-optimizer-skill

Use this skill when the user asks to run the migrated source command `data-structure-optimizer-SKILL`.

## Command Template

# Data Structure Optimizer

Help the user choose the most appropriate data structure for the dominant operation(s) in a given piece of code, so they get optimal time complexity and reasonable space usage. The goal is not to memorize trivia — it's to spot a structure that's a poor fit for how it's actually used, and recommend a better one with a clear, honest tradeoff.

## How to use this skill

1. **Identify the dominant operation(s)** in the code under review. What happens most often or in the hottest loop — lookup, insertion, deletion, ordered traversal, LIFO/FIFO access, min/max retrieval, range queries?
2. **Check the current structure against that operation** using the decision framework and reference table below.
3. **If there's a mismatch, recommend a better structure**, state the Big-O improvement explicitly (now vs. proposed), and give the idiomatic implementation. For language-specific before/after code, load the relevant reference file:
   - Java → `references/java.md`
   - Python → `references/python.md`
   - JavaScript / TypeScript → `references/javascript-typescript.md`

   Read only the file(s) for the language(s) in play. Keep recommendations idiomatic per ecosystem — don't suggest a Java idiom in Python, and note when a language's standard library lacks a structure (e.g., JS/TS has no built-in heap or balanced tree).
4. **Give a one-line rule of thumb** so the lesson generalizes beyond the immediate case.

Don't over-optimize. For a collection of 5 items that's never in a hot path, a linear scan is fine and clearer than a hash set. Flag the mismatch, but say so when it's unlikely to matter in practice — premature optimization and unnecessary abstraction are real costs.

## Decision framework

Match the **dominant operation** to a structure:

- **Frequent membership tests ("is X in here?")** → hash set. O(1) average vs. O(n) linear scan.
- **Key → value lookup, frequency counting, grouping** → hash map / dictionary. O(1) average vs. O(n) nested search.
- **LIFO access (most-recent-first): undo/redo, back button, DFS, bracket matching** → stack. O(1) push/pop. Avoid removing from the *front* of an array (O(n)).
- **FIFO access (first-come-first-served): task queues, BFS, buffers** → queue / deque. O(1) enqueue/dequeue. Avoid `shift()` on an array (O(n)).
- **Repeated min or max retrieval; "top-k"; scheduling by priority** → heap / priority queue. O(log n) push/pop, O(1) peek vs. O(n) scan or O(n log n) re-sort.
- **Maintaining sorted order under frequent inserts/deletes** → balanced BST / ordered map / skip list. O(log n) insert while staying sorted vs. O(n log n) re-sort or O(n) insert-into-array.
- **Range queries / "all keys between A and B" / floor/ceiling/nearest** → ordered (tree-based) map or set. O(log n) navigation; hash maps can't do this at all.
- **Frequent insertion/deletion in the middle while holding a position** → linked list (O(1) at a known node) vs. array shifting (O(n)). But see the caveat in the language references: arrays usually win in practice due to cache locality unless you genuinely hold node references.
- **Index-based random access, append-heavy, iterate-heavy** → dynamic array / list. This is the right default; don't replace it without a reason.

When two structures tie on the dominant operation, prefer the simpler/more idiomatic one and the one with better constant factors and cache behavior (usually arrays).

## Complexity reference table

Average / worst-case for core operations. "—" means not a natural operation for that structure.

| Structure | Access | Search | Insert | Delete | Space | Ordered? |
|---|---|---|---|---|---|---|
| Dynamic array / list | O(1) | O(n) | O(1)* amortized (end) / O(n) (middle) | O(n) | O(n) | insertion order |
| Singly/doubly linked list | O(n) | O(n) | O(1) at known node / O(n) to find | O(1) at known node / O(n) to find | O(n) | insertion order |
| Stack (LIFO) | O(n) | O(n) | O(1) push | O(1) pop | O(n) | LIFO |
| Queue / deque (FIFO) | O(n) | O(n) | O(1) enqueue | O(1) dequeue | O(n) | FIFO |
| Hash set | — | O(1) / O(n) | O(1) / O(n) | O(1) / O(n) | O(n) | no |
| Hash map / dict | O(1) / O(n) by key | O(1) / O(n) | O(1) / O(n) | O(1) / O(n) | O(n) | no |
| Balanced BST / ordered map (TreeMap, etc.) | O(log n) | O(log n) | O(log n) | O(log n) | O(n) | sorted by key |
| Binary heap / priority queue | O(1) peek min/max | O(n) | O(log n) | O(log n) (top) | O(n) | partial (heap order) |

\* Amortized: most appends are O(1); occasional resizes are O(n) but averaged out.

Notes that matter in practice:
- Hash structures are O(1) *average* but O(n) *worst case* under heavy collisions; they also have larger constant factors and memory overhead than arrays.
- Heaps give cheap min *or* max, not both, and not sorted iteration.
- "Ordered map" availability differs by language — built-in in Java (`TreeMap`) and via library in Python (`sortedcontainers`); JS/TS has no built-in equivalent. See the references.

## Audit checklist

Run this mentally (or have Codex run it) on any function that touches a collection:

1. **What's the dominant operation?** What happens most often, or in the innermost loop? (lookup / insert / delete / order / LIFO / FIFO / min-max / range)
2. **What structure is used now, and what's that operation's complexity on it?** (e.g., `array.includes()` → O(n) search)
3. **Is there a structure where that operation is cheaper?** (e.g., set → O(1))
4. **What's the Big-O delta across the realistic input size?** O(n)→O(1) per call inside an O(n) loop turns O(n²) into O(n) — usually worth it. O(n)→O(1) on a 5-element list run once — usually not.
5. **What does the switch cost?** Memory overhead, loss of ordering or index access, added dependency, reduced readability. Name the tradeoff honestly.
6. **Idiomatic check:** Is the recommended structure the idiomatic one for this language? Does the standard library even have it, or is a library/custom implementation needed?

If steps 3–5 net out positive, recommend the change with before/after code and the rule of thumb. If they don't, say the current choice is fine and why.

## Output format for a recommendation

Use this structured block for a **single, focused recommendation** — it makes the tradeoff legible:

- **Scenario / dominant operation:** what the code does most.
- **Inefficient approach:** the current structure and the offending operation's complexity.
- **Recommended structure:** the better fit.
- **Big-O improvement:** now vs. proposed, and the effect at scale.
- **Idiomatic code:** before/after in the relevant language(s), from the reference files.
- **Rule of thumb:** one line the user can reuse.

Adapt rather than force the template:
- When a review surfaces **several** issues at once, don't repeat the full block for each — lead with the highest-impact finding, then list the rest more briefly. Repeating six labeled fields per issue gets noisy.
- When the honest answer is **"don't change anything"** (the current structure is fine, or a proposed "optimization" is actually worse — e.g., a linked list that won't help), drop the template and explain in prose *why* the change isn't worth it. Talking someone out of a bad optimization is just as valuable as recommending a good one. Still end with a rule of thumb.
