"""Comprehensive test of improved chatbot."""

from rag_engine import RAGEngine, answer_with_llm

print("Loading improved RAG engine...\n")
rag = RAGEngine()

# Test questions - basic to progressive complexity
test_cases = [
    ("what is stock", "Basic definition"),
    ("what are stocks", "Plural definition"),
    ("what is a stock", "Definition with article"),
    ("explain stock", "Explanation request"),
    ("how to invest", "Practical question"),
    ("what is kse-100", "Index question"),
    ("what is dividend", "Financial term"),
    ("how do i open broker account", "Process question"),
    ("can i lose money in stocks", "Risk question"),
    ("what is psx", "Acronym question"),
]

print("=" * 80)
print("COMPREHENSIVE CHATBOT TEST - IMPROVED VERSION")
print("=" * 80)

for question, description in test_cases:
    print(f"\n[{description}]")
    print(f"Q: {question}")
    
    chunks = rag.retrieve(question, k=5)
    
    try:
        answer = answer_with_llm(question, chunks)
        
        # Extract main answer (without sources)
        if "Sources:" in answer:
            main_ans, sources = answer.rsplit("\n\nSources:", 1)
        else:
            main_ans = answer
            sources = ""
        
        # Show abbreviated answer
        if len(main_ans) > 200:
            display_ans = main_ans[:200] + "..."
        else:
            display_ans = main_ans
        
        print(f"A: {display_ans}")
        if sources:
            print(f"   Sources: {sources.strip()}")
    except Exception as e:
        print(f"Error: {str(e)[:80]}")

print("\n" + "=" * 80)
print("Test complete!")
print("=" * 80)
