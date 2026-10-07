"""Create a PBKDF2 record suitable for AUTH_USERS_JSON without exposing input."""

from getpass import getpass

from app.core.auth import password_hash

if __name__ == "__main__":
    password = getpass("Password to hash: ")
    confirmation = getpass("Repeat password: ")
    if not password or password != confirmation:
        raise SystemExit("Passwords do not match.")
    print(password_hash(password))
