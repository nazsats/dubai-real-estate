"""Anthropic async client + a small manual tool-use loop.

Uses the official Anthropic Python SDK with `claude-opus-4-8` and adaptive
thinking (per the claude-api guidance). We run a manual agentic loop rather
than the SDK tool runner so each tool can be closed over a tenant-scoped DB
session.
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


def _thinking_kwargs() -> dict:
    """Include adaptive thinking only when enabled (it costs extra tokens)."""
    return {"thinking": {"type": "adaptive"}} if get_settings().use_thinking else {}


async def generate(*, system: str, content: str, model: str | None = None, max_tokens: int | None = None) -> str:
    """One-shot text generation with cost-aware defaults. Returns the text."""
    settings = get_settings()
    client = get_client()
    message = await client.messages.create(
        model=model or settings.claude_model,
        max_tokens=max_tokens or settings.ai_max_tokens,
        system=system,
        messages=[{"role": "user", "content": content}],
        **_thinking_kwargs(),
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
) -> Any:
    """Drive a manual agentic loop until Claude stops calling tools.

    `executors` maps tool name -> async fn(input_dict) -> result string.
    Returns the final Claude message.
    """
    settings = get_settings()
    model = model or settings.claude_model
    max_tokens = max_tokens or settings.ai_max_tokens
    client = get_client()
    response = None
    for _ in range(max_iterations):
        response = await client.messages.create(
            model=model,
            max_tokens=max_tokens,
            system=system,
            tools=tools,
            messages=messages,
            **_thinking_kwargs(),
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
