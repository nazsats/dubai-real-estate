# dubai_property_agent.py
# ────────────────────────────────────────────────────────────────
# Real Estate Query Agent for Dubai – Flask + LangChain + PostgreSQL
# FIXED: stronger prompt forces SQL tool usage, spell correction, context continuity

import os
import time
import logging
import random
from typing import Optional

from flask import Flask, request, jsonify
from flask_cors import CORS

import psycopg2
from psycopg2 import OperationalError

from langchain_community.utilities import SQLDatabase
from langchain_openai import ChatOpenAI
from langchain_community.agent_toolkits import create_sql_agent
from langchain_community.agent_toolkits import SQLDatabaseToolkit

from langchain_classic.memory import ConversationBufferMemory
from langchain_core.prompts import PromptTemplate
from langchain_classic.agents import AgentType

from dotenv import load_dotenv

# ────────────────────────────────────────────────
# Load environment & logging
# ────────────────────────────────────────────────
load_dotenv()

logging.basicConfig(
    level=logging.INFO if os.getenv("DEBUG", "false").lower() != "true" else logging.DEBUG,
    format='%(asctime)s | %(levelname)-7s | %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
DATABASE_URL = os.getenv("DATABASE_URL")
DEBUG = os.getenv("DEBUG", "false").lower() == "true"
MAX_SAMPLE_ROWS = int(os.getenv("MAX_SAMPLE_ROWS", "5000"))

if not OPENAI_API_KEY:
    raise ValueError("OPENAI_API_KEY missing")
if not DATABASE_URL:
    raise ValueError("DATABASE_URL missing")

# ────────────────────────────────────────────────
# Flask + CORS
# ────────────────────────────────────────────────
app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

# ────────────────────────────────────────────────
# Database connection with retry
# ────────────────────────────────────────────────
def get_db_connection(retries=3, delay=2):
    for attempt in range(retries):
        try:
            return psycopg2.connect(DATABASE_URL)
        except OperationalError as e:
            logger.warning(f"DB connection attempt {attempt+1}/{retries} failed: {e}")
            time.sleep(delay)
    raise Exception("Failed to connect to PostgreSQL after retries")

try:
    db = SQLDatabase.from_uri(DATABASE_URL)
    logger.info("PostgreSQL connection established")
except Exception as e:
    logger.error(f"Database connection failed: {e}")
    raise

# ────────────────────────────────────────────────
# Generate ~5,000 realistic properties (only if needed)
# ────────────────────────────────────────────────
def init_database():
    conn = get_db_connection()
    cur = conn.cursor()

    try:
        cur.execute("""
        CREATE TABLE IF NOT EXISTS properties (
            id          SERIAL PRIMARY KEY,
            location    TEXT NOT NULL,
            price       NUMERIC NOT NULL,
            type        TEXT NOT NULL,
            bedrooms    INTEGER NOT NULL,
            available   BOOLEAN NOT NULL,
            possession  TEXT NOT NULL
        );
        """)

        cur.execute("SELECT COUNT(*) FROM properties")
        count = cur.fetchone()[0]

        if count >= 4000:
            logger.info(f"Table already has {count:,} rows – skipping sample generation")
        else:
            logger.info(f"Generating {MAX_SAMPLE_ROWS:,} sample properties...")
            locations = [
                'Dubai Marina', 'Downtown Dubai', 'Palm Jumeirah', 'Dubai Hills Estate',
                'Business Bay', 'Jumeirah Village Circle', 'Arabian Ranches', 'Emirates Hills',
                'Jumeirah Beach Residence', 'Dubai Creek Harbour', 'Al Furjan', 'Meydan',
                'Dubai South', 'Dubai Silicon Oasis', 'Al Barsha', 'Dubai Sports City',
                'Motor City', 'Jumeirah Lake Towers', 'Dubai Investment Park'
            ]

            types = ['Apartment', 'Villa', 'Townhouse', 'Penthouse']
            possessions = ['Ready', 'Q1 2026', 'Q2 2026', 'Q3 2026', 'Under Construction', 'Q4 2025']

            rows = []
            for _ in range(MAX_SAMPLE_ROWS):
                loc = random.choice(locations)
                ptype = random.choice(types)

                if ptype == 'Villa':
                    bedrooms = random.randint(4, 7)
                    price = random.randint(7000000, 65000000)
                elif ptype == 'Penthouse':
                    bedrooms = random.randint(3, 6)
                    price = random.randint(9000000, 50000000)
                elif ptype == 'Townhouse':
                    bedrooms = random.randint(3, 5)
                    price = random.randint(2800000, 14000000)
                else:
                    bedrooms = random.randint(1, 4)
                    price = random.randint(800000, 18000000)

                price = round(price / 50000) * 50000
                available = random.choices([True, False], weights=[80, 20])[0]
                poss = random.choice(possessions)

                rows.append((loc, price, ptype, bedrooms, available, poss))

            cur.executemany("""
                INSERT INTO properties (location, price, type, bedrooms, available, possession)
                VALUES (%s, %s, %s, %s, %s, %s)
                ON CONFLICT DO NOTHING
            """, rows)

            cur.execute("CREATE INDEX IF NOT EXISTS idx_location_type ON properties (location, type);")
            cur.execute("CREATE INDEX IF NOT EXISTS idx_price ON properties (price);")
            cur.execute("CREATE INDEX IF NOT EXISTS idx_bedrooms ON properties (bedrooms);")

            conn.commit()
            logger.info(f"Inserted {len(rows):,} sample properties + indexes")

    except Exception as e:
        logger.error(f"DB init failed: {e}")
        raise
    finally:
        cur.close()
        conn.close()

init_database()

# ────────────────────────────────────────────────
# LLM & Agent
# ────────────────────────────────────────────────
llm = ChatOpenAI(
    model="gpt-4o-mini",
    temperature=0,
    api_key=OPENAI_API_KEY,
    max_retries=3,
    timeout=60
)

toolkit = SQLDatabaseToolkit(db=db, llm=llm)

memory = ConversationBufferMemory(
    memory_key="chat_history",
    return_messages=True
)

# STRONGER PROMPT – forces tool use for data queries
safety_prompt = PromptTemplate.from_template(
    """You are a helpful real estate assistant for Dubai properties only.

    Rules you MUST follow:
    - If the question is unrelated to Dubai real estate (apartments, villas, townhouses, penthouses, prices in AED, bedrooms, locations like Dubai Marina, Palm Jumeirah, Downtown, JVC, JLT, possession status, availability), reply ONLY: "Sorry, I can only help with Dubai real estate searches." Do NOT say anything else.
    - For ANY question that asks to find, list, filter, compare, sort, count, or show properties — ALWAYS use the sql_db_query tool to search the properties table. Do NOT guess, summarize from memory, or answer without querying.
    - Use conversation history for follow-up questions (e.g. "are they all ready?" refers to previous results).
    - Be precise and return real data from the database when possible.

    Tools available: sql_db_query (run SELECT queries on properties table), others if needed.

    {agent_scratchpad}

    Current user query: {input}

    Think step-by-step:
    1. Is this about Dubai real estate? If no → reply with sorry message.
    2. Does it need data from the properties table? If yes → MUST use sql_db_query tool.
    3. Plan your SQL query carefully (use SELECT only).
    4. Return the final answer based on tool results.

    Final answer:"""
)

agent = create_sql_agent(
    llm=llm,
    toolkit=toolkit,
    verbose=True,  # ← set to True to see full thinking steps in console
    agent_type=AgentType.OPENAI_FUNCTIONS,
    memory=memory,
    handle_parsing_errors=True,
    prompt=safety_prompt,
    max_iterations=15,  # ← increased so it doesn't stop early
)

# ────────────────────────────────────────────────
# AI-powered spell & grammar correction
# ────────────────────────────────────────────────
def correct_spelling_and_grammar(text: str) -> str:
    try:
        prompt = f"""
Fix spelling, grammar, and typos in this real-estate query about Dubai properties.
Keep location names, brand names, and abbreviations exactly as they are.
Examples:
- "dubai marena" → "Dubai Marina"
- "2 bedrom aprtment in jumeriah" → "2 bedroom apartment in Jumeirah"
- "penthause downtwon" → "penthouse Downtown"
- "chpestnms apartmant 1 bhk in marini" → "cheapest apartment 1 bhk in Marina"

Only return the corrected query — nothing else.

Original query: {text}
Corrected query:
""".strip()

        response = llm.invoke(prompt)
        corrected = response.content.strip()
        logger.info(f"Spell-corrected: '{text}' → '{corrected}'")
        return corrected if corrected else text

    except Exception as e:
        logger.warning(f"Spell correction failed: {e}")
        return text

# ────────────────────────────────────────────────
# Routes
# ────────────────────────────────────────────────
@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status": "healthy",
        "db_connected": True,
        "debug_mode": DEBUG,
        "sample_rows": MAX_SAMPLE_ROWS
    })

@app.route("/query", methods=["POST"])
def handle_query():
    start = time.perf_counter()
    try:
        data = request.get_json()
        original_query = data.get("query", "").strip()

        if not original_query:
            return jsonify({"error": "Query is required"}), 400

        logger.info(f"Original query received: {original_query}")

        # Step 1: AI-powered spell & grammar correction
        user_query = correct_spelling_and_grammar(original_query)

        # Step 2: Run the agent
        result = agent.invoke({"input": user_query})

        output = result["output"]
        sql = None

        if "intermediate_steps" in result:
            for step in result["intermediate_steps"]:
                if isinstance(step, tuple) and len(step) >= 2:
                    action, _ = step
                    if hasattr(action, "tool") and action.tool == "sql_db_query":
                        sql = action.tool_input

        if "no " in output.lower() and any(w in output.lower() for w in ["result", "found", "match"]):
            output += "\n\nWould you like to broaden the search?"

        elapsed = time.perf_counter() - start
        logger.info(f"Processed in {elapsed:.2f}s | SQL: {sql}")

        return jsonify({
            "response": output,
            "sql": sql,
            "elapsed_seconds": round(elapsed, 2)
        })

    except Exception as e:
        logger.exception("Query error")
        return jsonify({"error": str(e)}), 500

# ────────────────────────────────────────────────
# Run Flask
# ────────────────────────────────────────────────
if __name__ == "__main__":
    if DEBUG:
        app.run(host="0.0.0.0", port=5000, debug=True)
    else:
        from waitress import serve
        serve(app, host="0.0.0.0", port=5000)