import uvicorn
import faiss
import numpy as np
import requests
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer
from typing import List
from pymongo import MongoClient
from transformers import AutoModelForCausalLM, AutoTokenizer
import torch
import re


# Hugging Face API details (Replace with your token)
HUGGINGFACE_API_URL = "https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.3"
HUGGINGFACE_API_KEY = "######"


HEADERS = {"Authorization": f"Bearer {HUGGINGFACE_API_KEY}"}

# Initialize FastAPI
app = FastAPI()

# Initialize Embedding Model
embedding_model = SentenceTransformer("all-MiniLM-L6-v2")

# Initialize FAISS
dimension = 384  # Model output dimension
index = faiss.IndexFlatL2(dimension)

# MongoDB Setup
MONGO_URI = "MONGODB_URL"
mongo_client = MongoClient(MONGO_URI)
db = mongo_client["TestCrafter"]

# Feature Extraction Model
FEATURE_KEYWORDS = ["login", "signup", "checkout", "payment", "profile", "order", "payroll", "attendance", "reports"]  # Extend this list


# ------------------ INPUT MODELS ------------------ #
class RequirementDoc(BaseModel):
    text: str


class FeatureFlow(BaseModel):
    flow: List[dict]


# ------------------ FEATURE EXTRACTION ------------------ #
@app.post("/extract_features")
def extract_features(doc: RequirementDoc):
    """
    Extract features (like login, signup, checkout) from a requirement document.
    """
    text = doc.text.lower()
    extracted_features = [feature for feature in FEATURE_KEYWORDS if feature in text]

    if not extracted_features:
        raise HTTPException(status_code=404, detail="No features found.")

    return {"features": extracted_features}

# ------------------ RETRIEVE FROM FAISS ------------------ #
@app.get("/retrieve/{query}")
def retrieve_relevant_info(query: str):
    """
    Retrieve the most relevant feature based on the query.
    """
    query_embedding = embedding_model.encode([query])
    distances, indices = index.search(np.array(query_embedding), 1)

    if len(indices) == 0:
        raise HTTPException(status_code=404, detail="No relevant information found.")

    return {"retrieved_feature": indices[0].tolist()}


def retrieve_similar_test_cases(flow):
    """
    Retrieve similar test cases from MongoDB based on flow similarity.
    """
    # Extract feature keywords from the flow
    keywords = set()
    for step in flow:
        if "url" in step:
            keywords.add("navigation")
        if step["type"] in ["click", "input"]:
            keywords.add(step["type"])

    # Search for test cases containing these keywords
    similar_cases = list(test_cases_collection.find({"feature": {"$in": list(keywords)}}).limit(5))

    return similar_cases

def load_requirement_document():
    """
    Load the requirement document from a local file.
    """
    try:
        with open("requirement.txt", "r", encoding="utf-8") as file:
            return file.read().strip()
    except FileNotFoundError:
        return "No requirement document found."
# ------------------ CHAIN OF PROMPTING ------------------ #
def extract_field_name(xpath):
    if not isinstance(xpath, str):
        return "Unknown"

    name_match = re.search(r"@name=['\"]([^'\"]+)['\"]", xpath)
    text_match = re.search(r"text\(\)=['\"]([^'\"]+)['\"]", xpath)

    if name_match:
        return name_match.group(1).capitalize()
    elif text_match:
        return text_match.group(1)
    
    return "Unknown"

def refine_prompt_with_chain(flow):
    """
    Implements Chain-of-Thought (CoT) prompting to refine test steps.
    """

    if not isinstance(flow, list):
        raise ValueError("Expected 'flow' to be a list of steps")

    context = "You are a QA engineer. Convert the following user actions into structured test steps:\n"
    
    for step in flow:
        if not isinstance(step, dict):
            continue  # Skip invalid entries

        xpath = step.get("xpath", "")
        field_name = extract_field_name(xpath)
        action_type = step.get("type", "").lower()
        value = step.get("value", "")

        if action_type == "click":
            context += f"- Click on the \"{field_name}\" field.\n"
        elif action_type == "input" and value:
            context += f"- Enter '{value}' in the \"{field_name}\" field.\n"
        else:
            context += f"- Perform '{action_type}' on the \"{field_name}\" field.\n"

    context += "\nRefine these steps and make them more readable for testing."

    return context

# ------------------ CONVERT FLOW TO TEST STEPS ------------------ #
@app.post("/convert_flow")
def convert_flow(flow_data: FeatureFlow):
    """
    Convert a feature flow (JSON) into structured test steps without a predefined prompt.
    The model generates a natural test case sequence.
    """
    flow = flow_data.flow

    # Format the flow into structured input (raw step-by-step actions)
    formatted_flow = refine_prompt_with_chain(flow)

    try:
        response = query_huggingface(HUGGINGFACE_API_URL, formatted_flow)
        cleaned_response = response.replace(formatted_flow.strip(), "").strip()
        

        return cleaned_response
    except Exception as e:
        print("Error:", e)
        raise HTTPException(status_code=500, detail=str(e))

# ------------------ CALL HUGGING FACE API ------------------ #
def query_huggingface(model_url, input_text):
    """
    Query Hugging Face API models (LLaMA-3.1-8B, GPT-2, Gemini).
    """
    payload = {
        "inputs": input_text,
        "parameters": {
            "max_length": 512,  # Increase output length
            "temperature": 0.1,  # Add variation
            "top_p": 0.8,        # Improve response quality
        }
    }
    print("API Request:",model_url, HEADERS, payload)
    response = requests.post(model_url, headers=HEADERS, json=payload)
    
    if response.status_code == 200:
        return response.json()[0]["generated_text"]
    else:
        return f"Error {response.status_code}: {response.text}"



# ------------------ RUN FASTAPI ------------------ #
if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
