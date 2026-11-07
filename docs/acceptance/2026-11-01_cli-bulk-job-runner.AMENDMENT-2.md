# CLI bulk job runner — Amendment 2 (Dept13 FAIL @0ecd9ed7 round, 5 Nov 2026)

Committed on its own, after the base acceptance + Amendment 1 and before any further code on
this round. Dept13 checks the build against the base acceptance as amended by this file.
Verdict format: exact first line `Dept13 PASS|FAIL @<full 40-hex sha>` (no CONDITIONAL).

Prior Amendment 1 points 1–4 remain MET. Point 5 (timeout) is tightened by A2.1 below.

## A2.1 Timeout kills the whole process group; child cannot hold the flock

The sh runner starts the agent in its own session/process group (`setsid`), closes lock fd 9
in the child so the child cannot hold the flock, and on timeout sends TERM to the group then
KILL to the group (not only TERM to descendants and KILL to the subshell). A TERM-ignoring
descendant must actually die, and a later run must get the lock (not exit 75 from a stale
lock). A test covers this.
