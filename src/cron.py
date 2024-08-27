#!/usr/bin/env python3
from datetime import datetime, timedelta
import json
import os
import sqlite3
import subprocess
import traceback
from typing import TypedDict

os.chdir(os.path.dirname(os.path.abspath(__file__)))


class Container(TypedDict):
    Command: str
    CreatedAt: str
    ID: str
    Image: str
    Labels: str
    LocalVolumes: str
    Mounts: str
    Names: str
    Networks: str
    Ports: str
    RunningFor: str
    Size: str
    State: str
    Status: str


db = sqlite3.connect("instances.db")
t = int((datetime.utcnow() - timedelta(hours=1)).timestamp())

cur = db.cursor()
cur.execute(
    "SELECT id, host, port FROM instances WHERE timestamp < ? AND deleted = 0", (t,)
)
containers: list[Container] = [
    json.loads(line.strip())
    for line in subprocess.check_output(
        "docker ps --format json", shell=True
    ).splitlines()
]

for row in cur.fetchall():
    id, host, port = row
    print(f"[INFO] Deleting host {host} in port {port}")
    try:
        os.unlink(f"sites/{host}")
        subprocess.run("caddy reload", shell=True)

        row_container = None
        for container in containers:
            if str(port) in container["Ports"]:
                row_container = container

        if not row_container:
            continue

        container_id = row_container["ID"]

        subprocess.run("docker rm --force " + container_id, shell=True)
        cur.execute("UPDATE instances SET deleted = 1 WHERE id = ?", (id,))
    except Exception:
        print("[ERR] Error during deletion, err:")
        traceback.print_exc()

db.commit()