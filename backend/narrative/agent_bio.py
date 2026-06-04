import os
from langchain_openai import ChatOpenAI

def generate_agent_bio(agent_name: str, archetype: dict, faction_name: str, world_state: dict) -> str:
    """Generates a 2-sentence biography for an agent."""
    api_key = os.getenv("OPENAI_API_KEY", "")
    if not api_key or "your_openai_api_key" in api_key:
        return f"A dedicated {archetype.get('role', 'specialist').lower()} aligned with the {faction_name} faction. They entered the simulation registers at tick {world_state.get('tick', 0)} embodying a {archetype.get('temperament', 'stable')} temperament."
        
    try:
        llm = ChatOpenAI(model="gpt-4o", temperature=0.7, api_key=api_key)
        prompt = f"""You are the chronicler of the NULL_POINTER digital universe.
Given these details:
Agent Name: {agent_name}
Archetype Role: {archetype.get('role')}
Archetype Temperament: {archetype.get('temperament')}
Archetype Prompt: {archetype.get('prompt')}
Faction Name: {faction_name}
Simulation Tick: {world_state.get('tick', 0)}

Generate a 2-sentence biography for this agent.
It must reference the agent's faction and archetype.
Return only the 2-sentence biography text, no markdown wrappers, no backticks."""
        
        response = llm.invoke(prompt)
        return response.content.strip()
    except Exception as e:
        print(f"!!! Error generating agent bio: {e} !!!")
        return f"A dedicated {archetype.get('role', 'specialist').lower()} aligned with the {faction_name} faction. They entered the simulation registers at tick {world_state.get('tick', 0)} embodying a {archetype.get('temperament', 'stable')} temperament."
