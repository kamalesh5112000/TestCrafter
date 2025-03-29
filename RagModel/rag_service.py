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


# Hugging Face API details (Replace with your token)
HUGGINGFACE_API_URL = "https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.3"
HUGGINGFACE_API_KEY = "#####"

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

# ------------------ CONVERT FLOW TO TEST STEPS ------------------ #
@app.post("/convert_flow")
def convert_flow(flow_data: FeatureFlow):
    """
    Convert a feature flow (JSON) into structured test steps without a predefined prompt.
    The model generates a natural test case sequence.
    """
    flow = flow_data.flow

    # Format the flow into structured input (raw step-by-step actions)
    formatted_flow = "\n".join([
        f"Click on the {step.get('tag', 'Unknown')} field." if step['type'] == 'click' else
        f"Enter '{step['value']}' in the {step.get('tag', 'Unknown')} field." if step['type'] == 'input' else
        f"Navigate to {step['url']}." if step['type'] == 'navigation' else
        "Unknown action."
        for step in flow
    ])

    # Replace generic 'INPUT' with more descriptive field names if available
    formatted_flow = formatted_flow.replace('INPUT', 'input field')  # Generic replacement
    formatted_flow = formatted_flow.replace('BUTTON', 'button')  # Generic replacement

    print("Formatted Flow Input:\n", formatted_flow)  # Debugging purposes

    try:
        generated_text = generate_text(formatted_flow)  # Model generates the test steps
        return {"test_steps": generated_text.split("\n")}  # Return structured list of steps
    except Exception as e:
        print("Error:", e)
        raise HTTPException(status_code=500, detail=str(e))

# ------------------ CALL HUGGING FACE API ------------------ #
def generate_text(input_text: str):
    """
    Generate structured test steps using Mistral-7B-Instruct via Hugging Face API.
    """
    payload = {"inputs": input_text}
    print(HUGGINGFACE_API_URL, HEADERS, payload)
    response = requests.post(HUGGINGFACE_API_URL, headers=HEADERS, json=payload)

    if response.status_code == 200:
        return response.json()[0]["generated_text"]
    else:
        raise Exception(f"Error: {response.status_code}, {response.text}")


# ------------------ RUN FASTAPI ------------------ #
if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
