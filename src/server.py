import asyncio
import hashlib
import os
import random
import string
import traceback
import aiofiles
import aiosqlite
from datetime import datetime, timedelta

_db: aiosqlite.Connection | None = None
TOTAL_ROUNDS = 92621
CLOUDFLARE_API_TOKEN = ""
CADDY_TEMPLATE = """
{host}.chall.rorre.me {
    reverse_proxy :{port}
    tls {
        dns cloudflare [FILLTHIS]
    }
}
""".replace(
    "[FILLTHIS]", CLOUDFLARE_API_TOKEN
)


class WrongAnswerException(Exception):
    ...


def captcha(inp: str):
    s = inp
    for _ in range(TOTAL_ROUNDS):
        inp = hashlib.sha256(s.encode()).hexdigest()
        s = inp[0]
        for i in range(1, len(inp)):
            s += chr(ord(inp[i]) ^ ord(inp[i - 1]) & 0b10101010)

    return hashlib.sha256(s.encode()).hexdigest()


def random_host(n: int):
    return "".join(
        random.choice(string.ascii_lowercase + string.digits) for _ in range(n)
    )


async def get_db():
    global _db
    if not _db:
        _db = await aiosqlite.connect("instances.db")
    return _db


async def get_port(address: str) -> tuple[str, int, bool]:
    db = await get_db()
    cur = await db.cursor()

    print("[INFO] Check for existence")
    one_hour_ago = int((datetime.utcnow() - timedelta(hours=1)).timestamp())
    res = await cur.execute(
        "SELECT host, port FROM instances WHERE address = ? AND timestamp > ?",
        (address, one_hour_ago),
    )
    if existing := await res.fetchone():
        print("[WARN] User already requested within the last hour, returning previous")
        return existing[0], existing[1], True  # type: ignore

    host = random_host(8)
    random_port = random.randint(10000, 55555)
    cur_timestamp = int(datetime.utcnow().timestamp())

    print(f"[INFO] New user for host {host} at port {random_port}")
    await cur.execute(
        """
        INSERT INTO
            instances (address, host, timestamp, port)
            VALUES (?, ?, ?, ?)
        """,
        (address, host, cur_timestamp, random_port),
    )
    await db.commit()
    return (host, random_port, False)


async def up_server(host: str, port: int):
    print(f"[INFO] Booting up backend for port {port}")
    result = await asyncio.create_subprocess_shell(
        f"docker run -p {port}:3000 -d pmbackend"
    )
    await asyncio.wait_for(result.wait(), timeout=30)
    if result.returncode != 0:
        raise Exception(f"Failed to boot up backend, return code: {result.returncode}")

    print(f"[INFO] Set up caddy for host {host}")
    content = CADDY_TEMPLATE.replace("{host}", host).replace("{port}", str(port))
    async with aiofiles.open(f"sites/{host}", "w") as f:
        await f.write(content)

    print("[INFO] Reloading caddy")
    await asyncio.create_subprocess_shell("caddy reload")


async def ask_captcha(reader: asyncio.StreamReader, writer: asyncio.StreamWriter):
    print("[INFO] Asking for captcha")
    loop = asyncio.get_event_loop()
    writer.write("Generating captcha...\n".encode())
    await writer.drain()

    question = hashlib.sha256(random.randbytes(8)).hexdigest()
    answer = await loop.run_in_executor(None, captcha, question)

    print(f"[INFO] Q: {question} | A: {answer}")

    writer.write(f"Question: {question}\n".encode())
    writer.write("Answer: ".encode())
    await writer.drain()

    user_answer = (await reader.readline()).decode().strip()
    print(f"[INFO] User: {user_answer}")

    if user_answer != answer:
        raise WrongAnswerException


async def handle_client(reader: asyncio.StreamReader, writer: asyncio.StreamWriter):
    address = writer.get_extra_info("peername", ("Unknown",))[0]
    print(f"[INFO] New client from {address}")
    try:
        await asyncio.wait_for(ask_captcha(reader, writer), timeout=30)
        host, port, existing = await get_port(address)

        if not existing:
            await up_server(host, port)

        writer.write(f"Your backend host: https://{host}.chall.rorre.me\n".encode())
        writer.write(f"Internal port: {port}\n".encode())
    except TimeoutError:
        writer.write("Too slow!\n".encode())
    except WrongAnswerException:
        writer.write("Wrong answer!\n".encode())
    except Exception:
        traceback.print_exc()
        writer.write("Something fucked up\n".encode())
    await writer.drain()

    writer.close()
    await writer.wait_closed()


async def run_server():
    print("Listening...")
    server = await asyncio.start_server(handle_client, "0.0.0.0", 5555)
    async with server:
        await server.serve_forever()


async def setup_db():
    db = await get_db()
    await db.execute(
        """
        CREATE TABLE IF NOT EXISTS instances (
               id INTEGER PRIMARY KEY,
               address TEXT NOT NULL,
               host TEXT NOT NULL,
               timestamp INTEGER NOT NULL,
               port INTEGER NOT NULL,
               deleted INTEGER DEFAULT 0
        );"""
    )
    await db.commit()


os.chdir(os.path.dirname(os.path.abspath(__file__)))
asyncio.run(setup_db())
asyncio.run(run_server())
