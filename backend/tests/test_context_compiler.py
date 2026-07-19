import unittest
import sys
import os

# Add parent directory to path to allow backend imports
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

from backend.services.context_compiler import context_compiler

class TestContextCompiler(unittest.TestCase):
    def test_banned_imports(self):
        # socket is banned by default in boundaries.md
        res = context_compiler.validate_code("import socket")
        self.assertFalse(res["valid"])
        self.assertTrue(any("banned module 'socket'" in err for err in res["errors"]))

        # httpx is banned by default
        res = context_compiler.validate_code("import httpx")
        self.assertFalse(res["valid"])
        self.assertTrue(any("banned module 'httpx'" in err for err in res["errors"]))

        # math is safe
        res = context_compiler.validate_code("import math\nprint(math.sin(1))")
        self.assertTrue(res["valid"])
        self.assertEqual(len(res["errors"]), 0)

    def test_banned_patterns(self):
        # eval is banned
        res = context_compiler.validate_code("eval('1+1')")
        self.assertFalse(res["valid"])
        self.assertTrue(any("banned function/name 'eval'" in err for err in res["errors"]))

        # exec is banned
        res = context_compiler.validate_code("exec('a = 1')")
        self.assertFalse(res["valid"])
        self.assertTrue(any("banned function/name 'exec'" in err for err in res["errors"]))

    def test_dunder_checks(self):
        # Double underscores on names or attributes are forbidden
        res = context_compiler.validate_code("obj.__import__")
        self.assertFalse(res["valid"])
        self.assertTrue(any("double underscore attribute" in err for err in res["errors"]))

        res = context_compiler.validate_code("class A:\n    def __init__(self):\n        self.__secret = 1")
        # Custom dunders or private variables might trigger double underscore name or attribute checks
        # Let's verify our AST visitor handles double underscores
        res_var = context_compiler.validate_code("a = __private_var__")
        self.assertFalse(res_var["valid"])

    def test_alias_import_bypasses(self):
        # Importing a banned name via from ... import ... alias should be blocked
        res = context_compiler.validate_code("from builtins import eval as my_eval")
        self.assertFalse(res["valid"])
        self.assertTrue(any("Import of banned name 'eval'" in err for err in res["errors"]))

        # Importing a double underscore name should be blocked
        res2 = context_compiler.validate_code("from math import __doc__")
        self.assertFalse(res2["valid"])
        self.assertTrue(any("Import of double underscore name" in err for err in res2["errors"]))

    def test_syntax_error(self):
        # Invalid syntax should be caught gracefully
        res = context_compiler.validate_code("if True:")
        self.assertFalse(res["valid"])
        self.assertTrue(any("Syntax Error" in err for err in res["errors"]))

if __name__ == "__main__":
    unittest.main()
