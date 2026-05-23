import os
from pathlib import Path
from fastapi import HTTPException

BACKEND_ROOT = Path(__file__).resolve().parents[1]
ALLOWED_BASE_DIR = os.getenv("ALLOWED_BASE_DIR", str(BACKEND_ROOT))

def sanitize_path(user_input: str) -> str:
    """Resolves target path and checks that it is within ALLOWED_BASE_DIR."""
    allowed_base = os.path.abspath(os.path.realpath(ALLOWED_BASE_DIR))
    
    requested = Path(user_input)
    if not requested.is_absolute():
        resolved = os.path.abspath(os.path.realpath(os.path.join(allowed_base, user_input)))
    else:
        resolved = os.path.abspath(os.path.realpath(user_input))
        
    try:
        common = os.path.commonpath([allowed_base, resolved])
    except ValueError:
        raise HTTPException(status_code=403, detail="Forbidden: Path traversal attempt detected.")
        
    # Support case-insensitive filesystem normalizations (like Windows)
    if common.lower() != allowed_base.lower():
        raise HTTPException(status_code=403, detail="Forbidden: Path traversal attempt detected.")
        
    return resolved

def read_source_file(file_path: str) -> str:
    """Reads a source file from the backend directory after robust path sanitization."""
    try:
        sanitized = sanitize_path(file_path)
        with open(sanitized, "r", encoding="utf-8") as f:
            return f.read()
    except HTTPException as e:
        raise e
    except Exception as e:
        return f"# Error reading source: {e}"

def get_random_snippet(file_path: str, lines: int = 5) -> str:
    """Gets a random snippet of code from a file."""
    content = read_source_file(file_path)
    lines_list = content.split("\n")
    if len(lines_list) <= lines:
        return content
    
    import random
    start = random.randint(0, len(lines_list) - lines)
    return "\n".join(lines_list[start:start+lines])
