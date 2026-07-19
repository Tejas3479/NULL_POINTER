import os
import re
import ast
from typing import Dict, List, Any

CONTEXT_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "context")

class ContextCompiler:
    def __init__(self):
        self.context_dir = CONTEXT_DIR
        self.boundaries_path = os.path.join(self.context_dir, "boundaries.md")
        self.intent_path = os.path.join(self.context_dir, "intent.md")
        self.threat_model_path = os.path.join(self.context_dir, "threat-model.md")

    def get_context_files(self) -> Dict[str, str]:
        files = {}
        for filename in ["boundaries.md", "intent.md", "threat-model.md"]:
            path = os.path.join(self.context_dir, filename)
            if os.path.exists(path):
                with open(path, "r", encoding="utf-8") as f:
                    files[filename] = f.read()
            else:
                files[filename] = ""
        return files

    def update_context_file(self, filename: str, content: str) -> bool:
        if filename not in ["boundaries.md", "intent.md", "threat-model.md"]:
            return False
        path = os.path.join(self.context_dir, filename)
        os.makedirs(self.context_dir, exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            f.write(content)
        return True

    def compile_context(self) -> str:
        """Compiles intent, boundaries, and threat models into a unified LLM prompt segment."""
        files = self.get_context_files()
        
        compiled = "=== SYSTEM ARCHITECTURAL CONSTRAINTS (CONTEXT COMPILATION PATTERN) ===\n"
        compiled += "The following boundaries are compiled at build-time and enforced deterministically. "
        compiled += "You must comply with these architectural guidelines:\n\n"
        
        if files.get("intent.md"):
            compiled += f"## OPERATIONAL INTENT:\n{files['intent.md']}\n\n"
        if files.get("boundaries.md"):
            compiled += f"## CODE STRUCTURAL BOUNDARIES:\n{files['boundaries.md']}\n\n"
        if files.get("threat-model.md"):
            compiled += f"## SECURITY THREAT MODEL:\n{files['threat-model.md']}\n\n"
            
        compiled += "====================================================================="
        return compiled

    def parse_boundaries(self) -> Dict[str, Any]:
        """Parses boundaries.md to extract BANNED_IMPORTS, BANNED_PATTERNS, etc."""
        files = self.get_context_files()
        boundaries_text = files.get("boundaries.md", "")
        
        banned_imports = []
        banned_patterns = []
        strict = True
        
        # Parse lists like BANNED_IMPORTS: [a, b, c]
        imports_match = re.search(r"-\s*BANNED_IMPORTS:\s*\[(.*?)\]", boundaries_text)
        if imports_match:
            banned_imports = [x.strip() for x in imports_match.group(1).split(",") if x.strip()]
            
        patterns_match = re.search(r"-\s*BANNED_PATTERNS:\s*\[(.*?)\]", boundaries_text)
        if patterns_match:
            banned_patterns = [x.strip() for x in patterns_match.group(1).split(",") if x.strip()]
            
        strict_match = re.search(r"-\s*COMPILER_STRICT:\s*(true|false)", boundaries_text, re.IGNORECASE)
        if strict_match:
            strict = strict_match.group(1).lower() == "true"
            
        return {
            "banned_imports": banned_imports,
            "banned_patterns": banned_patterns,
            "strict": strict
        }

    def validate_code(self, code: str) -> Dict[str, Any]:
        """Performs deterministic build-time AST validation on agent patches."""
        rules = self.parse_boundaries()
        banned_imports = rules["banned_imports"]
        banned_patterns = rules["banned_patterns"]
        
        errors = []
        try:
            tree = ast.parse(code)
        except SyntaxError as e:
            return {"valid": False, "errors": [f"Syntax Error: {e.msg} on line {e.lineno}"]}

        class ContextASTVisitor(ast.NodeVisitor):
            def visit_Import(self, node: ast.Import):
                for alias in node.names:
                    root = alias.name.split(".")[0]
                    if root in banned_imports:
                        errors.append(f"Line {node.lineno}: Import of banned module '{alias.name}' violates boundaries.md.")
                self.generic_visit(node)

            def visit_ImportFrom(self, node: ast.ImportFrom):
                if node.module:
                    root = node.module.split(".")[0]
                    if root in banned_imports:
                        errors.append(f"Line {node.lineno}: Import from banned module '{node.module}' violates boundaries.md.")
                for alias in node.names:
                    if alias.name in banned_patterns:
                        errors.append(f"Line {node.lineno}: Import of banned name '{alias.name}' violates boundaries.md.")
                    if (alias.name.startswith("__") and alias.name.endswith("__")) or (alias.asname and alias.asname.startswith("__") and alias.asname.endswith("__")):
                        errors.append(f"Line {node.lineno}: Import of double underscore name '{alias.name}' violates boundaries.md.")
                self.generic_visit(node)

            def visit_Name(self, node: ast.Name):
                if node.id in banned_patterns:
                    errors.append(f"Line {node.lineno}: Use of banned function/name '{node.id}' violates boundaries.md.")
                if node.id.startswith("__") and node.id.endswith("__"):
                    errors.append(f"Line {node.lineno}: Access to double underscore identifier '{node.id}' violates boundaries.md.")
                self.generic_visit(node)

            def visit_Attribute(self, node: ast.Attribute):
                if node.attr in banned_patterns:
                    errors.append(f"Line {node.lineno}: Access to banned attribute '{node.attr}' violates boundaries.md.")
                if node.attr.startswith("__") and node.attr.endswith("__"):
                    errors.append(f"Line {node.lineno}: Access to double underscore attribute '{node.attr}' violates boundaries.md.")
                self.generic_visit(node)

        visitor = ContextASTVisitor()
        visitor.visit(tree)
        
        return {
            "valid": len(errors) == 0,
            "errors": errors
        }

context_compiler = ContextCompiler()
