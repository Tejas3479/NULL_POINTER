from __future__ import annotations

import asyncio
import json
import os
import time
import urllib.error
import urllib.request
import ast
import hashlib
import sys
import io
import multiprocessing
from pathlib import Path
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

try:
    from e2b_code_interpreter import CodeInterpreter
except ImportError:
    CodeInterpreter = None


SUPPORTED_LANGUAGES = {"python", "javascript"}
DEFAULT_TIMEOUT_SECONDS = 5
DOCKER_IMAGES = {
    "python": os.getenv("SANDBOX_PYTHON_IMAGE", "python:3.12-alpine"),
    "javascript": os.getenv("SANDBOX_JAVASCRIPT_IMAGE", "node:22-alpine"),
}
DOCKER_COMMANDS = {
    "python": ["python", "-I", "-c"],
    "javascript": ["node", "-e"],
}

router = APIRouter(prefix="/v1/sandbox", tags=["sandbox"])

AUDIT_LOG_PATH = Path(__file__).resolve().parents[1] / "data" / "sandbox_audit.log"


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


# Restricted environment definitions
SAFE_BUILTINS = {
    "True": True,
    "False": False,
    "None": None,
    "int": int,
    "float": float,
    "str": str,
    "list": list,
    "dict": dict,
    "tuple": tuple,
    "range": range,
    "len": len,
    "print": print,
    "abs": abs,
    "sum": sum,
    "min": min,
    "max": max,
    "round": round,
    "Exception": Exception,
    "ValueError": ValueError,
    "TypeError": TypeError,
    "KeyError": KeyError,
    "IndexError": IndexError,
    "AttributeError": AttributeError,
    "StopIteration": StopIteration,
}


class SecurityVisitor(ast.NodeVisitor):
    def __init__(self):
        # Explicit blocklist of introspection and dangerous builtins/names
        self.banned_names = {
            "eval", "exec", "__import__", "open", "compile", 
            "getattr", "setattr", "delattr", "hasattr", "globals", "locals",
            "type", "isinstance", "issubclass"
        }
        # Comprehensive blocklist of RCE, network, and system modules
        self.banned_modules = {
            # RCE & general security bypass
            "os", "sys", "subprocess", "shutil", "pty", "platform", "importlib", "gc", "ctypes",
            # Networking
            "socket", "urllib", "requests", "http", "ftplib", "telnetlib", "smtplib", 
            "poplib", "imaplib", "nntplib", "xmlrpc", "aiohttp", "httpx"
        }

    def _check_name(self, name: str):
        if name in self.banned_names:
            raise ValueError(f"Security error: Use of banned name/function '{name}' is prohibited.")
        if name.startswith("__") and name.endswith("__"):
            raise ValueError(f"Security error: Access to double-underscore name '{name}' is prohibited.")

    def visit_Name(self, node: ast.Name):
        self._check_name(node.id)
        self.generic_visit(node)

    def visit_Attribute(self, node: ast.Attribute):
        self._check_name(node.attr)
        self.generic_visit(node)

    def visit_Import(self, node: ast.Import):
        for alias in node.names:
            root_module = alias.name.split('.')[0]
            if root_module in self.banned_modules:
                raise ValueError(f"Security error: Import of banned module '{alias.name}' is prohibited.")
        self.generic_visit(node)

    def visit_ImportFrom(self, node: ast.ImportFrom):
        if node.module:
            root_module = node.module.split('.')[0]
            if root_module in self.banned_modules:
                raise ValueError(f"Security error: Import from banned module '{node.module}' is prohibited.")
        for alias in node.names:
            if alias.name in self.banned_names:
                raise ValueError(f"Security error: Import of banned name '{alias.name}' is prohibited.")
        self.generic_visit(node)


def secure_ast_filter(code: str) -> None:
    try:
        tree = ast.parse(code)
    except SyntaxError as e:
        raise ValueError(f"Syntax error: {e}")
    
    visitor = SecurityVisitor()
    visitor.visit(tree)


def write_audit_log(code: str, language: str, provider: str, success: bool):
    try:
        AUDIT_LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
        # Compute SHA-256 hash for code privacy/secret protection
        code_hash = hashlib.sha256(code.encode("utf-8")).hexdigest()
        import datetime
        timestamp = datetime.datetime.now(datetime.timezone.utc).isoformat()
        log_entry = {
            "timestamp": timestamp,
            "language": language,
            "provider": provider,
            "success": success,
            "code_hash": code_hash,
            "code_length": len(code)
        }
        with open(AUDIT_LOG_PATH, "a", encoding="utf-8") as f:
            f.write(json.dumps(log_entry) + "\n")
    except Exception:
        pass


def _run_sandbox_worker(code: str, conn) -> None:
    """Windows-safe top-level multiprocessing worker target."""
    old_stdout = sys.stdout
    old_stderr = sys.stderr
    sys.stdout = io.StringIO()
    sys.stderr = io.StringIO()
    
    success = True
    error_msg = ""
    exit_code = 0
    
    try:
        globals_dict = {
            "__builtins__": SAFE_BUILTINS,
        }
        locals_dict = {}
        compiled = compile(code, "<sandbox>", "exec")
        exec(compiled, globals_dict, locals_dict)
    except Exception as e:
        success = False
        error_msg = f"{type(e).__name__}: {e}"
        exit_code = 1
        
    stdout_val = sys.stdout.getvalue()
    stderr_val = sys.stderr.getvalue()
    
    sys.stdout = old_stdout
    sys.stderr = old_stderr
    
    conn.send({
        "success": success,
        "output": stdout_val,
        "error": error_msg or stderr_val,
        "exit_code": exit_code
    })


def _execute_with_replit(code: str, language: str, timeout_seconds: int) -> ExecutionResult:
    """Hardened, secure local execution sandbox representing Replit executor."""
    started = time.perf_counter()
    provider = "replit"
    
    # 1. Run strict AST filter
    try:
        secure_ast_filter(code)
    except Exception as e:
        # Audit log a blocked attempt
        write_audit_log(code, language, provider, success=False)
        return _result(
            success=False,
            error=f"Security error: {e}",
            execution_time=time.perf_counter() - started,
            provider=provider,
            exit_code=1
        )
        
    # Audit log validation success
    write_audit_log(code, language, provider, success=True)
    
    # 2. Multiprocessing isolation execution
    parent_conn, child_conn = multiprocessing.Pipe()
    p = multiprocessing.Process(target=_run_sandbox_worker, args=(code, child_conn), daemon=True)
    p.start()
    
    p.join(timeout=timeout_seconds)
    if p.is_alive():
        p.terminate()
        p.join()
        return _result(
            success=False,
            error="Execution timed out.",
            execution_time=time.perf_counter() - started,
            provider=provider,
            exit_code=124
        )
    else:
        if parent_conn.poll():
            res = parent_conn.recv()
            return _result(
                success=res["success"],
                output=res["output"],
                error=res["error"],
                execution_time=time.perf_counter() - started,
                exit_code=res["exit_code"],
                provider=provider
            )
        else:
            return _result(
                success=False,
                error="Unknown runner execution failure.",
                execution_time=time.perf_counter() - started,
                provider=provider,
                exit_code=1
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

        # Run with absolute network-disabled, capability-dropped, read-only setup
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


def _execute_with_e2b(code: str, language: str, timeout_seconds: int) -> ExecutionResult:
    started = time.perf_counter()
    provider = "e2b"
    if CodeInterpreter is None:
        return _result(
            success=False,
            error="e2b-code-interpreter library is not installed.",
            execution_time=time.perf_counter() - started,
            provider=provider,
            exit_code=1
        )
    api_key = os.getenv("E2B_API_KEY")
    if not api_key:
        return _result(
            success=False,
            error="E2B_API_KEY environment variable is not set.",
            execution_time=time.perf_counter() - started,
            provider=provider,
            exit_code=1
        )
    try:
        # CodeInterpreter runs inside a secure microVM sandbox
        with CodeInterpreter(api_key=api_key) as sandbox:
            execution = sandbox.notebook.exec_cell(code, timeout=timeout_seconds)
            
            output_list = []
            if execution.logs.stdout:
                output_list.extend(execution.logs.stdout)
            
            error_list = []
            if execution.logs.stderr:
                error_list.extend(execution.logs.stderr)
            if execution.error:
                error_list.append(f"{execution.error.name}: {execution.error.value}\n{execution.error.traceback}")
                
            stdout_str = "\n".join(output_list)
            stderr_str = "\n".join(error_list)
            
            return _result(
                success=not execution.error,
                output=stdout_str,
                error=stderr_str,
                execution_time=time.perf_counter() - started,
                exit_code=0 if not execution.error else 1,
                provider=provider
            )
    except Exception as e:
        return _result(
            success=False,
            error=f"E2B execution error: {e}",
            execution_time=time.perf_counter() - started,
            provider=provider,
            exit_code=1
        )


async def execute_code(code: str, language: str, timeout_seconds: int = DEFAULT_TIMEOUT_SECONDS) -> ExecutionResult:
    if language not in SUPPORTED_LANGUAGES:
        raise ValueError(f"Unsupported language: {language}")

    # Use E2B sandbox if key is present and library is installed
    if os.getenv("E2B_API_KEY") and CodeInterpreter is not None:
        return await asyncio.to_thread(_execute_with_e2b, code, language, timeout_seconds)

    # Route Python securely through our hardened local multiprocessing provider
    if language == "python":
        return await asyncio.to_thread(_execute_with_replit, code, language, timeout_seconds)

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
