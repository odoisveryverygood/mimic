#!/bin/zsh
cd -- "${0:A:h}"
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
if ! command -v node >/dev/null 2>&1; then
  print 'Mimic needs Node.js 22.12 or newer. Install Node.js, then open this file again.'
  read '?Press Enter to close.'
  exit 1
fi
if curl -fsS http://127.0.0.1:4318/api/state >/dev/null 2>&1; then
  open http://127.0.0.1:4318
  exit 0
fi
if [[ ! -d node_modules ]]; then
  npm ci || exit 1
fi
if [[ ! -f dist/index.html ]]; then
  npm run build || exit 1
fi
( sleep 2; open http://127.0.0.1:4318 ) &
npm start
