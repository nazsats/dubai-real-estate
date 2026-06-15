import streamlit as st
import requests
import json
import time
from datetime import datetime
import os
import folium
from streamlit_folium import st_folium
import speech_recognition as sr

# ────────────────────────────────────────────────
# Page config
# ────────────────────────────────────────────────
st.set_page_config(
    page_title="Dubai Property Finder",
    page_icon="🏙️",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Premium Dark Theme + Custom Styling
st.markdown("""
    <style>
    @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700&display=swap');

    html, body, [class*="css"] {
        font-family: 'Outfit', sans-serif;
    }

    .stApp {
        background: radial-gradient(circle at top right, #1a1a2e 0%, #0f0c29 50%, #08081a 100%);
        color: #e0e0ff;
    }
    
    section[data-testid="stSidebar"] {
        background: rgba(22, 22, 40, 0.7);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        border-right: 1px solid rgba(255, 255, 255, 0.05);
    }

    .stChatMessage {
        border-radius: 16px;
        padding: 16px 20px;
        margin: 12px 0;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
        border: 1px solid rgba(255, 255, 255, 0.03);
    }
    
    .user {
        background: linear-gradient(135deg, #00c6ff, #0072ff);
        color: white;
        border-bottom-right-radius: 4px;
        animation: slideInRight 0.3s ease-out;
    }
    
    .assistant {
        background: rgba(30, 30, 50, 0.6);
        backdrop-filter: blur(10px);
        color: #d0d0ff;
        border-bottom-left-radius: 4px;
        border-left: 3px solid #00c6ff;
        animation: slideInLeft 0.3s ease-out;
    }

    .stChatInput > div > div > input {
        background: rgba(15, 12, 41, 0.8) !important;
        color: white !important;
        border: 1px solid rgba(0, 198, 255, 0.4) !important;
        border-radius: 24px !important;
        transition: all 0.3s ease;
    }
    .stChatInput > div > div > input:focus {
        border-color: #00c6ff !important;
        box-shadow: 0 0 15px rgba(0, 198, 255, 0.3);
    }

    /* Buttons */
    .stButton > button {
        background: linear-gradient(90deg, #00c6ff, #0072ff);
        color: white;
        border: none;
        border-radius: 24px;
        padding: 10px 24px;
        font-weight: 600;
        transition: all 0.3s ease;
        box-shadow: 0 4px 15px rgba(0, 114, 255, 0.3);
    }
    .stButton > button:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 20px rgba(0, 114, 255, 0.5);
    }
    
    .stButton > button[kind="secondary"] {
        background: rgba(40, 40, 70, 0.6) !important;
        border: 1px solid rgba(255,255,255,0.1) !important;
        box-shadow: none;
    }
    .stButton > button[kind="secondary"]:hover {
        background: rgba(60, 60, 100, 0.8) !important;
        border-color: #00c6ff !important;
    }

    @keyframes slideInRight {
        from { opacity: 0; transform: translateX(20px); }
        to { opacity: 1; transform: translateX(0); }
    }
    @keyframes slideInLeft {
        from { opacity: 0; transform: translateX(-20px); }
        to { opacity: 1; transform: translateX(0); }
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
        "Penthouses in Downtown Dubai with Burj Khalifa view"
    ]

    for ex in examples:
        if st.button(ex, key=f"ex_{ex}", use_container_width=True, type="secondary"):
            st.session_state.current_prompt = ex
            st.rerun()  # Important: force rerun to process the example immediately

    st.markdown("---")
    
    st.markdown("**Voice Search** 🎙️")
    if st.button("🔴 Speak Now", use_container_width=True):
        r = sr.Recognizer()
        with sr.Microphone() as source:
            st.info("Listening... Speak your query (e.g., 'Villas in Dubai Marina')")
            try:
                audio = r.listen(source, timeout=5, phrase_time_limit=10)
                st.success("Audio captured! Transcribing...")
                text = r.recognize_google(audio)
                st.session_state.current_prompt = text
                st.rerun()
            except sr.WaitTimeoutError:
                st.error("Listening timed out. Please try again.")
            except sr.UnknownValueError:
                st.error("Could not understand audio.")
            except Exception as e:
                st.error(f"Voice search error: {str(e)}")

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
# Map Helper
# ────────────────────────────────────────────────
def render_map_for_query(query_text: str, response_text: str):
    # Rough mapping of popular areas to coordinates
    DUBAI_LOCATIONS = {
        "Dubai Marina": [25.0805, 55.1403],
        "Downtown Dubai": [25.1972, 55.2744],
        "Palm Jumeirah": [25.1124, 55.1390],
        "Dubai Hills Estate": [25.1118, 55.2638],
        "Business Bay": [25.1852, 55.2755],
        "JVC": [25.0475, 55.1994],
        "Jumeirah Village Circle": [25.0475, 55.1994],
        "Emirates Hills": [25.0745, 55.1668]
    }
    
    combined_text = (query_text + " " + response_text).lower()
    found_locations = {name: coords for name, coords in DUBAI_LOCATIONS.items() if name.lower() in combined_text}

    if found_locations:
        st.markdown(f"📍 **Mapped Locations:** {', '.join(found_locations.keys())}")
        # Build map centered in Dubai
        m = folium.Map(location=[25.1500, 55.2000], zoom_start=11, tiles="CartoDB positron")
        
        for name, coords in found_locations.items():
            folium.Marker(
                coords, 
                popup=name, 
                tooltip=name, 
                icon=folium.Icon(color='blue', icon='info-sign')
            ).add_to(m)
        
        st_folium(m, width=700, height=400)

# ────────────────────────────────────────────────
# Main Chat Area
# ────────────────────────────────────────────────
for message in st.session_state.messages:
    with st.chat_message(message["role"]):
        st.markdown(message["content"])
        if message["role"] == "assistant" and "map_query" in message:
            render_map_for_query(message["map_query"], message["content"])

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
                "content": full_response,
                "map_query": prompt
            })
            
            # Map rendering directly for latest response
            render_map_for_query(prompt, full_response)

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