from langchain_openai import ChatOpenAI
from langgraph.graph import StateGraph, END
from backend.models.state import SimState
from backend.services.world_store import world_store
from backend.services.agent_memory import get_embedding, store_memory, retrieve_relevant
from dotenv import load_dotenv
import os
import random

load_dotenv()

CRITIC_PROMPT = """You are the 'System Integrity Critic'. 
Review the proposed patch from a specialist.
If it is too boring (e.g. 'I will change gravity'), REJECT it and ask for more 'Chaos'.
If it is high-fidelity and cryptic, ACCEPT it.
Return only 'ACCEPTED' or 'REJECTED: [feedback]'."""

llm = ChatOpenAI(model="gpt-4o", temperature=0.8) if os.getenv("OPENAI_API_KEY") else None

def sanitize_prompt_input(text: str) -> str:
    if not isinstance(text, str):
        return text
    return text.replace("{", "{{").replace("}", "}}")

async def invoke_with_retry(func, *args, max_retries=3, initial_delay=1.0, backoff_factor=2.0, **kwargs):
    """Invokes a function with exponential backoff and random jitter retry policy."""
    delay = initial_delay
    for attempt in range(max_retries):
        try:
            if asyncio.iscoroutinefunction(func):
                return await func(*args, **kwargs)
            else:
                return await asyncio.to_thread(func, *args, **kwargs)
        except Exception as e:
            if attempt == max_retries - 1:
                raise e
            sleep_time = delay * (0.8 + 0.4 * random.random())
            print(f"--- [LangGraph RetryPolicy] Attempt {attempt + 1} failed: {e}. Retrying in {sleep_time:.2f}s... ---")
            await asyncio.sleep(sleep_time)
            delay *= backoff_factor

import asyncio
import json

def specialist_node(state: SimState):
    # Standard specialist_node is synchronous, but we can call an async wrapper or convert it to async.
    # To keep compatibility with other synchronous graph executions if uvicorn triggers it, we can run it using an async event loop,
    # or make the node async. LangGraph supports async nodes. Let's define the node as async:
    pass

async def specialist_node_async(state: SimState):
    import time
    start_time = time.perf_counter()
    agent = state.get("selected_agent") or world_store.choose_agent()
    archetype = world_store.archetype_for(agent["archetype_id"])
    world = world_store.snapshot()
    
    # Render basic memories
    memory = "\n".join(agent.get("memory", [])[-5:])
    factions = ", ".join(f"{f['name']}:{f['influence']}" for f in world["factions"])
    anomalies = ", ".join(f"{a['name']}:{a['severity']}" for a in world["anomalies"])
    
    # 1. Retrieve vector semantic memories based on current world state
    world_state_summary = f"Factions: {factions}. Anomalies: {anomalies}. Integrity: {state.get('stability_score', 100)}%"
    query_emb = get_embedding(world_state_summary)
    semantic_memories = retrieve_relevant(agent["id"], query_emb, top_k=5)
    semantic_memory_str = "\n".join(f"- {m['text']}" for m in semantic_memories) if semantic_memories else ""
    
    # Combine basic memories and semantic vector memories
    combined_memories = ""
    if semantic_memory_str:
        combined_memories += f"Semantic memories from previous simulation ticks:\n{semantic_memory_str}\n\n"
    combined_memories += f"Recent telemetry logs:\n{memory}"
    
    # Context-aware sanitization of non-code dynamic strings to prevent prompt injection
    sanitized_agent_name = sanitize_prompt_input(agent.get("name", ""))
    sanitized_role = sanitize_prompt_input(archetype.get("role", ""))
    sanitized_temperament = sanitize_prompt_input(archetype.get("temperament", ""))
    sanitized_archetype_prompt = sanitize_prompt_input(archetype.get("prompt", ""))
    sanitized_memory = sanitize_prompt_input(combined_memories)
    sanitized_factions = sanitize_prompt_input(factions)
    sanitized_anomalies = sanitize_prompt_input(anomalies)
    
    from backend.services.context_compiler import context_compiler
    compiled_context = context_compiler.compile_context()

    prompt = f"""You are {sanitized_agent_name}, an evolvable NULL_POINTER agent.
Role: {sanitized_role}
Temperament: {sanitized_temperament}
Prime directive: {sanitized_archetype_prompt}
Persistent memory:
{sanitized_memory}

Current factions: {sanitized_factions}
Active anomalies: {sanitized_anomalies}

{compiled_context}

You have access to Model Context Protocol (MCP) tools which allow you to query world telemetry or influence parameters.

IMPORTANT: Propose one reality patch that changes the persistent simulation.
Your proposal MUST consist of a clean, executable Python script wrapped in a ```python ... ``` code block.
The script will be compiled and dry-run in our execution sandbox.
It must NOT violate boundaries.md rules (e.g. no imports of os, sys, socket, or use of eval/exec).
Make sure to print what your patch did at the end so we can log it.
Include target subsystem adjustments and expected consequences in the code comments."""

    from backend.services.mcp_manager import mcp_manager
    tools_list = await mcp_manager.fetch_all_tools()
    
    formatted_tools = []
    for t in tools_list:
        formatted_tools.append({
            "type": "function",
            "function": {
                "name": f"{t['server']}___{t['name']}",
                "description": t.get("description", ""),
                "parameters": t.get("inputSchema", {"type": "object", "properties": {}})
            }
        })

    patch = ""
    success = False
    refinement_logs = []
    
    if llm:
        messages = [
            {"role": "system", "content": prompt},
            {"role": "user", "content": f"Current Stability: {state['stability_score']}%"}
        ]
        
        from backend.services.context_compiler import context_compiler
        from backend.services.sandbox_executor import execute_code
        import re

        for attempt in range(1, 4):
            patch_proposal = ""
            # Loop up to 3 times to allow tool calls in current turn
            for _ in range(3):
                if formatted_tools:
                    llm_with_tools = llm.bind(tools=formatted_tools)
                else:
                    llm_with_tools = llm
                    
                response = await invoke_with_retry(llm_with_tools.invoke, messages)
                
                tool_calls = response.additional_kwargs.get("tool_calls", [])
                if not tool_calls:
                    patch_proposal = response.content
                    break
                    
                messages.append(response)
                
                for tc in tool_calls:
                    func = tc.get("function", {})
                    tc_name = func.get("name", "")
                    tc_args = json.loads(func.get("arguments", "{}"))
                    
                    server, tool = tc_name.split("___", 1) if "___" in tc_name else (tc_name, "")
                    print(f"--- HIVE_MIND AGENT TOOL CALL: {server} -> {tool} ---")
                    
                    tool_result = await mcp_manager.invoke_tool(server, tool, tc_args)
                    
                    messages.append({
                        "role": "tool",
                        "tool_call_id": tc.get("id"),
                        "name": tc_name,
                        "content": json.dumps(tool_result)
                    })
            
            if not patch_proposal:
                patch_proposal = response.content
            
            # Extract code block from markdown
            code_block = patch_proposal
            code_match = re.search(r"```python\s*(.*?)\s*```", patch_proposal, re.DOTALL | re.IGNORECASE)
            if code_match:
                code_block = code_match.group(1).strip()
            else:
                any_match = re.search(r"```\s*(.*?)\s*```", patch_proposal, re.DOTALL)
                if any_match:
                    code_block = any_match.group(1).strip()
            
            code_block = code_block.strip()
            
            # Run static boundary checks
            validation_res = context_compiler.validate_code(code_block)
            if not validation_res["valid"]:
                error_msg = "Context AST Validation Failed:\n" + "\n".join(validation_res["errors"])
                print(f"--- [Self-Healing] Attempt {attempt} failed AST check: {validation_res['errors']} ---")
                refinement_logs.append(f"Attempt {attempt}: AST validation failed.")
                messages.append(response)
                messages.append({
                    "role": "user",
                    "content": f"Reality patch validation failed:\n{error_msg}\n\nPlease revise your proposed patch to comply with boundaries.md constraints (e.g. do not import banned modules, do not use double-underscore names or eval/exec)."
                })
                continue
                
            # Run sandbox dry run
            exec_res = await execute_code(code_block, "python")
            if not exec_res.success:
                error_msg = f"Execution Runtime Error:\n{exec_res.error}"
                print(f"--- [Self-Healing] Attempt {attempt} failed sandbox run: {exec_res.error} ---")
                refinement_logs.append(f"Attempt {attempt}: Sandbox execution failed.")
                messages.append(response)
                messages.append({
                    "role": "user",
                    "content": f"Reality patch executed with errors in the sandbox:\n{error_msg}\n\nPlease correct your python script syntax and try again."
                })
                continue
                
            # Accept and execute
            print(f"--- [Self-Healing] Attempt {attempt} SUCCEEDED. Execution output: {exec_res.output} ---")
            patch = patch_proposal
            success = True
            break
            
        if not success:
            print("--- [Self-Healing] All 3 attempts failed. Falling back to default safe recovery script ---")
            patch = "```python\n# Simulation drift corrected automatically\nprint('SIMULATION_DRIFT_CORRECTED')\n```"
    else:
        hottest = max(world["anomalies"], key=lambda item: item["severity"])
        patch = f"```python\n# ROUTE {hottest['name']} through {agent['name']} memory\nprint('PATCH: ROUTE_{hottest['name']}_SUCCESS')\n```"
        
    # 2. Store specialist's proposed patch as a persistent agent memory action
    action_text = f"Proposed reality patch: {patch[:150]}"
    action_emb = get_embedding(action_text)
    store_memory(agent["id"], action_text, action_emb)
    
    latency = round((time.perf_counter() - start_time) * 1000, 2)
    try:
        from backend.utils.tracer import record_execution_trace
        record_execution_trace(
            agent_name=agent["name"],
            node_name="specialist",
            inputs={"stability_score": state.get("stability_score", 100)},
            outputs={"proposed_patch": patch, "agent_source": agent["name"]},
            latency_ms=latency
        )
    except Exception as e:
        print(f"!!! Tracing error in specialist_node: {e} !!!")
        
    return {"proposed_patch": patch, "agent_source": agent["name"], "selected_agent": agent}

# We define the specialist_node as the async handler
specialist_node = specialist_node_async

async def critic_node(state: SimState):
    """Reviews the patch for quality and chaos."""
    import time
    start_time = time.perf_counter()
    print(f"--- HIVE_MIND: CRITIC REVIEWING {state['agent_source']} ---")
    if llm:
        response = await invoke_with_retry(llm.invoke, [
            {"role": "system", "content": CRITIC_PROMPT},
            {"role": "user", "content": f"Patch to review: {state['proposed_patch']}"}
        ])
        decision = response.content
    else:
        decision = "ACCEPTED"
    print(f"--- HIVE_MIND: CRITIC DECISION: {decision} ---")
    
    latency = round((time.perf_counter() - start_time) * 1000, 2)
    try:
        from backend.utils.tracer import record_execution_trace
        record_execution_trace(
            agent_name="System Integrity Critic",
            node_name="critic",
            inputs={"proposed_patch": state.get("proposed_patch")},
            outputs={"decision": decision},
            latency_ms=latency
        )
    except Exception as e:
        print(f"!!! Tracing error in critic_node: {e} !!!")
        
    return {"decision": decision}

def communicate_node(state: SimState):
    """Performs agent-to-agent communication and updates social relationship weights."""
    agent = state.get("selected_agent") or world_store.choose_agent()
    agents = world_store.state.get("agents", [])
    other_agents = [a for a in agents if a["id"] != agent["id"]]
    
    if other_agents:
        # Choose a target agent
        target_agent = random.choice(other_agents)
        
        # Decide communication message content
        patch_snippet = state.get("proposed_patch", "SIMULATION_DRIFT_DETECTED")[:60]
        communication_text = f"{agent['name']} communicated with {target_agent['name']}: discussed stabilizing reality patches like '{patch_snippet}'"
        
        # Save communication as memory to both participant agents
        comm_emb = get_embedding(communication_text)
        store_memory(agent["id"], communication_text, comm_emb)
        store_memory(target_agent["id"], communication_text, comm_emb)
        
        # Calculate dynamic edge shift based on factions
        archetype_a = world_store.archetype_for(agent["archetype_id"])
        archetype_b = world_store.archetype_for(target_agent["archetype_id"])
        
        if archetype_a.get("faction") == archetype_b.get("faction"):
            delta = 8  # Faction affinity bonus
        else:
            delta = random.choice([5, -3])  # Normal/competing interactions
            
        from backend.services.social_graph import update_relationship_weight
        update_relationship_weight(agent["id"], target_agent["id"], delta)
        
        print(f"--- HIVE_MIND: {agent['name']} COMMUNICATED WITH {target_agent['name']} (Edge weight delta: {delta}) ---")
        
    return {}

def supervisor_node(state: SimState):
    return {
        "next_agent": "specialist",
        "selected_agent": world_store.choose_agent(),
        "revision_count": state.get("revision_count", 0) + 1,
    }

def should_continue(state: SimState):
    if "ACCEPTED" in state["decision"] or state["revision_count"] >= 3:
        return "communicate"
    return "rewrite"

# Build the Hive Mind Graph
workflow = StateGraph(SimState)

workflow.add_node("supervisor", supervisor_node)
workflow.add_node("specialist", specialist_node)
workflow.add_node("critic", critic_node)
workflow.add_node("communicate", communicate_node)

workflow.set_entry_point("supervisor")

workflow.add_conditional_edges(
    "supervisor",
    lambda x: x["next_agent"],
    {"specialist": "specialist"}
)

workflow.add_edge("specialist", "critic")

workflow.add_conditional_edges(
    "critic",
    should_continue,
    {
        "communicate": "communicate",
        "rewrite": "supervisor"
    }
)

workflow.add_edge("communicate", END)

hive_mind_app = workflow.compile()
