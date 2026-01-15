# dubai_property_agent.py
# Real Estate Query Agent for Dubai properties – Flask + LangChain + PostgreSQL
# Cleaned & fixed version – January 2026

import os
import time
import logging
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
# Load environment variables
# ────────────────────────────────────────────────
load_dotenv()

# ────────────────────────────────────────────────
# Logging setup
# ────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s | %(levelname)-7s | %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)

# ────────────────────────────────────────────────
# Environment variables
# ────────────────────────────────────────────────
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
DATABASE_URL = os.getenv("DATABASE_URL")

if not OPENAI_API_KEY:
    raise ValueError("OPENAI_API_KEY environment variable is missing")
if not DATABASE_URL:
    raise ValueError("DATABASE_URL environment variable is missing")

# ────────────────────────────────────────────────
# Flask app + CORS (only one instance!)
# ────────────────────────────────────────────────
app = Flask(__name__)
CORS(app, resources={r"/query": {"origins": "*"}})  # Allow all for local dev

# ────────────────────────────────────────────────
# Database connection
# ────────────────────────────────────────────────
try:
    db = SQLDatabase.from_uri(DATABASE_URL)
    logger.info("Database connection established")
except Exception as e:
    logger.error(f"Failed to connect to database: {e}")
    raise

# ────────────────────────────────────────────────
# Initialize database table + sample data
# ────────────────────────────────────────────────
def init_database():
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor()

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

        # Sample data – realistic Dubai 2025–2026 prices
        sample_rows = [
            ('Dubai Marina',     2450000, 'Apartment',  2, True,  'Ready'),
            ('Downtown Dubai',   3800000, 'Apartment',  1, True,  'Ready'),
            ('Business Bay',     1850000, 'Apartment',  1, True,  'Q4 2025'),
            ('Jumeirah Village Circle', 1380000, 'Apartment', 2, False, 'Q2 2026'),
            ('Dubai Hills Estate', 3100000, 'Apartment',  3, True,  'Ready'),
            ('Palm Jumeirah',    5900000, 'Apartment',  2, True,  'Ready'),
            ('Downtown Dubai',  14500000, 'Penthouse',  3, True,  'Ready'),
            ('Dubai Marina',    18000000, 'Penthouse',  4, False, 'Q1 2026'),
            ('Palm Jumeirah',   32000000, 'Villa',      5, True,  'Ready'),
            ('Emirates Hills',  48000000, 'Villa',      6, True,  'Ready'),
            ('Arabian Ranches',  9800000, 'Villa',      4, True,  'Under Construction'),
            ('Dubai Hills Estate', 15200000, 'Villa', 5, False, 'Q3 2026'),
            ('Dubai Hills Estate',  4350000, 'Townhouse', 3, True,  'Ready'),
            ('Arabian Ranches',   5100000, 'Townhouse', 4, True,  'Q1 2026'),
            ('Jumeirah Village Circle', 3200000, 'Townhouse', 3, False, 'Q4 2025'),
        ]

        cur.executemany("""
            INSERT INTO properties (location, price, type, bedrooms, available, possession)
            VALUES (%s, %s, %s, %s, %s, %s)
            ON CONFLICT DO NOTHING
        """, sample_rows)

        conn.commit()
        logger.info(f"Database initialized – {len(sample_rows)} sample properties inserted")

    except OperationalError as e:
        logger.error(f"Database initialization failed: {e}")
        raise
    finally:
        cur.close()
        conn.close()

init_database()

# ────────────────────────────────────────────────
# LLM + Agent setup
# ────────────────────────────────────────────────
llm = ChatOpenAI(
    model="gpt-4o-mini",
    temperature=0,
    api_key=OPENAI_API_KEY
)

toolkit = SQLDatabaseToolkit(db=db, llm=llm)

memory = ConversationBufferMemory(
    memory_key="chat_history",
    return_messages=True
)

query_checker_prompt = PromptTemplate.from_template(
    """You are a SQL expert. Given this query, check if it contains any dangerous operations 
    (DROP, DELETE, UPDATE, INSERT, ALTER, TRUNCATE, etc). If yes → return only 'BLOCKED'.
    Otherwise return the original query unchanged.

    Query: {query}

    Result:"""
)

agent = create_sql_agent(
    llm=llm,
    toolkit=toolkit,
    verbose=True,
    agent_type=AgentType.OPENAI_FUNCTIONS,
    memory=memory,
    handle_parsing_errors=True,
)

# ────────────────────────────────────────────────
# Routes
# ────────────────────────────────────────────────
@app.route("/query", methods=["POST"])
def handle_query():
    start = time.perf_counter()

    try:
        data = request.get_json()
        user_query = data.get("query", "").strip()

        if not user_query:
            return jsonify({"error": "query field is required"}), 400

        logger.info(f"Received query: {user_query}")

        # Basic topic guardrail
        if not any(kw in user_query.lower() for kw in ["dubai", "property", "apartment", "villa", "townhouse", "penthouse", "bedroom", "aed", "possession"]):
            return jsonify({
                "response": "Sorry, I can only help with Dubai real estate property searches.",
                "sql": None
            }), 200

        # Run agent
        result = agent.invoke({"input": user_query})

        output = result["output"]
        sql_used = None

        # Extract SQL if present
        if "intermediate_steps" in result:
            for step in result["intermediate_steps"]:
                if isinstance(step, tuple) and len(step) >= 2:
                    action, _ = step
                    if hasattr(action, "tool") and action.tool == "sql_db_query":
                        sql_used = action.tool_input

        # Improve no-results message
        if "no " in output.lower() and any(w in output.lower() for w in ["result", "found", "match"]):
            output += "\n\nWould you like to broaden the search criteria?"

        elapsed = time.perf_counter() - start
        logger.info(f"Query processed in {elapsed:.2f}s | SQL: {sql_used}")

        return jsonify({
            "response": output,
            "sql": sql_used
        })

    except Exception as e:
        logger.exception("Error during query processing")
        elapsed = time.perf_counter() - start
        return jsonify({
            "error": "Sorry, something went wrong while processing your request.",
            "details": str(e) if app.debug else None
        }), 500

# ────────────────────────────────────────────────
# Run Flask
# ────────────────────────────────────────────────
if __name__ == "__main__":
    app.run(
        host="0.0.0.0",
        port=5000,
        debug=True
    )