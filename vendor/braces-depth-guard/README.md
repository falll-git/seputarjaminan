# Local braces depth guard

This is an MIT-licensed local fork, not an upstream security release and not an
advisory exception. It preserves the public braces 3.0.3 API and vendors the code
from https://github.com/micromatch/braces/pull/72 at immutable source commit
28d440b5dd449dbf1fe6f3506cf94ecca4d02660 (FSDevelop/braces). Only package metadata
and LF/end-of-file normalization differ; index.js and lib/* are that revision.
Upstream advisory: https://github.com/advisories/GHSA-vfj7-8cjw-p6xm.

Reason: the advisory has no patched upstream release at adoption time. Parsing
and recursive AST walkers are bounded to depth 100; lower maxDepth limits remain
available, larger limits cannot disable the cap, and cyclic parent chains reject.
Do not substitute another dependency/version merely to obtain a green audit.

Installation uses a direct dev dependency named braces with this fork's truthful
package name/version, plus an npm $braces override. The reviewed archive is
checked into vendor/ for reproducible npm ci; no postinstall network patching.
Run node scripts/verify-braces-fork.cjs after npm ci. It checks source/archive
integrity and actual installed API behavior through the Next lint dependency.
Upstream 904-test run and clean-install evidence are recorded outside release.

To update: review upstream commit and license, run its full tests plus the local
verifier, regenerate the archive with npm pack --ignore-scripts --pack-destination
.. in this directory, and update provenance.json deliberately. Never change the
manifest to bless an unknown binary. Return to an official patched release only
after advisory and compatibility verification. This local fork needs maintenance;
zero registry audit findings alone are not proof of absence of vulnerabilities.
