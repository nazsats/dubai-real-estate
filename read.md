# Dubai Property Finder Agent

A production-ready **natural language real-estate search agent** for properties in Dubai.

Ask questions like:

- "Find 2 bedroom apartments in Dubai Marina under 3 million AED"
- "Luxury villas in Palm Jumeirah above 20 million"
- "3 bedroom townhouses in Dubai Hills Estate ready possession"
- "Penthouse in Downtown Dubai with Burj Khalifa view"

The agent converts your question into safe SQL, queries a PostgreSQL database, and returns formatted results.

Built with **LangChain** + **OpenAI** + **Flask** + **PostgreSQL**

## Features

- Natural language to SQL conversion using LangChain agent
- Conversation memory (remembers previous questions in the same session)
- Basic guardrails (only Dubai property-related queries allowed)
- SQL safety check (blocks DROP/DELETE/UPDATE/INSERT etc.)
- Simple REST API endpoint `/query`
- Nice chat-style web UI via Streamlit (`chat.py`)
- Sample Dubai real-estate data (2025–2026 realistic prices)
- CORS enabled for local frontend development

## Project Structure
