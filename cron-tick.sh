#!/usr/bin/env bash
# Scheduler gate. Cron fires this EVERY HOUR; it runs the alert only at the
# target Melbourne local hours (20:00, 02:00, 08:00, 14:00) and exits silently
# otherwise.
#
# Why hourly+gate instead of fixed cron times: this box runs in UTC and its cron
# build lacks CRON_TZ, so a fixed cron line would drift by an hour at the AEST<->AEDT
# DST switch. Resolving the Melbourne hour here (via tzdata) is DST-proof —
# Melbourne is always a whole-hour offset, so the UTC :00 tick lines up exactly.
set -euo pipefail
cd "$(dirname "$0")"

HOUR=$(TZ=Australia/Melbourne date +%H)
case "$HOUR" in
  20|02|08|14) exec ./run.sh ;;
  *) exit 0 ;;
esac
