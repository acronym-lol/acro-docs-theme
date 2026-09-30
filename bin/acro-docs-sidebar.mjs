#!/usr/bin/env node
// Entry point for `npx -p github:acronym-lol/acro-docs-theme#v1 acro-docs-sidebar docs` and
// for the reusable workflow. The logic lives in sidebar/generate.mjs so tests can import it
// without running anything.
import { main } from '../sidebar/generate.mjs';

process.exitCode = main(process.argv.slice(2));
