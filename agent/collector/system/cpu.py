# agent/collector/system/cpu.py

import psutil
import time


async def collect_cpu(event_bus):
    """
    Collect CPU-related metrics and publish them to the event bus.

    This function:
    1. Reads system CPU metrics using psutil
    2. Builds a structured event dictionary
    3. Publishes the event to the event bus

    It does NOT store data.
    It does NOT analyze data.
    It only produces and publishes.
    """

    # Get CPU frequency
    freq = psutil.cpu_freq()

    # Get CPU times percentage (non-blocking)
    cpu_times = psutil.cpu_times_percent(interval=None)

    # Get load average (1m, 5m, 15m)
    load_1m, load_5m, load_15m = psutil.getloadavg()

    # Get context switches
    ctx_switches = psutil.cpu_stats().ctx_switches

    # Calculate system uptime
    system_uptime_seconds = time.time() - psutil.boot_time()

    # Build event payload (simple structure for now)
    event = {
        "timestamp": time.time(),
        "type": "cpu_metrics",
        "data": {
            "cpu_usage": psutil.cpu_percent(interval=None),
            "per_core_usage": psutil.cpu_percent(interval=None, percpu=True),
            "load_avg": {
                "1m": load_1m,
                "5m": load_5m,
                "15m": load_15m,
            },
            "io_wait": getattr(cpu_times, "iowait", 0.0),
            "user_time": cpu_times.user,
            "system_time": cpu_times.system,
            "context_switches": ctx_switches,
            "frequency_mhz": freq.current if freq else None,
            "system_uptime_seconds": round(system_uptime_seconds, 2),
        }
    }

    # Right after building the event
    print(f". . . CPU Data collected . . .")

    # Publish event to event bus
    await event_bus.publish(event)