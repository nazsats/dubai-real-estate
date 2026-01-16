# chat.py – Modern Streamlit Chat UI for Dubai Property Agent
# Run with: streamlit run chat.py

import streamlit as st
import requests
import time
from datetime import datetime

# ────────────────────────────────────────────────
# Page config – looks like a real app
# ────────────────────────────────────────────────
st.set_page_config(
    page_title="Dubai Property Finder",
    page_icon="🏙️",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Custom CSS – modern dark/light mode support
st.markdown("""
    <style>
    .stApp {
        background: linear-gradient(135deg, #0f0c29, #302b63, #24243e);
        color: white;
    }
    .stChatMessage.user {
        background: linear-gradient(90deg, #00c6ff, #0072ff);
        color: white;
        border-radius: 18px 18px 4px 18px;
    }
    .stChatMessage.assistant {
        background: #1e1e2e;
        color: #e0e0ff;
        border-radius: 18px 18px 18px 4px;
    }
    .stChatInput input {
        background: #1e1e2e !important;
        color: white !important;
        border: 1px solid #444 !important;
    }
    .stButton>button {
        background: #00c6ff;
        color: white;
        border: none;
    }
    .stButton>button:hover {
        background: #0099cc;
    }
    .example-btn {
        margin: 4px;
        background: #2a2a4a !important;
        color: #a0a0ff !important;
    }
    .example-btn:hover {
        background: #3a3a6a !important;
    }
    </style>
""", unsafe_allow_html=True)

# ────────────────────────────────────────────────
# Title & description
# ────────────────────────────────────────────────
st.title("🏙️ Dubai Property Finder")
st.markdown("Ask naturally — find apartments, villas, townhouses & penthouses in Dubai instantly.")

# ────────────────────────────────────────────────
# Sidebar – status & quick actions
# ────────────────────────────────────────────────
with st.sidebar:
    st.header("Dubai Property AI")
    st.markdown("Powered by **LangChain** + **GPT-4o-mini** + **PostgreSQL**")
    
    # Backend status
    st.markdown("**Backend Status**")
    try:
        r = requests.get("http://127.0.0.1:5000/health", timeout=3)
        if r.status_code == 200:
            st.success("Backend is healthy ✅")
        else:
            st.warning(f"Status: {r.status_code}")
    except:
        st.error("Backend not running (port 5000)")

    st.markdown("**Quick Examples**")
    examples = [
        "2 bedroom apartments in Dubai Marina under 3 million AED",
        "Luxury villas Palm Jumeirah above 25 million",
        "3 bed townhouse ready possession Dubai Hills Estate",
        "Penthouse Downtown Dubai Burj Khalifa view",
        "Cheapest 1 bedroom in JVC",
        "Villas in Emirates Hills with 5+ bedrooms"
    ]

    for ex in examples:
        if st.button(ex, key=ex, use_container_width=True, type="secondary"):
            st.session_state.prompt = ex

    if st.button("Clear Chat History", type="primary"):
        st.session_state.messages = []
        st.rerun()

# ────────────────────────────────────────────────
# Chat history
# ────────────────────────────────────────────────
if "messages" not in st.session_state:
    st.session_state.messages = []

for msg in st.session_state.messages:
    role = "user" if msg["role"] == "user" else "assistant"
    with st.chat_message(role):
        st.markdown(msg["content"])

# ────────────────────────────────────────────────
# Input + send
# ────────────────────────────────────────────────
prompt = st.chat_input("Ask about Dubai properties... (e.g. 2 bed in Marina under 3M)")

# Auto-fill from quick example button
if "prompt" in st.session_state:
    prompt = st.session_state.prompt
    del st.session_state.prompt

if prompt:
    st.session_state.messages.append({"role": "user", "content": prompt})
    with st.chat_message("user"):
        st.markdown(prompt)

    with st.chat_message("assistant"):
        with st.spinner("Searching Dubai properties..."):
            try:
                response = requests.post(
                    "http://127.0.0.1:5000/query",
                    json={"query": prompt},
                    timeout=60
                )
                response.raise_for_status()
                data = response.json()

                if "error" in data:
                    st.error(data["error"])
                else:
                    answer = data.get("response", "No answer received")
                    sql = data.get("sql")

                    st.markdown(answer.replace("\n", "  \n"))

                    if sql:
                        with st.expander("See generated SQL"):
                            st.code(sql, language="sql")

                st.session_state.messages.append({
                    "role": "assistant",
                    "content": answer + (f"\n\n**SQL:**\n```sql\n{sql}\n```" if sql else "")
                })

            except Exception as e:
                st.error(f"Error: {str(e)}\nIs the backend running on port 5000?")