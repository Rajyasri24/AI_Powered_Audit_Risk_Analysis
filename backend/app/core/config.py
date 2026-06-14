from dotenv import load_dotenv
import os

load_dotenv()

_SUPABASE_URL = os.getenv("SUPABASE_URL")
_SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")

if _SUPABASE_URL is None:
    raise ValueError("SUPABASE_URL not configured")

if _SUPABASE_ANON_KEY is None:
    raise ValueError("SUPABASE_ANON_KEY not configured")

SUPABASE_URL: str = _SUPABASE_URL
SUPABASE_ANON_KEY: str = _SUPABASE_ANON_KEY

APP_NAME = os.getenv("APP_NAME", "AI Audit Risk Analysis Platform")
ENVIRONMENT = os.getenv("ENVIRONMENT", "development")