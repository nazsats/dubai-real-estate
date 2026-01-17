import streamlit as st
import requests
import json
import time
from datetime import datetime
import os

# ────────────────────────────────────────────────
# Page config
# ────────────────────────────────────────────────
st.set_page_config(
    page_title="Dubai Property Finder",
    page_icon="🏙️",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Modern dark theme + custom styling
st.markdown("""
    <style>
    .stApp {
        background: linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%);
        color: #e0e0ff;
    }
    section[data-testid="stSidebar"] {
        background: #1a1a2e;
        border-right: 1px solid #333;
    }
    .stChatMessage {
        border-radius: 16px;
        padding: 12px 16px;
        margin: 8px 0;
    }
    .user {
        background: linear-gradient(90deg, #00c6ff, #0072ff);
        color: white;
        border-bottom-right-radius: 4px;
    }
    .assistant {
        background: #16213e;
        color: #d0d0ff;
        border-bottom-left-radius: 4px;
    }
    .stChatInput > div > div > input {
        background: #0f0c29 !important;
        color: white !important;
        border: 1px solid #444 !important;
        border-radius: 24px !important;
    }
    .stButton > button {
        background: #00c6ff;
        color: white;
        border: none;
        border-radius: 24px;
        padding: 10px 20px;
    }
    .stButton > button:hover {
        background: #0099cc;
    }
    .example-btn {
        background: #2a2a4a !important;
        color: #a0a0ff !important;
        border-radius: 12px !important;
        margin: 4px 0 !important;
    }
    .stats-card {
        background: #1e1e2e;
        padding: 16px;
        border-radius: 12px;
        margin: 12px 0;
        border: 1px solid #333;
    }
    </style>
""", unsafe_allow_html=True)

# ────────────────────────────────────────────────
# Title & Intro
# ────────────────────────────────────────────────
st.title("🏙️ Dubai Property Finder")
st.markdown("Intelligent real estate search for Dubai — ask naturally in plain English.")

# ────────────────────────────────────────────────
# Sidebar – Controls & History
# ────────────────────────────────────────────────
with st.sidebar:
    st.header("Dubai Property AI")
    st.markdown("Powered by **LangChain** + **GPT-4o-mini** + **PostgreSQL**")

    # Backend health
    st.markdown("**Connection Status**")
    try:
        r = requests.get("http://127.0.0.1:5000/health", timeout=4)
        if r.status_code == 200:
            st.success("Backend Connected")
        else:
            st.warning(f"Status: {r.status_code}")
    except:
        st.error("Backend not running — start `dubai_property_agent.py`")

    st.markdown("**Quick Examples**")
    examples = [
        "2 bedroom apartments in Dubai Marina under 3 million AED",
        "Luxury villas in Palm Jumeirah above 25 million",
        "3 bed townhouse ready possession Dubai Hills Estate",
        "Cheapest 1 bedroom in JVC",
        "Penthouses in Downtown Dubai with Burj Khalifa view",
        "Villas in Emirates Hills with 5+ bedrooms"
    ]

    for ex in examples:
        if st.button(ex, key=f"ex_{ex}", use_container_width=True, type="secondary"):
            st.session_state.current_prompt = ex
            st.rerun()  # Important: force rerun to process the example immediately

    st.markdown("---")
    if st.button("Clear Chat History", type="primary", use_container_width=True):
        st.session_state.messages = []
        st.session_state.chat_id = datetime.now().strftime("%Y%m%d_%H%M%S")
        st.rerun()

    # Export chat
    if st.session_state.get("messages"):
        chat_text = "\n".join([f"{m['role'].upper()}: {m['content']}" for m in st.session_state.messages])
        st.download_button(
            label="Download Chat",
            data=chat_text,
            file_name=f"dubai_chat_{datetime.now().strftime('%Y%m%d_%H%M')}.txt",
            mime="text/plain"
        )

# ────────────────────────────────────────────────
# Persistent chat
# ────────────────────────────────────────────────
if "messages" not in st.session_state:
    st.session_state.messages = []
if "chat_id" not in st.session_state:
    st.session_state.chat_id = datetime.now().strftime("%Y%m%d_%H%M%S")

# Show recent history in sidebar
with st.sidebar.expander("Past Conversations", expanded=False):
    for msg in st.session_state.messages[-10:]:  # last 10
        short = msg["content"][:60] + "..." if len(msg["content"]) > 60 else msg["content"]
        st.markdown(f"**{msg['role'].capitalize()}**: {short}")

# ────────────────────────────────────────────────
# Main Chat Area
# ────────────────────────────────────────────────
for message in st.session_state.messages:
    with st.chat_message(message["role"]):
        st.markdown(message["content"])

# Chat input + auto-fill from example
prompt = st.chat_input("Ask about Dubai properties... (e.g. villas under 10M in Palm Jumeirah)")

if "current_prompt" in st.session_state:
    prompt = st.session_state.current_prompt
    del st.session_state.current_prompt

if prompt:
    # Add user message to chat
    st.session_state.messages.append({"role": "user", "content": prompt})
    with st.chat_message("user"):
        st.markdown(prompt)

    # Get assistant response
    with st.chat_message("assistant"):
        placeholder = st.empty()
        placeholder.markdown("Searching Dubai properties... ⏳")

        try:
            # Send full conversation history + current query
            response = requests.post(
                "http://127.0.0.1:5000/query",
                json={
                    "query": prompt,
                    "history": st.session_state.messages  # full list of dicts
                },
                timeout=60
            )
            response.raise_for_status()
            data = response.json()

            if "error" in data:
                full_response = f"**Error:** {data['error']}"
            else:
                answer = data.get("response", "No response received")
                sql = data.get("sql")

                # Optional: nicer formatting if properties are found
                if "found" in answer.lower() or "match" in answer.lower():
                    lines = answer.split("\n")
                    matches = [l for l in lines if "AED" in l or "bedroom" in l.lower()]
                    if matches:
                        full_response = f"**Found {len(matches)} matching properties**\n\n" + answer
                    else:
                        full_response = answer
                else:
                    full_response = answer

                # Show generated SQL for transparency
                if sql:
                    full_response += "\n\n<details><summary>Generated SQL</summary>\n```sql\n" + sql + "\n```\n</details>"

            placeholder.markdown(full_response)

            # Save to history
            st.session_state.messages.append({
                "role": "assistant",
                "content": full_response
            })

        except Exception as e:
            error_msg = f"Connection failed: {str(e)}\nMake sure backend is running on port 5000."
            placeholder.error(error_msg)
            # Still save to history so chat looks consistent
            st.session_state.messages.append({
                "role": "assistant",
                "content": f"**Error:** {str(e)}"
            })

# Footer
st.markdown("---")
st.caption("Dubai Property Finder – Powered by LangChain, OpenAI & PostgreSQL | © 2026")