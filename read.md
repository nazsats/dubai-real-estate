# Dubai Property Finder AI Agent

A production-ready **natural language real-estate search agent** designed exclusively for properties in Dubai. 

This agent uses LangChain and OpenAI to convert your plain English questions into safe SQL, queries a PostgreSQL database, and returns highly detailed formatted results.

## 🌟 Key Features

- **Natural Language to SQL:** Ask complex questions in plain english (e.g. *"Find 3-bedroom penthouses in Downtown Dubai with a pool and gym under 15 million AED."*)
- **Rich Data & Amenities:** The database schema tracks exact building names, square footage, Price per SqFt calculations, and boolean amenities (Pool, Gym, Balcony).
- **Interactive Maps (`folium`):** The agent automatically detects location names in its answers and renders a Folium map visualization directly in the chat feed!
- **Voice Search (`SpeechRecognition`):** Use your microphone to dictate questions—perfect for quick, hands-free property hunting.
- **Premium UI:** Built with Streamlit, the app features a sleek, dark-themed responsive UI with glassmorphism, glowing micro-animations, and 'Outfit' typography.
- **Guardrails & Memory:** The AI remembers conversation context and automatically blocks DROP/DELETE injections or non-Dubai real estate queries.

## 🛠️ Tech Stack
- **Backend:** Flask, PostgreSQL, `psycopg2`
- **AI & Logic:** LangChain Core/Community/OpenAI, GPT-4o-mini
- **Frontend:** Streamlit, `streamlit-folium`
- **Voice:** `SpeechRecognition`, `pyaudio`

## 🚀 Quickstart Guide

### 1. Requirements
Ensure you have a PostgreSQL server running locally, and an OpenAI API key. Add them to your `.env` file:
```env
DATABASE_URL=postgresql://user:password@localhost:5432/postgres
OPENAI_API_KEY=sk-xxxxxxx
```

### 2. Installation
Install the dependencies listed in `requirements.txt`:
```bash
pip install -r requirements.txt
```

### 3. Run the Backend (Data + Agent API)
First, start the Flask backend. On the first run, the script will automatically create the PostgreSQL table and generate ~5,000 highly realistic rows of property data!
```bash
python dubai_property_agent.py
```

### 4. Run the Frontend UI
In a new terminal window, start the Streamlit app:
```bash
streamlit run app.py
```
Enjoy your new intelligent real estate agent!
