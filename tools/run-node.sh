#!/bin/sh
set -eu
ygp_node="$(command -v node)"
"$ygp_node" -e 'const [a,b,c]=process.versions.node.split(".").map(Number);if(a!==24||b<22||(b===22&&c<3)){console.error("Use Node 24.22.3 ou um patch posterior da série 24. Execute nvm use neste projeto.");process.exit(1)}'
exec "$ygp_node" "$@"
