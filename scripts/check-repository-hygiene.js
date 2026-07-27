#!/usr/bin/env node

const { execFileSync } = require("node:child_process");

const output = execFileSync("git", ["ls-files", "-z", "--", ":(glob)**/node_modules/**"], {
  encoding: "buffer",
});
const trackedNodeModules = output
  .toString("utf8")
  .split("\0")
  .filter(Boolean);

if (trackedNodeModules.length > 0) {
  console.error("Repository hygiene check failed: node_modules installation artifacts must not be tracked.");
  for (const file of trackedNodeModules) {
    console.error(`- ${file}`);
  }
  process.exitCode = 1;
} else {
  console.log("Repository hygiene check passed: no node_modules installation artifacts are tracked.");
}
