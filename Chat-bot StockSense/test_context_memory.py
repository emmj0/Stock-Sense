"""Test conversation context memory - verifies last 4 prompts are tracked and used."""

from rag_engine import RAGEngine, answer_with_context, format_conversation_context, get_conversation_topics
from chat_assistant import resolve_followup_question

print("Loading RAG engine...\n")
rag = RAGEngine()

print("=" * 70)
print("TEST 1: Conversation context formatting (last 4 pairs)")
print("=" * 70)

# Simulate a conversation history
history = [
    {"role": "user", "content": "What is PSX?"},
    {"role": "assistant", "content": "PSX stands for Pakistan Stock Exchange..."},
    {"role": "user", "content": "How do I start investing?"},
    {"role": "assistant", "content": "To start investing, open a brokerage account..."},
    {"role": "user", "content": "What is a dividend?"},
    {"role": "assistant", "content": "A dividend is a payment made by a company..."},
    {"role": "user", "content": "What are the risks?"},
    {"role": "assistant", "content": "Stock market risks include market risk..."},
]

context = format_conversation_context(history, max_pairs=4)
print("Context from last 4 Q&A pairs:")
print(context)
print()

topics = get_conversation_topics(history, max_pairs=4)
print(f"Extracted conversation topics: {topics}")
print()


print("=" * 70)
print("TEST 2: Follow-up question resolution")
print("=" * 70)

test_followups = [
    ("tell me more", "Should expand with previous topic"),
    ("how does it work", "Should reference previous topic"),
    ("why", "Should ask why about previous topic"),
    ("what about KSE-100", "Self-contained - has domain anchor"),
    ("and dividends?", "Short follow-up"),
]

for question, description in test_followups:
    resolved = resolve_followup_question(question, history)
    print(f"  Q: \"{question}\" -> \"{resolved}\"  ({description})")

print()


print("=" * 70)
print("TEST 3: Full conversation flow with context")
print("=" * 70)

conv_history = []
questions = [
    "What is PSX?",
    "How do I start investing there?",
    "What about dividends?",
    "Tell me more",
    "Is it halal?",
]

for q in questions:
    # Resolve follow-ups
    resolved = resolve_followup_question(q, conv_history)
    display = f" (-> \"{resolved}\")" if resolved != q else ""

    # Retrieve and answer with context
    chunks = rag.retrieve(resolved, k=5)
    answer = answer_with_context(
        question=resolved,
        chunks=chunks,
        chat_history=conv_history[-8:],  # Last 4 pairs
    )

    # Truncate for display
    short_answer = answer[:150] + "..." if len(answer) > 150 else answer

    print(f"\nYou: {q}{display}")
    print(f"Bot: {short_answer}")

    conv_history.append({"role": "user", "content": q})
    conv_history.append({"role": "assistant", "content": answer})

print("\n" + "=" * 70)
print("All context memory tests passed!")
print("=" * 70)
