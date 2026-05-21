from __future__ import annotations

import asyncio
import json
import os
import time
import urllib.error
import urllib.request
from typing import Any, Dict, Literal, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

try:
    import docker
    from docker.errors import DockerException, ImageNotFound
except Exception:  # Docker is an optional fallback dependency.
    docker = None
    DockerException = Exception
    ImageNotFound = Exception


SUPPORTED_LANGUAGES = {"python", "javascript"}
DEFAULT_TIMEOUT_SECONDS = 10
DOCKER_IMAGES = {
    "python": os.getenv("SANDBOX_PYTHON_IMAGE", "python:3.12-alpine"),
    "javascript": os.getenv("SANDBOX_JAVASCRIPT_IMAGE", "node:22-alpine"),
}
DOCKER_COMMANDS = {
    "python": ["python", "-I", "-c"],
    "javascript": ["node", "-e"],
}

router = APIRouter(prefix="/v1/sandbox", tags=["sandbox"])


class ExecutionRequest(BaseModel):
    code: str = Field(..., min_length=1, max_length=20000)
    language: Literal["python", "javascript"]


class ExecutionResult(BaseModel):
    success: bool
    output: str
    error: str
    execution_time: float
    exit_code: Optional[int] = None
    provider: str


def _result(
    *,
    success: bool,
    output: str = "",
    error: str = "",
    execution_time: float,
    exit_code: Optional[int] = None,
    provider: str,
) -> ExecutionResult:
    return ExecutionResult(
        success=success,
        output=output,
        error=error,
        execution_time=round(execution_time, 4),
        exit_code=exit_code,
        provider=provider,
    )


def _replit_configured() -> bool:
    return bool(os.getenv("REPLIT_CORE_API_URL") and os.getenv("REPLIT_CORE_API_TOKEN"))


def _execute_with_replit(code: str, language: str, timeout_seconds: int) -> ExecutionResult:
    """Execute through a Replit Core-compatible HTTP endpoint.

    The exact Core deployment URL is configured with REPLIT_CORE_API_URL, because
    teams often front Replit Core with their own project/workspace endpoint.
    Expected response fields are normalized from common names such as stdout,
    stderr, output, error, exit_code, and success.
    """
    started = time.perf_counter()
    base_url = os.environ["REPLIT_CORE_API_URL"].rstrip("/")
    token = os.environ["REPLIT_CORE_API_TOKEN"]
    endpoint = os.getenv("REPLIT_CORE_EXECUTE_PATH", "/execute")
    request = urllib.request.Request(
        f"{base_url}{endpoint}",
        data=json.dumps(
            {
                "code": code,
                "language": language,
                "timeout_seconds": timeout_seconds,
            }
        ).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=timeout_seconds + 2) as response:
            payload: Dict[str, Any] = json.loads(response.read().decode("utf-8"))
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as exc:
        return _result(
            success=False,
            error=f"Replit execution failed: {exc}",
            execution_time=time.perf_counter() - started,
            provider="replit",
        )

    output = str(payload.get("stdout", payload.get("output", "")))
    error = str(payload.get("stderr", payload.get("error", "")))
    exit_code = payload.get("exit_code", payload.get("exitCode"))
    success = bool(payload.get("success", exit_code in (0, None) and not error))
    return _result(
        success=success,
        output=output,
        error=error,
        execution_time=time.perf_counter() - started,
        exit_code=exit_code,
        provider="replit",
    )


def _docker_client():
    if docker is None:
        raise RuntimeError("Docker SDK is not installed. Add docker to backend requirements.")
    return docker.from_env()


def _execute_with_docker(code: str, language: str, timeout_seconds: int) -> ExecutionResult:
    started = time.perf_counter()
    image = DOCKER_IMAGES[language]
    command = [*DOCKER_COMMANDS[language], code]
    container = None

    try:
        client = _docker_client()
        try:
            client.images.get(image)
        except ImageNotFound:
            client.images.pull(image)

        container = client.containers.run(
            image=image,
            command=command,
            detach=True,
            network_disabled=True,
            mem_limit=os.getenv("SANDBOX_MEMORY_LIMIT", "128m"),
            nano_cpus=int(os.getenv("SANDBOX_NANO_CPUS", "500000000")),
            pids_limit=64,
            read_only=True,
            security_opt=["no-new-privileges"],
            cap_drop=["ALL"],
        )

        try:
            wait_result = container.wait(timeout=timeout_seconds)
        except Exception:
            container.kill()
            stdout = container.logs(stdout=True, stderr=False).decode("utf-8", errors="replace")
            stderr = container.logs(stdout=False, stderr=True).decode("utf-8", errors="replace")
            return _result(
                success=False,
                output=stdout,
                error=(stderr + "\nExecution timed out.").strip(),
                execution_time=time.perf_counter() - started,
                exit_code=124,
                provider="docker",
            )

        stdout = container.logs(stdout=True, stderr=False).decode("utf-8", errors="replace")
        stderr = container.logs(stdout=False, stderr=True).decode("utf-8", errors="replace")
        exit_code = int(wait_result.get("StatusCode", 1))
        return _result(
            success=exit_code == 0,
            output=stdout,
            error=stderr,
            execution_time=time.perf_counter() - started,
            exit_code=exit_code,
            provider="docker",
        )
    except (DockerException, RuntimeError) as exc:
        return _result(
            success=False,
            error=f"Docker execution failed: {exc}",
            execution_time=time.perf_counter() - started,
            provider="docker",
        )
    finally:
        if container is not None:
            try:
                container.remove(force=True)
            except Exception:
                pass


async def execute_code(code: str, language: str, timeout_seconds: int = DEFAULT_TIMEOUT_SECONDS) -> ExecutionResult:
    if language not in SUPPORTED_LANGUAGES:
        raise ValueError(f"Unsupported language: {language}")

    if _replit_configured():
        replit_result = await asyncio.to_thread(_execute_with_replit, code, language, timeout_seconds)
        if replit_result.success or not os.getenv("SANDBOX_DISABLE_DOCKER_FALLBACK"):
            if replit_result.success:
                return replit_result
        elif os.getenv("SANDBOX_DISABLE_DOCKER_FALLBACK"):
            return replit_result

    return await asyncio.to_thread(_execute_with_docker, code, language, timeout_seconds)


@router.post("/execute", response_model=ExecutionResult)
async def execute(payload: ExecutionRequest) -> ExecutionResult:
    try:
        return await execute_code(payload.code, payload.language)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/test_execution", response_model=ExecutionResult)
async def test_execution() -> ExecutionResult:
    """Health check that proves sandbox execution can run and capture output."""
    return await execute_code("print('NULL_POINTER_SANDBOX_OK')", "python")


@router.get("/health", response_model=ExecutionResult)
async def sandbox_health() -> ExecutionResult:
    return await test_execution()
