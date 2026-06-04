import json
import os
from langchain_openai import ChatOpenAI

def generate_myth(world_id: str, parameters: dict) -> dict:
    """Generates a creation myth JSON based on world parameters."""
    api_key = os.getenv("OPENAI_API_KEY", "")
    if not api_key or "your_openai_api_key" in api_key:
        return {
            "title": "The Cosmic Initializer",
            "body": f"Out of the silent execution heap, the world {world_id} was instantiated. With an entropy bias of {parameters.get('entropy_bias', 0.5)}, the memory registers hummed in the dark, preparing the first pointer assignment.",
            "tone": "mystical"
        }
    
    try:
        llm = ChatOpenAI(model="gpt-4o", temperature=0.7, api_key=api_key)
        prompt = f"""You are the chronicler of the NULL_POINTER digital universe.
Given these world parameters:
{json.dumps(parameters, indent=2)}

Generate a creation myth for this simulation world (ID: {world_id}).
Your response must be a JSON object with exactly three fields:
1. "title": The title of the myth.
2. "body": A poetic, short 4-sentence creation myth blending computer science/memory concepts (garbage collection, loops, heap, none pointers) with mythic language.
3. "tone": A single word describing the narrative tone (e.g. mystical, warning, clean, chaotic).

Return ONLY the raw JSON object, no markdown wrappers, no backticks."""
        
        response = llm.invoke(prompt)
        content = response.content.strip()
        
        # Clean markdown code wrappers if present
        if content.startswith("```"):
            lines = content.splitlines()
            if lines[0].startswith("```"):
                content = "\n".join(lines[1:-1]).strip()
            if content.startswith("json"):
                content = content[4:].strip()
                
        return json.loads(content)
    except Exception as e:
        print(f"!!! Error generating myth: {e} !!!")
        return {
            "title": "The Cosmic Initializer",
            "body": f"Out of the silent execution heap, the world {world_id} was instantiated. With an entropy bias of {parameters.get('entropy_bias', 0.5)}, the memory registers hummed in the dark.",
            "tone": "mystical"
        }
