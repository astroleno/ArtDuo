# @artduo/pipeline

Phase 0 scaffold for the V2 pipeline workspace.

- During bootstrap, MET collection still runs through the legacy scripts in `scripts/collect/`.
- Root `collect:met:probe` and `collect:met:batch` now delegate through this package so ownership can move here without blocking Phase 1.
- Release manifest, shard builders, and scene normalization should be implemented here next.
