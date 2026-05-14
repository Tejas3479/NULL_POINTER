import os

def read_source_file(file_path: str) -> str:
    """Reads a source file from the backend directory."""
    try:
        # Assuming we are running from the backend or root
        with open(file_path, "r") as f:
            return f.read()
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
