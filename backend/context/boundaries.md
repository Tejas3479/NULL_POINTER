# Architectural Boundaries

- BANNED_IMPORTS: [socket, urllib, requests, http, ftplib, telnetlib, smtplib, poplib, imaplib, nntplib, xmlrpc, aiohttp, httpx]
- BANNED_PATTERNS: [eval, exec, __import__, globals, locals, getattr, setattr]
- COMPILER_STRICT: true
