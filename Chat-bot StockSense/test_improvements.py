"""Test script to validate chatbot improvements."""

from rag_engine import RAGEngine, answer_with_llm

# Initialize RAG engine with new improved index
print("Loading RAG engine with improved index...\n")
rag = RAGEngine()

# Test questions from the user's original conversation
test_questions = [
    "What is the Pakistan Stock Exchange?",
    "How do I start investing in stocks in Pakistan?",
    "What is a stock/share in simple words?",
    "How much money do I need to start?",
    "What is a brokerage account?",
    "How do I buy shares on PSX?",
    "What is KSE-100 index?",
    "What is a dividend?",
    "Can I lose all my money in stocks?",
    "What is a trend in stock prices?",
]

print("=" * 80)
print("TESTING IMPROVED CHATBOT")
print("=" * 80)

for i, question in enumerate(test_questions, 1):
    print(f"\n[Test {i}] Q: {question}")
    
    # Retrieve chunks
    chunks = rag.retrieve(question, k=5)
    print(f"  Retrieved {len(chunks)} chunks")
    
    # Show top chunk info
    if chunks:
        best = chunks[0]
        print(f"  Top chunk score: {best.score:.4f}")
        print(f"  Top chunk type: {'Q&A' if best.question else 'Text'}")
        if best.question:
            print(f"  Matched question: {best.question[:60]}...")
    
    # Generate answer
    try:
        answer = answer_with_llm(question, chunks)
        # Show abbreviated answer
        lines = answer.split("\n")
        main_answer = "\n".join(lines[:-1]) if "Sources:" in answer else answer
        if len(main_answer) > 250:
            main_answer = main_answer[:250] + "..."
        print(f"  Answer: {main_answer}")
    except Exception as e:
        print(f"  Error: {str(e)[:100]}")

print("\n" + "=" * 80)
print("Test complete!")
