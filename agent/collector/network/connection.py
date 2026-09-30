import psutil
import time
import os # for log file access
import socket
import subprocess


# TCP states as reported by `netstat -an`
_TCP_STATES = {
    "ESTABLISHED", "LISTEN", "TIME_WAIT", "CLOSE_WAIT", "SYN_SENT",
    "SYN_RECEIVED", "LAST_ACK", "CLOSING", "CLOSED", "FIN_WAIT_1",
    "FIN_WAIT_2",
}


def _netstat_connections():
    """
    Fallback connection enumeration via `netstat -an`.

    Used when psutil cannot enumerate sockets (e.g. macOS without root).
    Returns a list of normalized connection dicts.
    """
    try:
        result = subprocess.run(
            ["netstat", "-an"],
            capture_output=True,
            text=True,
            timeout=5,
        )
    except (OSError, subprocess.SubprocessError):
        return []

    connections = []

    for line in result.stdout.splitlines():
        parts = line.split()
        if len(parts) < 4:
            continue

        proto = parts[0]
        if proto.startswith("tcp"):
            conn_type = "tcp"
        elif proto.startswith("udp"):
            conn_type = "udp"
        else:
            continue

        status = None
        if conn_type == "tcp" and parts[-1] in _TCP_STATES:
            status = parts[-1]

        connections.append({
            "type": conn_type,
            "status": status,
            "laddr": parts[3],
            "raddr": parts[4] if len(parts) >= 5 else None,
        })

    return connections


def _connection_snapshot():
    """
    Return a platform-independent list of connection dicts.

    Prefers psutil; falls back to netstat when the OS denies enumeration
    (macOS requires elevated privileges for psutil.net_connections()).
    """
    try:
        raw = psutil.net_connections()
    except (psutil.AccessDenied, PermissionError):
        return _netstat_connections()

    snapshot = []

    for conn in raw:
        if conn.type == socket.SOCK_STREAM:
            conn_type = "tcp"
        elif conn.type == socket.SOCK_DGRAM:
            conn_type = "udp"
        else:
            conn_type = "other"

        snapshot.append({
            "type": conn_type,
            "status": conn.status,
            "laddr": (conn.laddr.ip, conn.laddr.port) if conn.laddr else None,
            "raddr": (conn.raddr.ip, conn.raddr.port) if conn.raddr else None,
        })

    return snapshot


prev_established_conns = set()
prev_timestamp = None

# store previous counter
prev_attempt_fails = None

# Keep track of file position between calls
log_positions = {}

# store previous counters
_prev_tcp_stats = None
_prev_timestamp = None


def failed_connections_snmp(per_minute=False):
    """
    Return TCP connection metrics from /proc/net/snmp.
    
    Returns:
        dict with keys:
            - total_attempts: ActiveOpens (delta since last call or None)
            - failed_attempts: AttemptFails (delta since last call or None)
        If per_minute=True, rates are normalized to per minute.
    """
    global _prev_tcp_stats, _prev_timestamp

    try:
        with open("/proc/net/snmp", "r", errors="ignore") as f:
            lines = f.readlines()
    except (FileNotFoundError, PermissionError):
        return None

    # locate TCP section
    for i, line in enumerate(lines):
        if line.startswith("Tcp:"):
            header_line = line
            value_line = lines[i + 1]
            break
    else:
        return None

    headers = header_line.strip().split()[1:]  # skip "Tcp:"
    values = list(map(int, value_line.strip().split()[1:]))  # skip "Tcp:"

    current_stats = dict(zip(headers, values))
    current_time = time.time()

    # first run
    if _prev_tcp_stats is None:
        _prev_tcp_stats = current_stats
        _prev_timestamp = current_time
        return {"total_attempts": None, "failed_attempts": None}

    # compute deltas
    delta_time = current_time - _prev_timestamp
    total_attempts = current_stats.get("ActiveOpens", 0) - _prev_tcp_stats.get("ActiveOpens", 0)
    failed_attempts = current_stats.get("AttemptFails", 0) - _prev_tcp_stats.get("AttemptFails", 0)

    _prev_tcp_stats = current_stats
    _prev_timestamp = current_time

    if total_attempts < 0:
        total_attempts = None  # counter reset
    if failed_attempts < 0:
        failed_attempts = None

    # normalize to per minute if requested
    if per_minute and delta_time > 0:
        factor = 60 / delta_time
        if total_attempts is not None:
            total_attempts = total_attempts * factor
        if failed_attempts is not None:
            failed_attempts = failed_attempts * factor

    return {"total_attempts": total_attempts, "failed_attempts": failed_attempts}


def failed_connections_logs(log_file="/var/log/syslog", keywords=None):
    """
    Count failed connection attempts from log file.
    """
    global log_positions

    if keywords is None:
        keywords = ["connection refused", "failed to connect", "timeout", "reset by peer"]

    # Track last read position
    last_pos = log_positions.get(log_file, 0)

    if not os.path.exists(log_file):
        return None

    count = 0

    try:
        with open(log_file, "r", errors="ignore") as f:
            f.seek(last_pos)
            for line in f:
                if any(keyword.lower() in line.lower() for keyword in keywords):
                    count += 1

            # update last position
            log_positions[log_file] = f.tell()
    except (FileNotFoundError, PermissionError, UnicodeDecodeError):
        return None

    return count


# established connections per second 

def established_connection_rate(snapshot=None):
    global prev_established_conns, prev_timestamp

    current_time = time.time()

    if snapshot is None:
        snapshot = _connection_snapshot()

    # extract only ESTABLISHED connections
    current_established = {
        (c["laddr"], c["raddr"], c["type"])
        for c in snapshot
        if c["status"] == "ESTABLISHED"
    }

    # first run
    if prev_timestamp is None:
        prev_established_conns = current_established
        prev_timestamp = current_time
        return None

    # find new established connections
    new_connections = current_established - prev_established_conns

    time_diff = current_time - prev_timestamp

    # update state
    prev_established_conns = current_established
    prev_timestamp = current_time

    if time_diff <= 0:
        return None

    # normalize to per second
    return len(new_connections) / time_diff



async def collect_network_connections(event_bus):
    """
    Collect network connection-related metrics using psutil.
    """

    snapshot = _connection_snapshot()

    total_connections = len(snapshot)
    tcp_connections = sum(1 for c in snapshot if c["type"] == "tcp")
    udp_connections = sum(1 for c in snapshot if c["type"] == "udp")
    established_connections = sum(1 for c in snapshot if c["status"] == "ESTABLISHED")
    listening_sockets = sum(1 for c in snapshot if c["status"] == "LISTEN")
    time_wait_connections = sum(1 for c in snapshot if c["status"] == "TIME_WAIT")

    event = {
        "timestamp": time.time(),
        "type": "network_connection_metrics",
        "data": {
            "total_connections": total_connections,
            "tcp_connections": tcp_connections,
            "udp_connections": udp_connections,
            "established_connections": established_connections,
            "listening_sockets": listening_sockets,
            "time_wait_connections": time_wait_connections,

            # Derived / later
            "connection_rate": established_connection_rate(snapshot),
            "failed_connections_total": failed_connections_logs(),  #  there are two methods for this, failed connectionfrom logs
            "failed_connections_second" : failed_connections_snmp(per_minute=True)
        }
    }

    print(". . . Network Connection Data collected . . .")

    await event_bus.publish(event)