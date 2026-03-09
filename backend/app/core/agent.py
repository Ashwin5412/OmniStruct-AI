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
    max_tokens=1000
)

system_prompt = """
You are an expert Data Extraction AI. 
Your job is to read the provided context and extract the data requested by the user's prompt.

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

prompt = ChatPromptTemplate.from_messages([
    ("system", system_prompt),
    ("human", "User Prompt: {input}\n\nReturn ONLY a JSON array of objects matching this request. If a piece of data is missing, use \"N/A\".")
])

retriever = vector_store.as_retriever(search_kwargs={"k": 10})
qa_chain = create_stuff_documents_chain(llm, prompt)
rag_chain = create_retrieval_chain(retriever, qa_chain)

def generate_dataset(user_prompt: str, doc_id: int):
    # Create a filtered retriever for this specific document
    search_kwargs = {"k": 15, "filter": {"doc_id": str(doc_id)}}
    temp_retriever = vector_store.as_retriever(search_kwargs=search_kwargs)
    
    # Create a temporary chain with the filtered retriever
    temp_rag_chain = create_retrieval_chain(temp_retriever, qa_chain)
    
    response = temp_rag_chain.invoke({"input": user_prompt})
    
    # Debug: Check if context is found
    context_len = len(response.get("context", []))
    print(f"DEBUG: Found {context_len} context snippets for doc_id {doc_id}")
    
    raw_text = response["answer"].strip()
    
    # Robust JSON cleaning
    if "```" in raw_text:
        parts = raw_text.split("```")
        for part in parts:
            part = part.strip()
            if part.startswith("json"):
                part = part[4:].strip()
            if part.startswith("[") and part.endswith("]"):
                raw_text = part
                break
    
    try:
        extracted_json = json.loads(raw_text)
        if not isinstance(extracted_json, list):
            extracted_json = [extracted_json] if isinstance(extracted_json, dict) else []
    except json.JSONDecodeError:
        extracted_json = [{"error": "Failed to parse AI output. Please try a more specific prompt."}]

    audit_trail = []
    for doc in response.get("context", []):
        audit_trail.append({
            "source": os.path.basename(doc.metadata.get("source", "Unknown")),
            "page": doc.metadata.get("page", "N/A"),
            "content_preview": doc.page_content[:200] + "..."
        })
    
    return extracted_json, audit_trail

def get_filtered_rag_chain(doc_id: int):
    search_kwargs = {"k": 10, "filter": {"doc_id": str(doc_id)}}
    temp_retriever = vector_store.as_retriever(search_kwargs=search_kwargs)
    return create_retrieval_chain(temp_retriever, qa_chain)