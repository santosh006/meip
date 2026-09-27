"""Configuration loading. Reads .env with no third-party dependency."""
from __future__ import annotations

import os
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent
ENV_PATH = PROJECT_ROOT / ".env"

_loaded = False


def load_env(path: Path | None = None, override: bool = False) -> None:
    """Parse a .env file into os.environ.

    Deliberately minimal: KEY=VALUE, '#' comments, optional surrounding
    quotes. Blank values are kept as empty strings so that callers can
    distinguish "key present but unfilled" from "key absent".
    """
    global _loaded
    path = path or ENV_PATH
    if not path.exists():
        _loaded = True
        return
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("export "):
            line = line[len("export "):].strip()
        if "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
            value = value[1:-1]
        if override or key not in os.environ:
            os.environ[key] = value
    _loaded = True


def env(name: str, default: str = "") -> str:
    if not _loaded:
        load_env()
    return os.environ.get(name, default).strip()


def env_bool(name: str, default: bool = False) -> bool:
    val = env(name, "").lower()
    if not val:
        return default
    return val in {"1", "true", "yes", "on"}


def env_float(name: str, default: float) -> float:
    try:
        return float(env(name, "") or default)
    except ValueError:
        return default


def env_list(name: str, default: str = "") -> list[str]:
    raw = env(name, default)
    return [p.strip() for p in raw.split(",") if p.strip()]


def data_dir() -> Path:
    d = Path(env("DATA_DIR", "./data"))
    if not d.is_absolute():
        d = PROJECT_ROOT / d
    d.mkdir(parents=True, exist_ok=True)
    return d
