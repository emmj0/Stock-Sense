"""Builds a local FAISS index from text and PDF learning material for RAG."""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Dict, List

import faiss
import fitz  # PyMuPDF
import numpy as np
from sentence_transformers import SentenceTransformer


DEFAULT_TEXT_DIR = Path("Data/text")
DEFAULT_PDF_DIR = Path("Data/pdf")
DEFAULT_INDEX_FILE = Path("rag_index.faiss")
DEFAULT_CHUNKS_FILE = Path("rag_chunks.json")
DEFAULT_MODEL = "all-MiniLM-L6-v2"

TOKENS_PER_WORD = 1.3


def estimate_tokens(text: str) -> int:
    return int(len(text.split()) * TOKENS_PER_WORD)


def clean_text(text: str) -> str:
    cleaned = re.sub(r"\s+", " ", text).strip()
    cleaned = re.sub(r"([.!?])\s+([A-Z])", r"\1 \2", cleaned)
    return cleaned


def extract_numbered_qa_pairs(text: str) -> List[Dict[str, str]]:
    """Extract Q&A pairs from numbered list format (e.g., '1. What is...? Answer...')."""
    pattern = re.compile(
        r"(?ms)^\s*(\d{1,4})\.\s*(.+?\?)\s*(.*?)(?=^\s*\d{1,4}\.\s*.+?\?|\Z)"
    )
    pairs: List[Dict[str, str]] = []
    for _, question, answer in pattern.findall(text):
        q = clean_text(question)
        a = clean_text(answer)
        if len(q) < 8 or len(a) < 20:
            continue
        pairs.append({"question": q, "answer": a})
    return pairs


def split_into_sentences(text: str) -> List[str]:
    sentences = re.split(r"(?<=[.!?])\s+", text)
    return [s.strip() for s in sentences if s.strip()]


def extract_sections(text: str) -> List[Dict[str, str]]:
    """Extract sections by detecting heading patterns."""
    heading_pattern = re.compile(
        r"^((?:[A-Z][A-Z\s&()-]*[A-Z])|(?:[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)|(?:SESSION\s+\d+.*?)):\s*$",
        re.MULTILINE,
    )

    sections = []
    last_heading = None
    current_section: List[str] = []

    for line in text.split("\n"):
        stripped = line.strip()
        if heading_pattern.match(stripped):
            if current_section and last_heading:
                section_text = "\n".join(current_section).strip()
                if section_text:
                    sections.append({"heading": last_heading, "content": clean_text(section_text)})
            last_heading = stripped.rstrip(":")
            current_section = []
        elif last_heading:
            current_section.append(line)

    if current_section and last_heading:
        section_text = "\n".join(current_section).strip()
        if section_text:
            sections.append({"heading": last_heading, "content": clean_text(section_text)})

    return sections


def chunk_section(
    section: Dict[str, str],
    target_tokens: int = 400,
    min_tokens: int = 80,
    overlap_sentences: int = 2,
) -> List[Dict[str, str]]:
    """Chunk a section with sentence overlap for better context continuity."""
    heading = section["heading"]
    content = section["content"]
    sentences = split_into_sentences(content)

    if not sentences:
        return []

    chunks = []
    current_chunk: List[str] = []
    current_tokens = 0

    for i, sentence in enumerate(sentences):
        stokens = estimate_tokens(sentence)

        if current_tokens + stokens > target_tokens and current_chunk:
            chunk_text = " ".join(current_chunk)
            if estimate_tokens(chunk_text) >= min_tokens:
                chunks.append({
                    "text": f"[{heading}]\n{chunk_text}",
                    "heading": heading,
                })
            # Keep last N sentences as overlap for next chunk
            overlap = current_chunk[-overlap_sentences:] if overlap_sentences else []
            current_chunk = list(overlap)
            current_tokens = sum(estimate_tokens(s) for s in current_chunk)

        current_chunk.append(sentence)
        current_tokens += stokens

    # Final chunk
    if current_chunk:
        chunk_text = " ".join(current_chunk)
        if estimate_tokens(chunk_text) >= min_tokens:
            chunks.append({
                "text": f"[{heading}]\n{chunk_text}",
                "heading": heading,
            })

    return chunks


def read_text_documents(text_dir: Path) -> List[Dict[str, str]]:
    docs: List[Dict[str, str]] = []
    if not text_dir.exists():
        return docs
    for path in sorted(text_dir.glob("*.txt")):
        try:
            text = path.read_text(encoding="utf-8", errors="ignore")
            if text.strip():
                docs.append({"source": str(path), "content": text, "kind": "txt"})
        except Exception as exc:
            print(f"[warn] Could not read {path}: {exc}")
    return docs


def read_pdf_documents(pdf_dir: Path) -> List[Dict[str, str]]:
    docs: List[Dict[str, str]] = []
    if not pdf_dir.exists():
        return docs
    for path in sorted(pdf_dir.glob("*.pdf")):
        try:
            pdf = fitz.open(str(path))
            pages = []
            for page in pdf:
                text = page.get_text()
                if text.strip():
                    pages.append(text)
            full_text = "\n".join(pages).strip()
            if full_text:
                docs.append({"source": str(path), "content": full_text, "kind": "pdf"})
            pdf.close()
        except Exception as exc:
            print(f"[warn] Could not parse PDF {path}: {exc}")
    return docs


def build_chunks(
    documents: List[Dict[str, str]],
    target_tokens: int = 400,
    min_tokens: int = 80,
) -> List[Dict[str, str]]:
    """Build chunks using semantic sectioning.

    Chunk types produced:
    - qa_full: Complete Q&A pair (best for direct question matching)
    - qa_answer_sentence: Individual answer sentences with question context
    - section: Section-based chunks from structured documents
    - text: Fallback sentence-based chunks for unstructured text
    """
    all_chunks: List[Dict[str, str]] = []

    for doc in documents:
        source = doc["source"]
        kind = doc["kind"]
        content = doc["content"]

        # Check for Q&A formatted content
        qa_pairs = extract_numbered_qa_pairs(content)

        if len(qa_pairs) >= 15:
            for i, pair in enumerate(qa_pairs):
                question = pair["question"]
                answer = pair["answer"]

                # Full Q&A chunk (primary retrieval target)
                all_chunks.append({
                    "text": f"Q: {question}\nA: {answer}",
                    "source": source,
                    "kind": kind,
                    "chunk_type": "qa_full",
                    "question": question,
                    "pair_idx": i,
                })

                # Individual answer sentences with question context
                # (helps when user asks a related but differently-worded question)
                sentences = split_into_sentences(answer)
                for j, sentence in enumerate(sentences):
                    if estimate_tokens(sentence) >= 15:
                        all_chunks.append({
                            "text": f"Q: {question}\nA: {sentence}",
                            "source": source,
                            "kind": kind,
                            "chunk_type": "qa_answer_sentence",
                            "question": question,
                            "pair_idx": i,
                            "sentence_idx": j,
                        })
            continue

        # Section-based chunking for structured documents
        sections = extract_sections(content)

        if sections:
            for section in sections:
                for chunk in chunk_section(section, target_tokens=target_tokens, min_tokens=min_tokens):
                    all_chunks.append({
                        "text": chunk["text"],
                        "source": source,
                        "kind": kind,
                        "chunk_type": "section",
                        "heading": chunk["heading"],
                    })
        else:
            # Unstructured: sentence-based chunking with overlap
            sentences = split_into_sentences(content)
            current_chunk: List[str] = []
            current_tokens = 0

            for sentence in sentences:
                stokens = estimate_tokens(sentence)
                if current_tokens + stokens > target_tokens and current_chunk:
                    chunk_text = " ".join(current_chunk)
                    if estimate_tokens(chunk_text) >= min_tokens:
                        all_chunks.append({
                            "text": chunk_text,
                            "source": source,
                            "kind": kind,
                            "chunk_type": "text",
                        })
                    # Overlap: keep last 2 sentences
                    current_chunk = current_chunk[-2:]
                    current_tokens = sum(estimate_tokens(s) for s in current_chunk)

                current_chunk.append(sentence)
                current_tokens += stokens

            if current_chunk:
                chunk_text = " ".join(current_chunk)
                if estimate_tokens(chunk_text) >= min_tokens:
                    all_chunks.append({
                        "text": chunk_text,
                        "source": source,
                        "kind": kind,
                        "chunk_type": "text",
                    })

    return all_chunks


def main() -> None:
    parser = argparse.ArgumentParser(description="Build FAISS RAG index from docs")
    parser.add_argument("--text-dir", type=Path, default=DEFAULT_TEXT_DIR)
    parser.add_argument("--pdf-dir", type=Path, default=DEFAULT_PDF_DIR)
    parser.add_argument("--index-file", type=Path, default=DEFAULT_INDEX_FILE)
    parser.add_argument("--chunks-file", type=Path, default=DEFAULT_CHUNKS_FILE)
    parser.add_argument("--model", type=str, default=DEFAULT_MODEL)
    parser.add_argument("--target-tokens", type=int, default=400)
    parser.add_argument("--min-tokens", type=int, default=80)
    args = parser.parse_args()

    print(f"Loading embeddings model: {args.model}")
    embedder = SentenceTransformer(args.model)

    print("Reading text documents...")
    text_docs = read_text_documents(args.text_dir)

    print("Reading PDF documents...")
    pdf_docs = read_pdf_documents(args.pdf_dir)

    documents = text_docs + pdf_docs

    if not documents:
        raise SystemExit("No documents found. Add .txt files in Data/text or .pdf files in Data/pdf.")

    print(f"\nLoaded {len(documents)} documents:")
    for doc in documents:
        print(f"  - {Path(doc['source']).name} ({doc['kind']})")

    print(f"\nBuilding chunks (target={args.target_tokens} tokens, min={args.min_tokens} tokens)...")
    chunks = build_chunks(documents, target_tokens=args.target_tokens, min_tokens=args.min_tokens)

    if not chunks:
        raise SystemExit("No chunks generated. Check your source documents.")

    print(f"Generated {len(chunks)} chunks")

    # Show distribution
    types: Dict[str, int] = {}
    for c in chunks:
        ct = c.get("chunk_type", "unknown")
        types[ct] = types.get(ct, 0) + 1
    print("Chunk type distribution:")
    for ct, count in sorted(types.items()):
        print(f"  - {ct}: {count}")

    print("\nEncoding chunks...")
    texts = [item["text"] for item in chunks]
    embeddings = embedder.encode(
        texts,
        convert_to_numpy=True,
        show_progress_bar=True,
        normalize_embeddings=True,
    )
    embeddings = np.asarray(embeddings, dtype="float32")

    dim = embeddings.shape[1]
    index = faiss.IndexFlatIP(dim)
    index.add(embeddings)

    faiss.write_index(index, str(args.index_file))
    args.chunks_file.write_text(json.dumps(chunks, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"\nDone! Index: {args.index_file} ({index.ntotal} vectors, dim={dim})")
    print(f"Chunks: {args.chunks_file}")


if __name__ == "__main__":
    main()
