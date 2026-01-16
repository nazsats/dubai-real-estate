# dubai_property_agent.py
# ────────────────────────────────────────────────────────────────
# Real Estate Query Agent for Dubai – Flask + LangChain + PostgreSQL
# Improved version with better logging, health check & timeout handling

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
    level=logging.INFO,
    format='%(asctime)s | %(levelname)-7s | %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
DATABASE_URL = os.getenv("DATABASE_URL")

if not OPENAI_API_KEY:
    raise ValueError("OPENAI_API_KEY missing")
if not DATABASE_URL:
    raise ValueError("DATABASE_URL missing")

# ────────────────────────────────────────────────
# Flask + CORS
# ────────────────────────────────────────────────
app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})  # Allow all for dev (restrict in prod)

# ────────────────────────────────────────────────
# Database connection
# ────────────────────────────────────────────────
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

        cur.execute("SELECT COUNT(*) FROM properties")
        count = cur.fetchone()[0]

        if count >= 4000:
            logger.info(f"Table already has {count:,} rows – skipping sample data")
        else:
            logger.info(f"Generating ~5,000 sample properties...")
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
            for _ in range(5000):
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

                price = round(price / 50000) * 50000  # nicer numbers
                available = random.choices([True, False], weights=[80, 20])[0]
                poss = random.choice(possessions)

                rows.append((loc, price, ptype, bedrooms, available, poss))

            cur.executemany("""
                INSERT INTO properties (location, price, type, bedrooms, available, possession)
                VALUES (%s, %s, %s, %s, %s, %s)
                ON CONFLICT DO NOTHING
            """, rows)

            conn.commit()
            logger.info(f"Inserted {len(rows):,} sample properties")

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
    max_retries=2,
    timeout=60
)

toolkit = SQLDatabaseToolkit(db=db, llm=llm)

memory = ConversationBufferMemory(
    memory_key="chat_history",
    return_messages=True
)

query_checker = PromptTemplate.from_template(
    """You are a SQL expert. Check this query for dangerous operations 
    (DROP, DELETE, UPDATE, INSERT, ALTER, TRUNCATE, etc). 
    If dangerous → return only 'BLOCKED'. 
    Otherwise return the query unchanged.

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
@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "healthy", "db_connected": True})

@app.route("/query", methods=["POST"])
def handle_query():
    start = time.perf_counter()
    try:
        data = request.get_json()
        query = data.get("query", "").strip()

        if not query:
            return jsonify({"error": "Query is required"}), 400

        logger.info(f"Query received: {query}")

        # Guardrail: only Dubai property related
        keywords = ["dubai", "property", "apartment", "villa", "townhouse", "penthouse", "bedroom", "aed", "possession"]
        if not any(kw in query.lower() for kw in keywords):
            return jsonify({
                "response": "Sorry, I can only help with Dubai real estate searches.",
                "sql": None
            }), 200

        result = agent.invoke({"input": query})

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

        return jsonify({"response": output, "sql": sql})

    except Exception as e:
        logger.exception("Query error")
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)