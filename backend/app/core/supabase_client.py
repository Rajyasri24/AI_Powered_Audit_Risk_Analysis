# from supabase import Client, create_client
# from supabase.client import ClientOptions

# from app.core.config import (
#     SUPABASE_ANON_KEY,
#     SUPABASE_URL,
# )


# if not SUPABASE_URL or not SUPABASE_URL.strip():
#     raise RuntimeError("SUPABASE_URL is missing.")

# if not SUPABASE_ANON_KEY or not SUPABASE_ANON_KEY.strip():
#     raise RuntimeError("SUPABASE_ANON_KEY is missing.")


# supabase: Client = create_client(
#     SUPABASE_URL.strip(),
#     SUPABASE_ANON_KEY.strip(),
#     options=ClientOptions(
#         schema="public",
#         postgrest_client_timeout=30,
#         storage_client_timeout=30,
#         auto_refresh_token=False,
#         persist_session=False,
#     ),
# )

import time
from collections.abc import Callable
from typing import Any, TypeVar

import httpx
from supabase import Client, create_client
from supabase.client import ClientOptions

from app.core.config import (
    SUPABASE_ANON_KEY,
    SUPABASE_URL,
)


if not SUPABASE_URL or not SUPABASE_URL.strip():
    raise RuntimeError("SUPABASE_URL is missing.")

if not SUPABASE_ANON_KEY or not SUPABASE_ANON_KEY.strip():
    raise RuntimeError("SUPABASE_ANON_KEY is missing.")


def create_supabase_client() -> Client:
    return create_client(
        SUPABASE_URL.strip(),
        SUPABASE_ANON_KEY.strip(),
        options=ClientOptions(
            schema="public",
            postgrest_client_timeout=60,
            storage_client_timeout=60,
            auto_refresh_token=False,
            persist_session=False,
        ),
    )


supabase: Client = create_supabase_client()


T = TypeVar("T")


def execute_with_retry(
    operation: Callable[[], T],
    attempts: int = 3,
    delay_seconds: float = 0.8,
) -> T:
    """
    Retry temporary Supabase/PostgREST connection failures.

    This is intended for transient network errors such as:
    - Server disconnected
    - Connection reset
    - Read timeout
    - Connect timeout
    """

    last_error: Exception | None = None

    retryable_errors = (
        httpx.RemoteProtocolError,
        httpx.ConnectError,
        httpx.ReadError,
        httpx.ReadTimeout,
        httpx.ConnectTimeout,
        httpx.PoolTimeout,
    )

    for attempt in range(1, attempts + 1):
        try:
            return operation()

        except retryable_errors as error:
            last_error = error

            if attempt >= attempts:
                break

            time.sleep(
                delay_seconds * attempt
            )

    if last_error is not None:
        raise last_error

    raise RuntimeError(
        "Supabase request failed without an explicit exception."
    )