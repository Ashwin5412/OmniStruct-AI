import os
import json
from dotenv import load_dotenv
from langchain_openai import ChatOpenAI
from langchain_classic.chains.combine_documents import create_stuff_documents_chain
from langchain_classic.chains import create_retrieval_chain
from langchain_core.prompts import ChatPromptTemplate
from db.vector_store import vector_store

load_dotenv()

llm = ChatOpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=os.getenv("OPENROUTER_API_KEY"),
    model="google/gemini-2.5-flash-lite",
    temperature=0.1,
)

system_prompt = """
You are an expert Data Extraction AI. 
Your job is to read the provided context and extract the data requested by the user's prompt.

CRITICAL INSTRUCTIONS:
1. You MUST return the extracted data ONLY as a valid JSON array of objects. 
2. Do not include markdown formatting like ```json or ``` in your final output. Just the raw JSON array.
3. If the context does not contain the answer, return an empty array [].
4. Base your extraction strictly on the context provided. Do not hallucinate.

Context:
{context}
"""

prompt = ChatPromptTemplate.from_messages([
    ("system", system_prompt),
    ("human", "User Prompt: {input}\n\nReturn ONLY a JSON array of objects matching this request.")
])

retriever = vector_store.as_retriever(search_kwargs={"k": 10})
qa_chain = create_stuff_documents_chain(llm, prompt)
rag_chain = create_retrieval_chain(retriever, qa_chain)

def generate_dataset(user_prompt: str):
    response = rag_chain.invoke({"input": user_prompt})
    
    try:
        raw_text = response["answer"].strip()
        if raw_text.startswith("```json"):
            raw_text = raw_text[7:-3].strip()
        elif raw_text.startswith("```"):
            raw_text = raw_text[3:-3].strip()
            
        extracted_json = json.loads(raw_text)
    except json.JSONDecodeError:
        extracted_json = [{"error": "Failed to parse LLM output into JSON format."}]

    audit_trail = [doc.metadata for doc in response.get("context", [])]
    
    return extracted_json, audit_trail