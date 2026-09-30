import psutil
import time
import asyncio
import socket
import subprocess


def _lsof_connections_data():
    """
    Fallback per-process connection enumeration via `lsof -i`.

    Used when psutil.net_connections() is denied (macOS without root).
    Without elevated privileges only the current user's processes are visible.
    """
    try:
        result = subprocess.run(
            ["lsof", "-i", "-P", "-n"],
            capture_output=True,
            text=True,
            timeout=5,
        )
    except (OSError, subprocess.SubprocessError):
        return {}, []

    connections_per_process = {}

    for line in result.stdout.splitlines()[1:]:
        parts = line.split(None, 8)
        if len(parts) < 9 or not parts[1].isdigit():
            continue

        command, pid, name = parts[0], int(parts[1]), parts[8].strip()

        status = None
        if name.endswith(")") and "(" in name:
            status = name[name.rfind("(") + 1:-1].strip()

        # local endpoint only (drop the "-> peer" half for established sockets)
        local = name.split("->", 1)[0].split("(", 1)[0].strip()

        port = None
        if ":" in local:
            port_part = local.rsplit(":", 1)[1]
            if port_part.isdigit():
                port = int(port_part)

        entry = connections_per_process.setdefault(
            pid,
            {"pid": pid, "name": command, "connections": []},
        )

        # lsof only prints a socket state for TCP (UDP is stateless)
        conn_type = "tcp" if (status is not None or "->" in name) else "udp"

        entry["connections"].append({
            "port": port,
            "status": status,
            "type": conn_type,
        })

    network_process_list = [
        {"pid": data["pid"], "name": data["name"]}
        for data in connections_per_process.values()
    ]

    return connections_per_process, network_process_list


def get_process_bandwidth_estimate(connections_per_process):
    bandwidth_per_process = {}

    for pid, data in connections_per_process.items():
        connections = data.get("connections", [])
        weight = 0
        for conn in connections:
            if conn.get("status") == "ESTABLISHED":
                weight += 3
            else:
                weight += 1

        bandwidth_per_process[pid] = {
            "pid": pid,
            "name": data.get("name", "unknown"),
            "estimated_bandwidth": weight,
        }

    return bandwidth_per_process


def get_top_processes_by_bandwidth(bandwidth_per_process, top_n=5):
    if not bandwidth_per_process:
        return []

    sorted_processes = sorted(
        bandwidth_per_process.values(),
        key=lambda x: x["estimated_bandwidth"],
        reverse=True
    )
    return sorted_processes[:top_n]


def get_connections_data():
    try:
        connections = psutil.net_connections()
    except (psutil.AccessDenied, PermissionError):
        # macOS requires elevated privileges for system-wide socket enumeration.
        # Fall back to lsof, which still reports the current user's sockets.
        return _lsof_connections_data()

    connections_per_process = {}

    for conn in connections:
        pid = conn.pid
        if pid is None:
            continue

        try:
            proc = psutil.Process(pid)
            name = proc.name()
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            continue

        if pid not in connections_per_process:
            connections_per_process[pid] = {
                "pid": pid,
                "name": name,
                "connections": []
            }

        if not conn.laddr:
            continue

        if conn.type == socket.SOCK_STREAM:
            conn_type = "tcp"
        elif conn.type == socket.SOCK_DGRAM:
            conn_type = "udp"
        else:
            conn_type = "other"

        connections_per_process[pid]["connections"].append({
            "port": conn.laddr.port,
            "status": conn.status,
            "type": conn_type,
        })

    network_process_list = [
        {
            "pid": data["pid"],
            "name": data["name"]
        }
        for data in connections_per_process.values()
    ]
    return connections_per_process, network_process_list

async def collect_process_network_usage(event_bus):
    """
    Collect process-level network usage metrics.
    """
    connections_per_process, network_process_list = await asyncio.to_thread(get_connections_data)
    top_connections = sorted(
        connections_per_process.values(),
        key=lambda p: len(p.get("connections", [])),
        reverse=True
    )[:5]

    bandwidth_data = get_process_bandwidth_estimate(connections_per_process)
    top_bandwidth = get_top_processes_by_bandwidth(bandwidth_data)

    event = {
        "timestamp": time.time(),
        "type": "network_process_metrics",
        "data": {
            "connections_per_process": connections_per_process,
            "network_process_list": network_process_list,
            "top_processes_by_connections": top_connections,
            "top_processes_by_bandwidth": top_bandwidth
        }
    }

    print(". . . Process Network Data collected . . .")

    await event_bus.publish(event)