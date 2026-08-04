#!/bin/sh
set -eu

node bootstrap-sqlite.mjs
exec node server.js
