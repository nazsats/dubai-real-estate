import os
import time
import logging
import random
from typing import List, Dict, Any

from flask import Flask, request, jsonify
from flask_cors import CORS

import psycopg2
from psycopg2 import OperationalError

from langchain_community.utilities import SQLDatabase
from langchain_openai import ChatOpenAI
from langchain_community.agent_toolkits import create_sql_agent, SQLDatabaseToolkit

from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.messages import HumanMessage, AIMessage



from dotenv import load_dotenv

# ────────────────────────────────────────────────
# Environment & Logging
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
    raise ValueError("OPENAI_API_KEY is missing")
if not DATABASE_URL:
    raise ValueError("DATABASE_URL is missing")

# ────────────────────────────────────────────────
# Flask app
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
    db = SQLDatabase.from_uri(DATABASE_URL, sample_rows_in_table_info=3)
    logger.info("PostgreSQL connection established")
except Exception as e:
    logger.error(f"Database connection failed: {e}")
    raise

# ────────────────────────────────────────────────
# Initialize sample data if table is small
# ────────────────────────────────────────────────
def init_database():
    conn = get_db_connection()
    cur = conn.cursor()

    try:
        cur.execute("""
        CREATE TABLE IF NOT EXISTS properties (
            id          SERIAL PRIMARY KEY,
            location    TEXT NOT NULL,
            building    TEXT NOT NULL,
            price       NUMERIC NOT NULL,
            type        TEXT NOT NULL,
            bedrooms    INTEGER NOT NULL,
            size_sqft   INTEGER NOT NULL,
            has_pool    BOOLEAN NOT NULL,
            has_gym     BOOLEAN NOT NULL,
            has_balcony BOOLEAN NOT NULL,
            available   BOOLEAN NOT NULL,
            possession  TEXT NOT NULL
        );
        """)

        cur.execute("SELECT COUNT(*) FROM properties")
        count = cur.fetchone()[0]

        if count >= 4000:
            logger.info(f"Table already has {count:,} rows – skipping sample generation")
        else:
            logger.info(f"Generating ~{MAX_SAMPLE_ROWS:,} sample properties...")
            
            # Map of locations to specific buildings/communities
            location_buildings = {
                'Dubai Marina': ['Marina Gate', 'Princess Tower', 'Cayan Tower', 'Marina Promenade', 'Silverene'],
                'Downtown Dubai': ['Burj Khalifa', 'Address Downtown', 'Standpoint', 'The Residences', 'Boulevard Point'],
                'Palm Jumeirah': ['Oceana', 'Tiara', 'Shoreline', 'Signature Villas', 'Garden Homes'],
                'Dubai Hills Estate': ['Maple', 'Sidra', 'Park Heights', 'Mulberry', 'Golf Place'],
                'Business Bay': ['Executive Towers', 'Merano Tower', 'DAMAC Towers', 'The Opus', 'Churchill Towers'],
                'Jumeirah Village Circle': ['Seasons Community', 'District 10', 'Milano by Giovanni', 'Bloom Towers', 'Five JVC'],
                'Arabian Ranches': ['Al Reem', 'Saheel', 'Mirador', 'Alma', 'Savannah'],
                'Emirates Hills': ['Sector E', 'Sector L', 'Sector V', 'Sector W', 'Sector P']
            }
            
            fallback_locations = [
                'Jumeirah Beach Residence', 'Dubai Creek Harbour', 'Al Furjan', 'Meydan',
                'Dubai South', 'Dubai Silicon Oasis', 'Al Barsha', 'Dubai Sports City',
                'Motor City', 'Jumeirah Lake Towers', 'Dubai Investment Park'
            ]

            types = ['Apartment', 'Villa', 'Townhouse', 'Penthouse']
            possessions = ['Ready', 'Q1 2026', 'Q2 2026', 'Q3 2026', 'Under Construction', 'Q4 2025']

            rows = []
            for _ in range(MAX_SAMPLE_ROWS):
                # Pick Location & Building
                if random.random() < 0.7:
                    loc = random.choice(list(location_buildings.keys()))
                    building = random.choice(location_buildings[loc])
                else:
                    loc = random.choice(fallback_locations)
                    building = f"Generic {loc} Building"
                
                ptype = random.choice(types)

                # Assign Size, Price, Amenities based on Type
                if ptype == 'Villa':
                    bedrooms = random.randint(4, 7)
                    size_sqft = random.randint(3500, 12000)
                    price = random.randint(7000000, 65000000)
                    has_pool = random.choices([True, False], weights=[90, 10])[0]
                    has_gym = False # Villas usually have private pool, but maybe not a gym
                    has_balcony = True
                elif ptype == 'Penthouse':
                    bedrooms = random.randint(3, 6)
                    size_sqft = random.randint(3000, 8000)
                    price = random.randint(9000000, 50000000)
                    has_pool = True
                    has_gym = True
                    has_balcony = True
                elif ptype == 'Townhouse':
                    bedrooms = random.randint(3, 5)
                    size_sqft = random.randint(2000, 4000)
                    price = random.randint(2800000, 14000000)
                    has_pool = random.choices([True, False], weights=[40, 60])[0]
                    has_gym = random.choices([True, False], weights=[30, 70])[0]
                    has_balcony = True
                else:
                    bedrooms = random.randint(1, 4)
                    size_sqft = random.randint(600, 2500)
                    price = random.randint(800000, 18000000)
                    has_pool = random.choices([True, False], weights=[80, 20])[0]
                    has_gym = random.choices([True, False], weights=[85, 15])[0]
                    has_balcony = random.choices([True, False], weights=[70, 30])[0]

                price = round(price / 50000) * 50000
                available = random.choices([True, False], weights=[80, 20])[0]
                poss = random.choice(possessions)

                rows.append((loc, building, price, ptype, bedrooms, size_sqft, has_pool, has_gym, has_balcony, available, poss))

            cur.executemany("""
                INSERT INTO properties (location, building, price, type, bedrooms, size_sqft, has_pool, has_gym, has_balcony, available, possession)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT DO NOTHING
            """, rows)

            cur.execute("CREATE INDEX IF NOT EXISTS idx_location_type ON properties (location, type);")
            cur.execute("CREATE INDEX IF NOT EXISTS idx_price ON properties (price);")
            cur.execute("CREATE INDEX IF NOT EXISTS idx_bedrooms ON properties (bedrooms);")
            cur.execute("CREATE INDEX IF NOT EXISTS idx_size ON properties (size_sqft);")

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
# LLM + Toolkit
# ────────────────────────────────────────────────
llm = ChatOpenAI(
    model="gpt-4o-mini",
    temperature=0,
    api_key=OPENAI_API_KEY,
    max_retries=3,
    timeout=60
)

toolkit = SQLDatabaseToolkit(db=db, llm=llm)

# ────────────────────────────────────────────────
# Chat-style prompt (required for openai-tools agent type)
# ────────────────────────────────────────────────
prompt = ChatPromptTemplate.from_messages([
    ("system", """You are a helpful real estate assistant for **Dubai properties only**.

Strict rules you must follow:
- If the question is unrelated to Dubai real estate, reply ONLY: "Sorry, I can only help with Dubai real estate searches." Do NOT say anything else.
- For ANY question that asks to find, list, filter, compare, sort, count or show properties — ALWAYS use the sql_db_query tool. 
- Table name: properties
- Columns: id, location, building, price, type, bedrooms, size_sqft, has_pool, has_gym, has_balcony, available, possession
- If a user asks for 'Price per SqFt', calculate it in SQL as (price / size_sqft).
- Always add LIMIT 12 unless the user explicitly asks for more results.
- Format the output nicely! Include the Building name, Size (sqft), and Amenities (Pool/Gym) if relevant. 
  Example: "2-Bedroom Apartment in Marina Gate, Dubai Marina (1,200 sqft) - 2,500,000 AED [Pool, Gym]"
- If no matching properties are found, suggest ways to broaden the search.
"""),
    MessagesPlaceholder(variable_name="messages", optional=True),   # ← conversation history
    ("human", "{input}"),
    MessagesPlaceholder(variable_name="agent_scratchpad"),          # ← REQUIRED for openai-tools
])

# ────────────────────────────────────────────────
# Create SQL agent
# ────────────────────────────────────────────────
agent_executor = create_sql_agent(
    llm=llm,
    toolkit=toolkit,
    verbose=True,
    agent_type="openai-tools",
    prompt=prompt,
    handle_parsing_errors=True,
    max_iterations=12,
    early_stopping_method="force"
)

# ────────────────────────────────────────────────
# Spell & grammar correction helper
# ────────────────────────────────────────────────
def correct_spelling_and_grammar(text: str) -> str:
    try:
        fix_prompt = f"""
Fix spelling, grammar, and typos in this Dubai real-estate query.
Keep location names, area abbreviations and proper nouns exactly as written.

Examples:
- "dubai marena"      → "Dubai Marina"
- "2 bedrom aprtment" → "2 bedroom apartment"
- "chepest 1 bhk jvc" → "cheapest 1 bedroom in JVC"
- "penthuse downtwon" → "penthouse Downtown"

Only return the corrected query — nothing else.

Original query: {text}

Corrected query:
""".strip()

        response = llm.invoke(fix_prompt)
        corrected = response.content.strip()
        logger.info(f"Spell-corrected: '{text}' → '{corrected}'")
        return corrected or text
    except Exception:
        logger.warning("Spell correction failed")
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
        original_query: str = data.get("query", "").strip()
        history: List[Dict[str, str]] = data.get("history", [])

        if not original_query:
            return jsonify({"error": "Query is required"}), 400

        logger.info(f"Query: {original_query} | History messages: {len(history)}")

        # 1. Correct spelling/grammar
        user_query = correct_spelling_and_grammar(original_query)

        # 2. Convert history to LangChain messages
        messages: List[Any] = []
        for msg in history:
            role = msg.get("role", "").lower()
            content = msg.get("content", "")
            if role == "user":
                messages.append(HumanMessage(content=content))
            elif role == "assistant":
                messages.append(AIMessage(content=content))

        # 3. Run agent
        result = agent_executor.invoke({
            "input": user_query,
            "messages": messages
        })

        output = result.get("output", "No response generated")

        # 4. Try to extract the SQL query that was used
        sql_used = None
        intermediate_steps = result.get("intermediate_steps", [])
        for step in intermediate_steps:
            if isinstance(step, tuple) and len(step) >= 2:
                action = step[0]
                if hasattr(action, "tool") and action.tool == "sql_db_query":
                    tool_input = action.tool_input
                    if isinstance(tool_input, dict) and "query" in tool_input:
                        sql_used = tool_input["query"]
                    elif isinstance(tool_input, str):
                        sql_used = tool_input
                    break

        # 5. Improve empty result UX
        if any(w in output.lower() for w in ["no ", "0 ", "none"]) and "result" in output.lower():
            output += "\n\nTip: Try increasing the budget, removing some filters, or checking nearby areas."

        elapsed = time.perf_counter() - start
        logger.info(f"Processed in {elapsed:.2f}s | SQL: {sql_used}")

        return jsonify({
            "response": output,
            "sql": sql_used,
            "elapsed_seconds": round(elapsed, 2)
        })

    except Exception as e:
        logger.exception("Query processing error")
        return jsonify({"error": str(e)}), 500


# ────────────────────────────────────────────────
# Run server
# ────────────────────────────────────────────────
if __name__ == "__main__":
    if DEBUG:
        app.run(host="0.0.0.0", port=5000, debug=True)
    else:
        from waitress import serve
        serve(app, host="0.0.0.0", port=5000)