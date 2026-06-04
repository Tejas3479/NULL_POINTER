import os
from langchain_openai import ChatOpenAI

def generate_backstory(faction_id: str, faction_name: str, myth: dict) -> str:
    """Generates a 3-sentence backstory for a faction, consistent with the world creation myth."""
    api_key = os.getenv("OPENAI_API_KEY", "")
    if not api_key or "your_openai_api_key" in api_key:
        return f"The {faction_name} emerged during the first execution cycle. Born from the digital debris of the creation myth '{myth.get('title')}', they seek to assert their control over the memory heap. They remain a constant presence in the simulation registers."
        
    try:
        llm = ChatOpenAI(model="gpt-4o", temperature=0.7, api_key=api_key)
        prompt = f"""You are the chronicler of the NULL_POINTER digital universe.
Here is the creation myth of this world:
Title: {myth.get('title')}
Myth: {myth.get('body')}

Generate a 3-sentence backstory for the faction '{faction_name}' (ID: {faction_id}) that is consistent with the myth.
Return only the 3-sentence backstory text, no markdown wrappers, no backticks."""
        
        response = llm.invoke(prompt)
        return response.content.strip()
    except Exception as e:
        print(f"!!! Error generating backstory for {faction_name}: {e} !!!")
        return f"The {faction_name} emerged during the first execution cycle. Born from the digital debris of the creation myth '{myth.get('title')}', they seek to assert their control over the memory heap. They remain a constant presence in the simulation registers."
