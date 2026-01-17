# test_memory.py
try:
    from langchain_core.memory import ConversationBufferMemory
    print("Import successful! Version:", ConversationBufferMemory.__module__)
except ImportError as e:
    print("Still failing:", e)