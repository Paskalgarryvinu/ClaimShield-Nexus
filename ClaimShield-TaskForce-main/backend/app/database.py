"""Database connection and initialization utilities."""
import sqlite3
import os
from pathlib import Path
from app.config import DB_PATH

SCHEMA_PATH = Path(__file__).parent / "models" / "schema.sql"

def get_db_connection(db_path: str = DB_PATH) -> sqlite3.Connection:
    """Get a SQLite database connection with row factory enabled."""
    conn = sqlite3.connect(db_path, timeout=30.0)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    conn.execute("PRAGMA journal_mode = WAL;")
    conn.execute("PRAGMA synchronous = NORMAL;")
    return conn

def init_db(db_path: str = DB_PATH) -> None:
    """Initialize SQLite database using schema.sql."""
    conn = sqlite3.connect(db_path)
    with open(SCHEMA_PATH, "r", encoding="utf-8") as f:
        schema_sql = f.read()
    conn.executescript(schema_sql)
    conn.commit()
    conn.close()

def query_all(query: str, params: tuple = (), db_path: str = DB_PATH):
    """Execute query and return list of dicts."""
    with get_db_connection(db_path) as conn:
        cursor = conn.cursor()
        cursor.execute(query, params)
        rows = cursor.fetchall()
        return [dict(row) for row in rows]

def query_one(query: str, params: tuple = (), db_path: str = DB_PATH):
    """Execute query and return one dict or None."""
    with get_db_connection(db_path) as conn:
        cursor = conn.cursor()
        cursor.execute(query, params)
        row = cursor.fetchone()
        return dict(row) if row else None

def execute_write(query: str, params: tuple = (), db_path: str = DB_PATH):
    """Execute write query and commit."""
    with get_db_connection(db_path) as conn:
        cursor = conn.cursor()
        cursor.execute(query, params)
        conn.commit()
        return cursor.lastrowid
