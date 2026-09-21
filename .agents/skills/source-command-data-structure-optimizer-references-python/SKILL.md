---
name: "source-command-data-structure-optimizer-references-python"
description: "Migrated source command `data-structure-optimizer-references-python`"
---

# source-command-data-structure-optimizer-references-python

Use this skill when the user asks to run the migrated source command `data-structure-optimizer-references-python`.

## Command Template

# Python — before/after scenarios

Idiomatic Python uses built-ins (`list`, `dict`, `set`, `tuple`) plus `collections` (`deque`, `Counter`, `defaultdict`, `OrderedDict`) and `heapq`. Python has **no built-in balanced tree / ordered map**; the idiomatic answer is the third-party `sortedcontainers` library or, for a one-time sort, `bisect` on a list.

General idiom notes:
- A plain `list` is the default sequence; CPython lists are dynamic arrays, so append/pop at the *end* are O(1) amortized but `insert(0, x)` / `pop(0)` are O(n).
- Prefer `collections.Counter` and `collections.defaultdict` over manual dict bookkeeping.
- `heapq` operates on a plain list in place; there's no separate heap object.

---

## 1. Back-button / undo history → list as a stack (or deque)

**Inefficient:** using a list but popping from the front with `pop(0)` — O(n) because every element shifts.

```python
# ANTI-PATTERN: pop(0) is O(n)
history = []
history.append(url)        # visit
prev = history.pop(0)      # O(n) — wrong end
```

**Recommended:** a `list` used as a stack (pop from the end) is perfectly idiomatic and O(1). `deque` also works and is O(1) at both ends.

```python
history = []
history.append(url)        # push, O(1)
prev = history.pop()       # pop from end, O(1), LIFO
top = history[-1]          # peek, O(1)

# deque is equally idiomatic, especially if you also pop from the left:
from collections import deque
history = deque()
history.append(url)        # O(1)
prev = history.pop()       # O(1)
```

- **Big-O:** `pop(0)` O(n) → `pop()` O(1). Loop of n: O(n²) → O(n).
- **Rule of thumb:** for LIFO, use a list and `append`/`pop` (the end). Never `pop(0)`/`insert(0, …)` on a list — if you need the front, use a `deque`.

---

## 2. Membership testing → set

**Inefficient:** `x in some_list` is a linear scan — O(n).

```python
# ANTI-PATTERN: O(n) per membership test
blocked = [...]            # a list
for user in incoming:
    if user in blocked:    # O(n) each time → O(n*m) overall
        ...
```

**Recommended:** a `set` gives O(1) average membership.

```python
blocked = {...}            # a set literal, or set(blocked_list)
for user in incoming:
    if user in blocked:    # O(1) average
        ...
```

- **Big-O:** membership O(n) → O(1) average; loop O(n·m) → O(m).
- **Rule of thumb:** `x in collection` in a loop → make `collection` a `set` (or `dict` if you also need values). Use a `frozenset` if it should be immutable.

---

## 3. Frequency counting / key-value lookup → dict / Counter

**Inefficient:** scanning a list of pairs (or parallel lists) to find a key — O(n) per update.

```python
# ANTI-PATTERN: linear search to find the key to update
counts = []  # list of [word, n]
for w in words:
    for pair in counts:        # O(n) scan
        if pair[0] == w:
            pair[1] += 1
            break
    else:
        counts.append([w, 1])
```

**Recommended:** a `dict` (O(1) average), or `Counter` which is purpose-built.

```python
from collections import Counter
freq = Counter(words)          # one line, O(n) total

# or with a plain dict / defaultdict:
from collections import defaultdict
freq = defaultdict(int)
for w in words:
    freq[w] += 1               # O(1) average
```

- **Big-O:** per update O(n) → O(1) average; overall O(n²) → O(n).
- **Rule of thumb:** counting or keyed lookup → `dict`; counting specifically → `Counter`; "key with a default" → `defaultdict`.

---

## 4. FIFO task queue → collections.deque

**Inefficient:** a list where you dequeue with `pop(0)` — O(n) each time.

```python
# ANTI-PATTERN: O(n) per dequeue
queue = []
queue.append(task)         # enqueue
nxt = queue.pop(0)         # O(n) — shifts everything left
```

**Recommended:** `collections.deque` — O(1) at both ends.

```python
from collections import deque
queue = deque()
queue.append(task)         # enqueue at right, O(1)
nxt = queue.popleft()      # dequeue from left, O(1)
```

- **Big-O:** dequeue O(n) → O(1).
- **Rule of thumb:** FIFO (job queues, BFS) → `deque` with `append`/`popleft`. For cross-thread producer/consumer, use `queue.Queue` from the standard library.

---

## 5. Maintaining sorted order with frequent inserts → sortedcontainers (or bisect)

**Inefficient:** append to a list and `sort()` after every insert — O(n log n) per insert.

```python
# ANTI-PATTERN: re-sort on every insert
data = []
data.append(x)
data.sort()                # O(n log n) every time
```

**Recommended:** Python has no built-in balanced tree. The idiomatic library is `sortedcontainers.SortedList` — O(log n) inserts that keep order, with range/neighbor queries.

```python
# pip install sortedcontainers
from sortedcontainers import SortedList
data = SortedList()
data.add(x)                # ~O(log n), stays sorted
i = data.bisect_left(x)    # O(log n) position / range queries
# SortedDict and SortedSet exist too (ordered-map / ordered-set analogues)
```

If you only sort **once** and then read, the standard-library `bisect` module on a plain list is enough (binary search O(log n); inserting via `insort` is still O(n) due to the shift, so use it only when inserts are rare).

```python
import bisect
i = bisect.bisect_left(sorted_list, x)   # O(log n) search into an already-sorted list
```

- **Big-O:** maintain-order O(n log n) per insert → O(log n) per insert with `SortedList`.
- **Rule of thumb:** order must persist across many inserts → `sortedcontainers`. Sort once and only read → `sorted()` plus `bisect`. Note the added dependency for the former.

---

## 6. Fast min/max retrieval → heapq

**Inefficient:** `min()`/`max()` over a list each time — O(n) per call.

```python
# ANTI-PATTERN: O(n) scan for the min every time
jobs = [...]               # (priority, job) tuples
m = min(jobs)              # O(n)
jobs.remove(m)             # O(n)
```

**Recommended:** `heapq` turns a list into a binary min-heap — O(log n) push/pop, O(1) peek.

```python
import heapq
heap = []
heapq.heappush(heap, (priority, job))   # O(log n)
smallest = heap[0]                      # peek min, O(1)
take = heapq.heappop(heap)              # O(log n), removes the min
```

`heapq` is a **min-heap**; for a max-heap, push negated keys (or `(-priority, item)`). For top-k, use `heapq.nlargest`/`nsmallest`.

- **Big-O:** repeated min O(n) → O(log n) to extract, O(1) to peek.
- **Rule of thumb:** repeatedly need the smallest/largest or schedule by priority → `heapq`. Remember it's min-only and not sorted iteration.

---

## 7. Insertion/deletion in the middle → deque ends, rarely a linked list

**Inefficient:** `list.insert(i, x)` / `del list[i]` in the middle shifts elements — O(n).

```python
data.insert(i, x)          # O(n): shifts the tail
del data[i]                # O(n)
```

**Reality for Python:** there is no commonly used standard linked-list type, and a hand-rolled one is almost always slower than a `list` because of Python's per-object overhead and loss of C-level array speed. The idiomatic moves are:
- If the churn is at the **ends**, use `collections.deque` — O(1) appends/pops on both sides.
- If you're removing many items by a condition, **rebuild** with a comprehension (one O(n) pass) instead of repeated O(n) `del`s.

```python
from collections import deque
dq = deque()
dq.appendleft(x); dq.popleft()   # O(1) front ops
dq.append(x);     dq.pop()       # O(1) back ops

data = [x for x in data if keep(x)]   # one O(n) pass beats many O(n) deletes
```

- **Big-O:** front churn O(n) → O(1) with `deque`; mass deletion O(n²) (repeated `del`) → O(n) (single rebuild).
- **Rule of thumb:** in Python, don't reach for a linked list — use `deque` for end churn and comprehension-rebuilds for bulk removal. A real linked list is justified only for specialized node-holding algorithms, and even then measure.
