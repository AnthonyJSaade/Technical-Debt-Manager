"""
LLM Brain for the Janitor Agent.

Uses Anthropic's Claude 3 Opus model.
"""

import os

from anthropic import AsyncAnthropic

# Anthropic client
client = AsyncAnthropic(
    api_key=os.getenv("ANTHROPIC_API_KEY"),
)

# Model configuration (Claude Opus 4.5)
MODEL = "claude-opus-4-5"


async def complete_text(prompt: str) -> str:
    """
    Generate a text completion using Claude 3 Opus.

    Args:
        prompt: The input prompt to send to the model.

    Returns:
        The generated text response.

    Raises:
        Exception: If the API call fails.
    """
    response = await client.messages.create(
        model=MODEL,
        max_tokens=4096,
        messages=[
            {"role": "user", "content": prompt}
        ],
    )

    # Anthropic returns response.content as a list of content blocks
    return response.content[0].text if response.content else ""
