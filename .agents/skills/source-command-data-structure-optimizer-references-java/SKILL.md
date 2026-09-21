---
name: "source-command-data-structure-optimizer-references-java"
description: "Migrated source command `data-structure-optimizer-references-java`"
---

# source-command-data-structure-optimizer-references-java

Use this skill when the user asks to run the migrated source command `data-structure-optimizer-references-java`.

## Command Template

# Java — before/after scenarios

Idiomatic Java structures from `java.util` (and `java.util.concurrent` where noted). Java has rich standard-library support: `ArrayDeque` for stacks/queues, `HashSet`/`HashMap`, `TreeMap`/`TreeSet` (red-black tree, ordered), and `PriorityQueue` (binary heap). You rarely need a third-party library for core data structures.

General idiom notes:
- Program to interfaces: `List<>`, `Set<>`, `Map<>`, `Deque<>`, `Queue<>`.
- Prefer `ArrayDeque` over the legacy `Stack` class (which is synchronized and extends `Vector`) and over `LinkedList` for queue/stack use — `ArrayDeque` is faster and the documented choice.
- Use `HashMap` methods like `getOrDefault`, `merge`, and `computeIfAbsent` instead of manual get-check-put.

---

## 1. Back-button / undo history → Stack (LIFO)

**Inefficient:** an `ArrayList` where you "pop" by removing index 0. `remove(0)` shifts every remaining element left — O(n) per pop.

```java
// ANTI-PATTERN: O(n) per pop because remove(0) shifts all elements
List<String> history = new ArrayList<>();
history.add(url);                 // visit
String prev = history.remove(0);  // O(n) — wrong end, wrong semantics
```

**Recommended:** `ArrayDeque` used as a stack — O(1) push/pop.

```java
Deque<String> history = new ArrayDeque<>();
history.push(url);                // O(1)
String prev = history.pop();      // O(1), most-recent-first (LIFO)
String top  = history.peek();     // O(1) look without removing
```

- **Big-O:** pop O(n) → O(1). Inside a loop of n operations: O(n²) → O(n).
- **Rule of thumb:** most-recent-first access (undo, back button, DFS, bracket matching) → use a `Deque` as a stack, never `remove(0)` on a list.

---

## 2. Membership testing → HashSet

**Inefficient:** `List.contains()` is a linear scan — O(n). In a loop, O(n²).

```java
// ANTI-PATTERN: O(n) per lookup, O(n*m) overall
List<String> blocked = List.of(...);
for (String user : incoming) {
    if (blocked.contains(user)) { ... }   // O(n) each time
}
```

**Recommended:** `HashSet` — O(1) average lookup.

```java
Set<String> blocked = new HashSet<>(List.of(...));
for (String user : incoming) {
    if (blocked.contains(user)) { ... }   // O(1) average
}
```

- **Big-O:** lookup O(n) → O(1) average. Loop: O(n·m) → O(m).
- **Rule of thumb:** if you ask "is X in this collection?" more than a couple of times, store it in a `HashSet`. Use `LinkedHashSet` if you also need insertion order; `TreeSet` if you need sorted order.

---

## 3. Frequency counting / key-value lookup → HashMap

**Inefficient:** parallel lists or a list of pairs you scan to find a key — O(n) per update.

```java
// ANTI-PATTERN: linear search to find the count to increment
List<String> words = ...;
List<String> keys = new ArrayList<>();
List<Integer> counts = new ArrayList<>();
for (String w : words) {
    int i = keys.indexOf(w);      // O(n)
    if (i < 0) { keys.add(w); counts.add(1); }
    else counts.set(i, counts.get(i) + 1);
}
```

**Recommended:** `HashMap` with `merge` — O(1) average per update.

```java
Map<String, Integer> freq = new HashMap<>();
for (String w : words) {
    freq.merge(w, 1, Integer::sum);   // O(1) average
}
```

- **Big-O:** per update O(n) → O(1) average; overall O(n²) → O(n).
- **Rule of thumb:** any "look something up by a key" or "count by category" → `HashMap`. Reach for `merge`/`computeIfAbsent`, not get-then-put.

---

## 4. FIFO task queue → ArrayDeque

**Inefficient:** `ArrayList` where you take work from the front with `remove(0)` — O(n) per dequeue.

```java
// ANTI-PATTERN: O(n) per dequeue
List<Task> queue = new ArrayList<>();
queue.add(task);                 // enqueue
Task next = queue.remove(0);     // O(n) — shifts everything
```

**Recommended:** `ArrayDeque` as a FIFO queue — O(1) both ends.

```java
Queue<Task> queue = new ArrayDeque<>();
queue.offer(task);               // O(1) enqueue at tail
Task next = queue.poll();        // O(1) dequeue from head
```

- **Big-O:** dequeue O(n) → O(1).
- **Rule of thumb:** first-in-first-out work (job queues, BFS frontier, buffers) → `ArrayDeque`. For producer/consumer across threads, use `ArrayBlockingQueue`/`LinkedBlockingQueue` from `java.util.concurrent`.

---

## 5. Maintaining sorted order with frequent inserts → TreeMap / TreeSet

**Inefficient:** add to an `ArrayList` and re-sort after each insert — O(n log n) every time.

```java
// ANTI-PATTERN: re-sort on every insert → O(n log n) each
List<Integer> sorted = new ArrayList<>();
sorted.add(x);
Collections.sort(sorted);        // O(n log n) every insert
```

**Recommended:** `TreeSet`/`TreeMap` (red-black tree) keeps order incrementally — O(log n) per insert.

```java
NavigableSet<Integer> sorted = new TreeSet<>();
sorted.add(x);                   // O(log n), stays sorted
// bonus ordered queries, all O(log n):
Integer justBelow = sorted.floor(x);     // largest <= x
Integer justAbove = sorted.ceiling(x);   // smallest >= x
```

- **Big-O:** maintain-order O(n log n) per insert → O(log n) per insert; plus O(log n) range/neighbor queries a sorted array can't match without binary search and shifting.
- **Rule of thumb:** need things to *stay* sorted as you insert/delete, or need floor/ceiling/range → `TreeMap`/`TreeSet`. If you sort *once* and only read, a sorted `ArrayList` + `Collections.binarySearch` is simpler and faster.

---

## 6. Fast min/max retrieval → PriorityQueue (heap)

**Inefficient:** scan the whole list to find the minimum each time — O(n) per retrieval.

```java
// ANTI-PATTERN: O(n) scan for the min on every poll
List<Job> jobs = ...;
Job min = Collections.min(jobs, byPriority);   // O(n)
jobs.remove(min);                              // O(n)
```

**Recommended:** `PriorityQueue` (binary min-heap) — O(log n) to remove the min, O(1) to peek.

```java
PriorityQueue<Job> pq = new PriorityQueue<>(Comparator.comparingInt(Job::priority));
pq.offer(job);                  // O(log n)
Job min = pq.peek();            // O(1)
Job take = pq.poll();           // O(log n), removes the smallest
```

For top-k largest, use a bounded min-heap of size k; for max-heap behavior, reverse the comparator.

- **Big-O:** repeated min O(n) → O(log n) to extract, O(1) to peek.
- **Rule of thumb:** repeatedly need the smallest/largest, or schedule by priority → `PriorityQueue`. Note a heap gives min *or* max, not sorted iteration.

---

## 7. Insertion/deletion in the middle → LinkedList (with a caveat)

**Inefficient (in theory):** inserting/removing in the middle of an `ArrayList` shifts elements — O(n).

```java
list.add(index, item);     // O(n): shifts the tail right
list.remove(index);        // O(n): shifts the tail left
```

**Recommended (in theory):** `LinkedList` does O(1) splice *at a node you already hold* via a `ListIterator`.

```java
LinkedList<Item> list = new LinkedList<>();
ListIterator<Item> it = list.listIterator();
// ... advance to position ...
it.add(item);              // O(1) at the iterator's current node
it.remove();               // O(1)
```

- **Big-O:** middle insert/delete *at a held position* O(n) → O(1).
- **Caveat — read this before switching:** reaching an arbitrary index in a `LinkedList` is itself O(n), and its per-node pointer chasing destroys cache locality, so in practice `ArrayList` usually outperforms `LinkedList` even for middle operations unless you're already positioned via an iterator. Only prefer `LinkedList` when you genuinely hold the node/iterator (e.g., LRU cache eviction). Otherwise keep `ArrayList`.
- **Rule of thumb:** "many middle inserts" alone does *not* justify a linked list in Java — measure. It pays off only when you hold the position and aren't indexing in.
