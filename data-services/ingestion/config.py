import os
from contextlib import contextmanager

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session

load_dotenv()

DATABASE_URL: str = os.getenv("DATABASE_URL", "postgresql://pitwall:pitwall@localhost:5432/pitwall")
REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")
BACKEND_API_URL: str = os.getenv("BACKEND_API_URL", "http://localhost:8080/api")

engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)


@contextmanager
def db_session():
    """Context manager for database sessions. Commits on success, rolls back on error."""
    session: Session = SessionLocal()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
