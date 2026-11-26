"""Smoke-test the Docker distribution on localhost."""

import re
import time
from pathlib import Path
from urllib.error import URLError
from urllib.request import Request, urlopen

BASE = "http://127.0.0.1:8080"


def request(path):
    with urlopen(BASE + path, timeout=30) as response:
        return response.read().decode()


def cache_control(path):
    with urlopen(Request(BASE + path, method="HEAD"), timeout=30) as response:
        return response.headers.get("Cache-Control")


for attempt in range(30):
    try:
        index = request("/")
        break
    except URLError:
        if attempt == 29:
            raise
        time.sleep(1)

asset = re.search(r'<script[^>]+src="(/assets/[^"]+\.js)"', index)
bundle = request(asset[1]) if asset else ""
assert bundle, "Built frontend script is missing"

# The page is Learning Kubernetes made easy, and its lab pages include both guides, which are read when the image is built.
title = "<title>Learning Kubernetes made easy - Aviz Academy</title>"
assert title in index, "The page is not Learning Kubernetes made easy"

# Browsers check the page on every visit and keep the hashed files, so a new release shows up at once.
assert cache_control("/") == "no-cache", cache_control("/")
assert cache_control(asset[1]) == "public, max-age=31536000, immutable", cache_control(asset[1])
print("The page is checked on every visit and hashed files are cached for a year")
root = Path(__file__).resolve().parent.parent
for guide in ("docs/lab-1-hello-kubernetes.md", "docs/lab-2-your-app-on-eks.md"):
    text = (root / guide).read_text(encoding="utf-8")
    # Command lines with no quotes, backslashes, or dollar signs appear unchanged in the built script.
    commands = [
        line for block in re.findall(r"^```bash\n(.*?)\n```$", text, re.M | re.S)
        for line in block.split("\n") if line.strip() and not re.search(r"[\"'`$\\]", line)
    ]
    assert len(commands) >= 3, f"{guide}: too few plain commands to check"
    missing = [line for line in commands if line not in bundle]
    assert not missing, f"{guide} is missing from the built lab page: {missing[:3]}"
    print(f"{guide}: all {len(commands)} plain commands are in the built lab page")
