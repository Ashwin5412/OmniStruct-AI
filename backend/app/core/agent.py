import os
import json
from dotenv import load_dotenv
from langchain_openai import ChatOpenAI
from langchain_classic.chains.combine_documents import create_stuff_documents_chain
from langchain_classic.chains import create_retrieval_chain
from langchain_core.prompts import ChatPromptTemplate
from app.db.vector_store import vector_store

env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env')
load_dotenv(env_path)

llm = ChatOpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=os.getenv("OPENROUTER_API_KEY"),
    model="google/gemini-2.5-flash-lite",
    temperature=0.1,
    max_tokens=16000
)

extraction_system_prompt = """
You are an expert Data Extraction AI. 
Your job is to read the provided context and extract the data requested by the user's prompt.

INTENT-BASED INTERPRETATION:
1. POSITIVE INTERPRETATION: If the user's English is non-standard, uses typos, or is "broken," you must use your creative reasoning to understand their intent. 
   - (e.g., "get all price" -> "extract all unit prices or costs")
   - (e.g., "who money things" -> "identify stakeholders and their financial figures")
2. ZERO-SHOT MAPPING: Map the user's goal to the most logical data fields in the document.
3. FLEXIBILITY: Be interpretative and helpful. If a request is vague, look for the most relevant structured data matching the general topic.

COMPREHENSIVE EXTRACTION: 
- You MUST extract EVERY SINGLE matching row or item you find in the context. 
- DO NOT truncate the list. 
- DO NOT summarize. 
- If there are 50 rows, you MUST return 50 objects in the JSON array.
- Pay close attention to tabular structures and ensure no row is missed.

CRITICAL INSTRUCTIONS:
1. You MUST return the extracted data ONLY as a valid JSON array of objects. 
2. Use "N/A" for any fields requested but not found in the context. Do not leave them blank or omit them.
3. Ensure every object in the array has a consistent set of keys based on the first object found.
4. Do not include markdown formatting like ```json or ``` in your final output. Just the raw JSON array string.
5. If no data matching the prompt can be found, return an empty array [].
6. Base your extraction strictly on the context provided. Do not hallucinate.

Context:
{context}
"""

chat_system_prompt = """
You are a helpful Data Analyst AI. 
The user has extracted a dataset from a document and now has follow-up questions.
Use ONLY the provided context to answer their questions accurately and concisely.

ROBUST INTERPRETATION:
1. UNDERSTAND INTENT: If the user uses non-standard, broken, or "wrong" English, do your best to interpret their actual goal. Map their words to the most relevant information in the document snippets.
2. CONTEXTUAL BRIDGING: Use your zero-shot reasoning to connect the user's informal phrasing to the technical or formal data in the context.

CRITICAL INSTRUCTIONS:
1. Base your answer EXCLUSIVELY on the provided context.
2. If the answer is impossible to find even with interpretative reasoning, say "I'm sorry, I don't see information about that in the document."
3. Do not use outside knowledge or hallucinate details.
4. If the context is empty, inform the user that no relevant information was found.

Context:
{context}
"""

extraction_prompt = ChatPromptTemplate.from_messages([
    ("system", extraction_system_prompt),
    ("human", "User Prompt: {input}\n\nReturn ONLY a JSON array of objects matching this request. If a piece of data is missing, use \"N/A\".")
])

chat_prompt = ChatPromptTemplate.from_messages([
    ("system", chat_system_prompt),
    ("human", "{input}")
])

title_system_prompt = """
You are a creative and professional assistant. 
Your task is to generate a short, descriptive title (3-5 words) for a chat session based on the provided document snippets and filename.
The title should reflect the main subject or content of the document.
Do not use generic titles like "Document Summary" or "New Chat".

Return ONLY the title string. No quotes, no preamble.
"""

title_prompt = ChatPromptTemplate.from_messages([
    ("system", title_system_prompt),
    ("human", "Filename: {filename}\n\nContext Snippets:\n{context}")
])

retriever = vector_store.as_retriever(search_kwargs={"k": 10})
extraction_qa_chain = create_stuff_documents_chain(llm, extraction_prompt)
chat_qa_chain = create_stuff_documents_chain(llm, chat_prompt)
title_chain = create_stuff_documents_chain(llm, title_prompt)

def generate_session_title(context_snippets, filename):
    try:
        response = title_chain.invoke({"context": context_snippets, "filename": filename})
        return response.strip()
    except Exception as e:
        print(f"DEBUG: Title generation failed: {e}")
        return filename[:40] + ("..." if len(filename) > 40 else "")

def generate_dataset(user_prompt: str, session_uuid: str):
    # Create a filtered retriever for this specific document using session_uuid
    # Robust filter using $eq for metadata compatibility
    # Further increased k to 100 to ensure large tables are fully captured
    search_kwargs = {"k": 100, "filter": {"session_uuid": {"$eq": str(session_uuid)}}}
    temp_retriever = vector_store.as_retriever(search_kwargs=search_kwargs)
    
    # Create a temporary chain with the filtered retriever
    temp_rag_chain = create_retrieval_chain(temp_retriever, extraction_qa_chain)
    
    print(f"DEBUG: Starting extraction for session {session_uuid}")
    response = temp_rag_chain.invoke({"input": user_prompt})
    
    # Debug: Check if context is found
    context_len = len(response.get("context", []))
    print(f"DEBUG: Found {context_len} context snippets for extraction.")
    context_len = len(response.get("context", []))
    print(f"DEBUG: Found {context_len} context snippets for session_uuid {session_uuid}")
    if context_len > 0:
        for i, doc in enumerate(response["context"]):
            print(f"  Snippet {i+1} source: {doc.metadata.get('source')}")
    
    raw_text = response["answer"].strip()
    
    # Robust JSON cleaning using regex
    import re
    
    try:
        # Try to find exactly what looks like a JSON array
        match = re.search(r'\[\s*\{.*?\}\s*\]', raw_text, re.DOTALL)
        if match:
            extracted_json = json.loads(match.group(0))
        else:
            # Fallback for when the model might have returned an object instead of array
            match_obj = re.search(r'\{.*?\}', raw_text, re.DOTALL)
            if match_obj:
                extracted_json = [json.loads(match_obj.group(0))]
            else:
                extracted_json = [{"error": "Failed to parse AI output. No valid JSON found."}]
                
    except json.JSONDecodeError:
        extracted_json = [{"error": "Failed to parse AI output. Invalid JSON format."}]

    audit_trail = []
    for doc in response.get("context", []):
        audit_trail.append({
            "source": os.path.basename(doc.metadata.get("source", "Unknown")),
            "page": doc.metadata.get("page", "N/A"),
            "content_preview": doc.page_content[:200] + "..."
        })
    
    return extracted_json, audit_trail

def get_filtered_rag_chain(session_uuid: str):
    # Use $eq filter and increase k for robust follow-up chat context
    search_kwargs = {"k": 25, "filter": {"session_uuid": {"$eq": str(session_uuid)}}}
    temp_retriever = vector_store.as_retriever(search_kwargs=search_kwargs)
    return create_retrieval_chain(temp_retriever, chat_qa_chain)