#!/bin/sh
# NetGuard passwordless-sudo grant for the specific diagnostic binaries it needs.
# Run ONCE as an administrator:
#   sudo scripts/setup-sudo.sh
#
# This grants the current user passwordless sudo ONLY for:
#   - nmap      (deep OS/vuln scans)
#   - tcpdump   (packet capture)
#   - pfctl     (firewall rule application)
# No other sudo access is granted.

set -e

if [ "$(id -u)" -ne 0 ]; then
  echo "ERROR: run this script with sudo:  sudo scripts/setup-sudo.sh" >&2
  exit 1
fi

NMAP_BIN=""
for cand in /opt/homebrew/bin/nmap /usr/local/bin/nmap /usr/bin/nmap; do
  if [ -x "$cand" ]; then NMAP_BIN="$cand"; break; fi
done

TCPDUMP_BIN="/usr/sbin/tcpdump"
PFCTL_BIN="/sbin/pfctl"

if [ -z "$NMAP_BIN" ]; then
  echo "WARNING: nmap not found in common paths. It will be omitted from sudoers." >&2
fi

TARGET="/etc/sudoers.d/netguard"
RULES="$(whoami) ALL=(root) NOPASSWD:"

[ -n "$NMAP_BIN" ] && RULES="$RULES $NMAP_BIN,"
RULES="$RULES $TCPDUMP_BIN, $PFCTL_BIN"

umask 022
cat > "$TARGET" <<EOF
# Managed by NetGuard setup-sudo.sh. Grants passwordless sudo for diagnostic tools only.
$RULES
EOF

chown root:wheel "$TARGET"
chmod 0440 "$TARGET"

echo "Installed $TARGET"
echo "Contents:"
cat "$TARGET"

if visudo -c >/dev/null 2>&1; then
  echo "sudoers syntax check: OK"
else
  echo "sudoers syntax check: FAILED - restoring safety by removing the file" >&2
  rm -f "$TARGET"
  exit 1
fi

echo "Done. NetGuard now has passwordless access to the listed tools."
