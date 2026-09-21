---
name: "source-command-kill"
description: "Stop all Spidr local dev services by killing ports 8080 (spidr-auth), 4000 (spidr-server), and 5173 (spidr-client). Call with /kill to tear down the local stack started by /dev."
---

# source-command-kill

Use this skill when the user asks to run the migrated source command `kill`.

## Command Template

# Kill Spidr Dev Stack

Run this single Bash command to kill all three dev ports at once:

```bash
npx kill-port 4000 5173 8080 2>/dev/null; echo "done"
```

Once it completes, report to the user:

```
Spidr dev stack stopped:

  spidr-auth   :8080  ✓
  spidr-server :4000  ✓
  spidr-client :5173  ✓
```

If a port wasn't running, kill-port silently skips it — that's fine, no need to flag it as an error.
