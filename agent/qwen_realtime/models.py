from typing import Literal

# Realtime model identifiers. Used purely as a type hint for the `model`
# argument; any OpenAI-compatible realtime model name (e.g. a Qwen realtime
# endpoint) may be passed as a plain string as well.
RealtimeModels = Literal[
    "gpt-realtime",
    "gpt-realtime-1.5",
    "gpt-realtime-2",
    "gpt-realtime-2025-08-28",
    "gpt-4o-realtime-preview",
    "qwen-omni-turbo-realtime",
    "qwen3-omni-flash-realtime",
]
