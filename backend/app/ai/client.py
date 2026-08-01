"""Anthropic async client + a small manual tool-use loop.

Uses the official Anthropic Python SDK. The model and thinking mode come from
config (`CLAUDE_MODEL`, `USE_THINKING`) — the default is Haiku with thinking off
to keep costs down. We run a manual agentic loop rather than the SDK tool runner
so each tool can be closed over a tenant-scoped DB session.
"""
from collections.abc import Awaitable, Callable
from functools import lru_cache
from typing import Any

from anthropic import AsyncAnthropic

from app.config import get_settings


@lru_cache
def get_client() -> AsyncAnthropic:
    settings = get_settings()
    return AsyncAnthropic(api_key=settings.anthropic_api_key)


def text_of(message: Any) -> str:
    """Concatenate the text blocks of a Claude message."""
    return "".join(b.text for b in message.content if b.type == "text").strip()


# Models that take `thinking: {"type": "adaptive"}`. Older models (Haiku 4.5,
# Sonnet 4.5, …) only accept the legacy {"type": "enabled", "budget_tokens": N}
# form and reject `adaptive` outright — sending the wrong shape is a 400, so the
# mode is chosen from the configured model rather than assumed.
ADAPTIVE_THINKING_MODELS = (
    "claude-opus-5", "claude-fable-5", "claude-mythos-5",
    "claude-opus-4-8", "claude-opus-4-7", "claude-opus-4-6",
    "claude-sonnet-5", "claude-sonnet-4-6",
)

# Minimum cacheable prefix, in tokens, per model. A `cache_control` marker on a
# shorter prefix is silently ignored — no error, no cache entry, and
# `cache_creation_input_tokens` stays 0. Checked before marking anything so the
# code doesn't pretend to cache when it can't.
CACHE_MIN_TOKENS = {
    "claude-opus-5": 512, "claude-fable-5": 512, "claude-mythos-5": 512,
    "claude-opus-4-8": 1024, "claude-sonnet-5": 1024, "claude-sonnet-4-6": 1024,
    "claude-opus-4-7": 2048,
    "claude-haiku-4-5": 4096, "claude-opus-4-6": 4096,
}
DEFAULT_CACHE_MIN = 1024


def cache_min_tokens(model: str) -> int:
    return CACHE_MIN_TOKENS.get(model, DEFAULT_CACHE_MIN)


def _thinking_kwargs(model: str) -> dict:
    """Thinking config appropriate to the model, or nothing.

    Guards against a real failure mode: `adaptive` is only valid on 4.6-era and
    newer models. With the default Haiku config, flipping USE_THINKING on used
    to send `adaptive` to a model that rejects it.
    """
    if not get_settings().use_thinking:
        return {}
    if model in ADAPTIVE_THINKING_MODELS:
        return {"thinking": {"type": "adaptive"}}
    # Legacy form: the budget must be strictly below max_tokens; callers pass
    # max_tokens >= 1500, so 1024 (the API minimum) is always safe.
    return {"thinking": {"type": "enabled", "budget_tokens": 1024}}


async def generate(*, system: str, content: str, model: str | None = None, max_tokens: int | None = None) -> str:
    """One-shot text generation with cost-aware defaults. Returns the text."""
    settings = get_settings()
    model = model or settings.claude_model
    client = get_client()
    message = await client.messages.create(
        model=model,
        max_tokens=max_tokens or settings.ai_max_tokens,
        system=system,
        messages=[{"role": "user", "content": content}],
        **_thinking_kwargs(model),
    )
    return text_of(message)


async def run_tool_loop(
    *,
    system: str,
    messages: list[dict],
    tools: list[dict],
    executors: dict[str, Callable[[dict], Awaitable[str]]],
    model: str | None = None,
    max_tokens: int | None = None,
    max_iterations: int = 6,
    cache_prefix: bool = False,
) -> Any:
    """Drive a manual agentic loop until Claude stops calling tools.

    `executors` maps tool name -> async fn(input_dict) -> result string.
    `cache_prefix` marks tools+system for prompt caching — only pass True when
    the caller has verified the prefix exceeds `cache_min_tokens(model)`.
    Returns the final Claude message.
    """
    settings = get_settings()
    model = model or settings.claude_model
    max_tokens = max_tokens or settings.ai_max_tokens
    client = get_client()

    # Prompt caching. Render order is tools -> system -> messages, so a marker
    # on the last system block caches the tool schemas AND the system prompt
    # together — the whole stable prefix, which is byte-identical on every call.
    #
    # Only marked when the prefix actually clears the model's minimum: below it
    # the marker is silently ignored, and code that looks like it caches but
    # doesn't is worse than code that admits it can't.
    system_param: Any = system
    if cache_prefix:
        system_param = [{"type": "text", "text": system, "cache_control": {"type": "ephemeral"}}]

    response = None
    for _ in range(max_iterations):
        response = await client.messages.create(
            model=model,
            max_tokens=max_tokens,
            system=system_param,
            tools=tools,
            messages=messages,
            **_thinking_kwargs(model),
        )
        if response.stop_reason != "tool_use":
            break

        # Echo the assistant turn back verbatim (thinking + tool_use blocks).
        messages.append({"role": "assistant", "content": response.content})

        results = []
        for block in response.content:
            if block.type == "tool_use":
                executor = executors.get(block.name)
                try:
                    output = await executor(block.input) if executor else f"Unknown tool: {block.name}"
                    results.append({"type": "tool_result", "tool_use_id": block.id, "content": output})
                except Exception as exc:  # surface tool errors to the model
                    results.append(
                        {
                            "type": "tool_result",
                            "tool_use_id": block.id,
                            "content": f"Tool error: {exc}",
                            "is_error": True,
                        }
                    )
        messages.append({"role": "user", "content": results})

    return response
