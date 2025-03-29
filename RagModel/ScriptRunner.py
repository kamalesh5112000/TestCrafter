import torch
from transformers import T5Tokenizer, T5ForConditionalGeneration, TrainingArguments, Trainer
import re
from datasets import load_dataset

# ✅ Step 1: Load Dataset
dataset = load_dataset("json", data_files="updated_web_interaction_dataset.json")

# ✅ Step 2: Load T5 Tokenizer and Model
model_name = "t5-small"
tokenizer = T5Tokenizer.from_pretrained(model_name)
model = T5ForConditionalGeneration.from_pretrained(model_name)

# ✅ Ensure execution is on CPU
device = torch.device("cpu")
model.to(device)

# ✅ Step 3: Preprocess Dataset
def extract_name_from_xpath(xpath):
    """Extracts a meaningful name from an XPath expression."""
    match = re.search(r"@\w+='([^']+)'", xpath)
    if match:
        return match.group(1).replace("_", " ").title()  # Convert underscores to spaces
    return "Unknown Element"

def preprocess_function(examples):
    input_texts = []
    output_texts = []

    for flow, steps in zip(examples["input_flow"], examples["expected_test_steps"]):
        formatted_flow = []

        for step in flow:
            action = step["type"].capitalize()  # Capitalize action type
            target = step.get("tag", step.get("url", "Unknown"))  # Use tag if available
            value_text = f" with value '{step['value']}'" if step.get("value") else ""

            # Handle navigation differently
            if step["type"] == "navigation":
                formatted_flow.append(f"{action} to '{step['url']}'.")
            else:
                # Try to get a meaningful name from XPath if tag is too generic
                if target in ["INPUT", "BUTTON", "MENU", "TAB", "TEXTAREA", "FILTER"]:
                    target_name = extract_name_from_xpath(step["xpath"])
                    formatted_flow.append(f"{action} on {target_name}{value_text}.")
                else:
                    formatted_flow.append(f"{action} on {target}{value_text}.")

        input_texts.append("\n".join(formatted_flow))
        output_texts.append("\n".join(steps))  # Expected test steps

    # Tokenize inputs and outputs
    model_inputs = tokenizer(input_texts, text_target=output_texts, padding="max_length", truncation=True)
    return model_inputs

# ✅ Apply preprocessing
tokenized_datasets = dataset.map(preprocess_function, batched=True)

# ✅ Step 4: Debug - Check a sample
print("🔍 Sample Tokenized Input:", tokenizer.decode(tokenized_datasets["train"][0]["input_ids"]))
print("🔍 Sample Tokenized Output:", tokenizer.decode(tokenized_datasets["train"][0]["labels"]))

# ✅ Step 5: Define Training Arguments
training_args = TrainingArguments(
    output_dir="./fine-tuned-t5",
    per_device_train_batch_size=4,  
    per_device_eval_batch_size=4,
    evaluation_strategy="epoch",
    save_strategy="epoch",
    num_train_epochs=3,
    learning_rate=3e-5,
    logging_dir="./logs",
    logging_steps=10,
    save_total_limit=2,
    
    # ✅ Force CPU execution
    fp16=False,  
    bf16=False,  
    no_cuda=True,  
    dataloader_num_workers=0,  
    report_to="none"  # Prevent logging errors
)

# ✅ Step 6: Initialize Trainer
trainer = Trainer(
    model=model,
    args=training_args,
    train_dataset=tokenized_datasets["train"],
    eval_dataset=tokenized_datasets["train"]
)

# ✅ Step 7: Debug - Check if model training is running correctly
print("🚀 Training started...")

# ✅ Train Model
trainer.train()

# ✅ Step 8: Save Model
trainer.save_model("./fine-tuned-t5")
print("✅ Model training complete! Saved to './fine-tuned-t5'.")
