"""Password hashing (bcrypt) and JWT access tokens."""
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt

from app.config import get_settings

settings = get_settings()


def hash_password(password: str) -> str:
    # bcrypt has a 72-byte input limit; truncate defensively.
    digest = bcrypt.hashpw(password.encode("utf-8")[:72], bcrypt.gensalt())
    return digest.decode("utf-8")


def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8")[:72], hashed.encode("utf-8"))
    except ValueError:
        return False


def create_access_token(user_id: int) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.access_token_expire_minutes)
    payload = {"sub": str(user_id), "exp": expire}
    return jwt.encode(payload, settings.secret_key, algorithm=settings.jwt_algorithm)


def decode_token(token: str) -> int | None:
    """Return the user id from a valid token, or None."""
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.jwt_algorithm])
        return int(payload["sub"])
    except (jwt.PyJWTError, KeyError, ValueError):
        return None
