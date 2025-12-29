"""
LLM Brain for the Janitor Agent.

Uses Groq's OpenAI-compatible API with Llama 3 70B.
"""

import os

from openai import AsyncOpenAI

# Groq-compatible OpenAI client
client = AsyncOpenAI(
    base_url="https://api.groq.com/openai/v1",
    api_key=os.getenv("GROQ_API_KEY"),
)

# Model configuration (using Llama 3.3 70B - the latest available)
MODEL = "llama-3.3-70b-versatile"


async def complete_text(prompt: str) -> str:
    """
    Generate a text completion using Groq's Llama 3 70B model.

    Args:
        prompt: The input prompt to send to the model.

    Returns:
        The generated text response.

    Raises:
        Exception: If the API call fails.
    """
    response = await client.chat.completions.create(
        model=MODEL,
        messages=[
            {"role": "user", "content": prompt}
        ],
        temperature=0.7,
        max_tokens=1024,
    )

    return response.choices[0].message.content or ""

