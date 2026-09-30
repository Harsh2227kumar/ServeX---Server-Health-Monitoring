import psutil
import time
from collections import defaultdict


# Conversion constant
BYTES_TO_MB = 1024 ** 2

# Number of top processes to report
TOP_N = 20


async def collect_process(event_bus):
    """
    Collect process related metrics and publish them to the event bus.

    This function:
    1. Collects system level process statistics
    2. Finds top CPU consuming processes
    3. Finds top memory consuming processes
    4. Tracks process creation rate
    5. Publishes a single structured event
    """

    current_time = time.time()

    # Get all running processes with selected attributes
    processes = list(psutil.process_iter([
        'pid',
        'name',
        'status',
        'cpu_percent',
        'memory_percent',
        'num_threads',
        'memory_info',
        'username',
        'create_time'
    ]))

    # Counters for process summary
    total_processes = 0
    running_processes = 0
    sleeping_processes = 0
    stopped_processes = 0
    zombie_processes = 0
    threads_total = 0

    # Stores process level details
    process_list = []

    # Track how many processes belong to each user
    process_count_by_user = defaultdict(int)

    for proc in processes:
        try:
            info = proc.info

            total_processes += 1

            status = info['status']

            # Count process states
            if status == psutil.STATUS_RUNNING:
                running_processes += 1
            elif status == psutil.STATUS_SLEEPING:
                sleeping_processes += 1
            elif status == psutil.STATUS_STOPPED:
                stopped_processes += 1
            elif status == psutil.STATUS_ZOMBIE:
                zombie_processes += 1

            # Count total threads in the system
            threads_total += info['num_threads'] or 0

            # Count processes by user
            username = info['username']
            if username:
                process_count_by_user[username] += 1

            # Convert memory usage to MB
            memory_mb = None
            if info['memory_info']:
                memory_mb = round(info['memory_info'].rss / BYTES_TO_MB, 2)

            # Calculate how long the process has been running
            uptime_seconds = None
            if info['create_time']:
                uptime_seconds = round(current_time - info['create_time'], 2)

            # Store process information for later sorting
            process_list.append({
                "pid": info['pid'],
                "name": info['name'],
                "cpu_percent": info['cpu_percent'],
                "memory_percent": info['memory_percent'],
                "memory_mb": memory_mb,
                "threads": info['num_threads'],
                "status": status,
                "uptime_seconds": uptime_seconds
            })

        # Processes may disappear during iteration
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            continue

    # Identify top CPU consuming processes
    top_cpu_processes = sorted(process_list,key=lambda p: p["cpu_percent"] or 0,reverse=True)[:TOP_N]

    # Identify top memory consuming processes
    top_memory_processes = sorted(process_list,key=lambda p: p["memory_percent"] or 0,reverse=True)[:TOP_N]

    # Calculate number of new processes since last interval
    if not hasattr(collect_process, "_prev_total"):
        new_processes = 0
    else:
        new_processes = total_processes - collect_process._prev_total
        if new_processes < 0:
            new_processes = 0

    # Store current total for next interval comparison
    collect_process._prev_total = total_processes

    # Build the final event payload
    event = {
        "timestamp": current_time,
        "type": "process_metrics",
        "data": {

            # System level process summary
            "process_summary": {
                "total": total_processes,
                "running": running_processes,
                "sleeping": sleeping_processes,
                "stopped": stopped_processes,
                "zombie": zombie_processes,
                "threads_total": threads_total
            },

            # Process count grouped by user
            "process_count_by_user": dict(process_count_by_user),

            # Top CPU consumers
            "top_cpu_processes": top_cpu_processes,

            # Top memory consumers
            "top_memory_processes": top_memory_processes,

            # Number of processes created in the last interval
            "new_processes_last_interval": new_processes
        }
    }

    print(f". . . Processes Data collected . . .")

    await event_bus.publish(event)