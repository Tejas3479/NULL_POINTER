import os
import time
from jose import jwt, JWTError
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from backend.models.user import User, UserRole
from backend.services.user_store import user_store
from typing import Optional, Dict, Any, List

JWT_SECRET = os.getenv("JWT_SECRET")
if not JWT_SECRET:
    if os.getenv("ENVIRONMENT") == "production":
        raise RuntimeError("JWT_SECRET environment variable must be set in production!")
    JWT_SECRET = "super-secret-key-null-pointer-123"

JWT_ALGORITHM = "HS256"
SESSION_COOKIE_NAME = "session_token"

# JWKS Cache
jwks_cache: Dict[str, Dict[str, Any]] = {}
jwks_cache_expiry: Dict[str, float] = {}
CACHE_TTL = 3600  # 1 hour

security = HTTPBearer(auto_error=False)

def fetch_jwks(url: str) -> Dict[str, Any]:
    now = time.time()
    if url in jwks_cache and now < jwks_cache_expiry.get(url, 0):
        return jwks_cache[url]
    
    try:
        import urllib.request
        import json
        with urllib.request.urlopen(url, timeout=5) as response:
            keys = json.loads(response.read().decode("utf-8"))
            jwks_cache[url] = keys
            jwks_cache_expiry[url] = now + CACHE_TTL
            return keys
    except Exception as e:
        print(f"Failed to fetch JWKS from {url}: {e}")
        return jwks_cache.get(url, {"keys": []})

def verify_external_jwt(token: str, provider: str) -> Dict[str, Any]:
    """Verify external GitHub/Google OIDC JWT tokens using their JWKS endpoints."""
    if provider == "google":
        jwks_url = "https://www.googleapis.com/oauth2/v3/certs"
        issuer = "https://accounts.google.com"
    elif provider == "github":
        jwks_url = "https://token.actions.githubusercontent.com/.well-known/jwks"
        issuer = "https://token.actions.githubusercontent.com"
    else:
        raise ValueError(f"Unsupported provider: {provider}")

    try:
        header = jwt.get_unverified_header(token)
        kid = header.get("kid")
        if not kid:
            raise JWTError("Token missing 'kid' in header.")

        jwks = fetch_jwks(jwks_url)
        public_key = None
        for key in jwks.get("keys", []):
            if key.get("kid") == kid:
                public_key = key
                break

        if not public_key:
            raise JWTError(f"Public key not found for kid: {kid}")

        # Decode using RS256 with key payload
        decoded = jwt.decode(
            token,
            public_key,
            algorithms=["RS256"],
            audience=os.getenv(f"{provider.upper()}_CLIENT_ID", ""),
            issuer=issuer
        )
        return decoded
    except Exception as e:
        raise JWTError(f"JWKS verification failed: {e}")

def create_session_token(username: str, role: str) -> str:
    now = time.time()
    payload = {
        "sub": username,
        "role": role,
        "iat": int(now),
        "exp": int(now + 3600)  # 1 hour expiration
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> User:
    token = None
    
    # 1. Extract session token from httpOnly cookie
    cookie_token = request.cookies.get(SESSION_COOKIE_NAME)
    if cookie_token:
        token = cookie_token
        
    # 2. Extract session token from Bearer Authorization header
    elif credentials:
        token = credentials.credentials
        
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication credentials were not provided."
        )
        
    # CSRF Verification on State-Changing Methods
    if request.method not in ("GET", "HEAD", "OPTIONS"):
        csrf_token = request.headers.get("X-CSRF-Token")
        if not csrf_token:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Forbidden: CSRF protection triggered. Missing 'X-CSRF-Token' header."
            )
            
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        username = payload.get("sub")
        role_str = payload.get("role")
        if not username or not role_str:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token payload content."
            )
            
        # Verify persistence and query correct role from User Store
        # We fallback to email lookup or username matching
        # For simplicity, search the JSON user database
        email = f"{username}@nullpointer.local" if "@" not in username else username
        user_record = user_store.find_or_create_user(email, username, default_role=role_str)
        
        return User(
            username=user_record["username"],
            email=user_record["email"],
            role=UserRole(user_record["role"])
        )
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired session token."
        )

def require_role(allowed_roles: List[str]):
    async def role_checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Forbidden: Insufficient role permissions."
            )
        return current_user
    return role_checker
