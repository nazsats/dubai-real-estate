import streamlit as st
import requests
import json

# ────────────────────────────────────────────────
# Page config & title
# ────────────────────────────────────────────────
st.set_page_config(
    page_title="Dubai Property Finder",
    page_icon="🏙️",
    layout="wide",
    initial_sidebar_state="expanded"
)

st.title("🏠 Dubai Real Estate Assistant")
st.markdown("""
Ask anything about properties in Dubai:  
• 2 bedroom apartments in Dubai Marina under 3 million AED  
• Luxury villas in Palm Jumeirah above 20 million  
• 3 bedroom townhouses ready possession in Dubai Hills Estate  
• Penthouses in Downtown Dubai  
""")

# ────────────────────────────────────────────────
# Sidebar info
# ────────────────────────────────────────────────
with st.sidebar:
    st.header("About")
    st.markdown("""
    This is a natural language search agent for Dubai properties.  
    Powered by LangChain + GPT-4o-mini + PostgreSQL  
    """)
    
    st.markdown("**Backend status**")
    try:
        r = requests.get("http://127.0.0.1:5000/", timeout=3)
        if r.status_code in [200, 405]:
            st.success("Flask backend is running")
        else:
            st.warning(f"Backend responded with status {r.status_code}")
    except:
        st.error("Flask backend not detected on port 5000")

    st.markdown("**Tips**")
    st.info("Be specific about location, type, bedrooms, price range, possession status")

# ────────────────────────────────────────────────
# Chat history (persistent across reruns)
# ────────────────────────────────────────────────
if "messages" not in st.session_state:
    st.session_state.messages = []

# Display chat history
for message in st.session_state.messages:
    with st.chat_message(message["role"]):
        st.markdown(message["content"])

# ────────────────────────────────────────────────
# User input
# ────────────────────────────────────────────────
if prompt := st.chat_input("What kind of property are you looking for in Dubai?"):
    
    # Add user message to history & display
    st.session_state.messages.append({"role": "user", "content": prompt})
    with st.chat_message("user"):
        st.markdown(prompt)

    # Show assistant "thinking" placeholder
    with st.chat_message("assistant"):
        message_placeholder = st.empty()
        message_placeholder.markdown("Searching properties... ⏳")

        try:
            # Call your Flask backend
            response = requests.post(
                "http://127.0.0.1:5000/query",
                json={"query": prompt},
                timeout=45
            )
            response.raise_for_status()
            data = response.json()

            if "error" in data:
                full_response = f"**Error:** {data['error']}"
            else:
                full_response = data.get("response", "No response received.")
                
                # Improve readability
                full_response = full_response.replace("\n", "  \n")

                # Show SQL in expander if present
                if sql := data.get("sql"):
                    full_response += "\n\n" + f"**Generated SQL:**  \n```sql\n{sql}\n```"

            # Replace placeholder with final answer
            message_placeholder.markdown(full_response)

            # Save assistant response to history
            st.session_state.messages.append({"role": "assistant", "content": full_response})

        except requests.exceptions.RequestException as e:
            error_msg = f"**Connection failed:** {str(e)}\n\nMake sure your Flask server is running on port 5000."
            message_placeholder.error(error_msg)
            st.session_state.messages.append({"role": "assistant", "content": error_msg})