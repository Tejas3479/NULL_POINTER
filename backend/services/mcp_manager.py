import httpx
import asyncio
from typing import Dict, Any, List, Optional
from backend.services.world_store import world_store

class MCPClient:
    def __init__(self, name: str, sse_url: str):
        self.name = name
        self.sse_url = sse_url
        self.tools: List[Dict[str, Any]] = []

    async def fetch_tools(self) -> List[Dict[str, Any]]:
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                # 1. Try standard JSON-RPC tools/list
                try:
                    url = self.sse_url.rstrip("/") + "/tools/list"
                    res = await client.post(
                        url,
                        json={"jsonrpc": "2.0", "method": "tools/list", "params": {}, "id": 1}
                    )
                    if res.status_code == 200:
                        res_data = res.json()
                        if "result" in res_data:
                            self.tools = res_data["result"].get("tools", [])
                            return self.tools
                except Exception:
                    pass

                # 2. Try simple /tools GET fallback
                url = self.sse_url.rstrip("/") + "/tools"
                res = await client.get(url)
                if res.status_code == 200:
                    res_data = res.json()
                    self.tools = res_data.get("tools", res_data.get("result", {}).get("tools", []))
                    return self.tools
        except Exception as e:
            print(f"!!! MCP error fetching tools from {self.sse_url}: {e} !!!")
        return []

    async def call_tool(self, tool_name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                # 1. Try standard JSON-RPC tools/call
                try:
                    url = self.sse_url.rstrip("/") + "/tools/call"
                    payload = {
                        "jsonrpc": "2.0",
                        "method": "tools/call",
                        "params": {
                            "name": tool_name,
                            "arguments": arguments
                        },
                        "id": 2
                    }
                    res = await client.post(url, json=payload)
                    if res.status_code == 200:
                        return res.json()
                except Exception:
                    pass

                # 2. Try direct POST fallback
                url = self.sse_url.rstrip("/") + f"/call/{tool_name}"
                res = await client.post(url, json=arguments)
                if res.status_code == 200:
                    return res.json()
        except Exception as e:
            return {"error": f"Failed to execute MCP tool: {e}"}
        return {"error": "Tool execution returned status failure"}

class MCPManager:
    def __init__(self):
        self.clients: Dict[str, MCPClient] = {}

    def get_servers(self) -> List[Dict[str, Any]]:
        # Load from world store state
        if not world_store.state:
            return []
        return world_store.state.get("mcp_servers", [])

    async def register_server(self, name: str, sse_url: str) -> Dict[str, Any]:
        servers = self.get_servers()
        # Remove if exists
        servers = [s for s in servers if s["name"] != name]
        servers.append({"name": name, "sse_url": sse_url})
        
        # Save to world store
        world_store.state["mcp_servers"] = servers
        world_store.save()
        
        client = MCPClient(name, sse_url)
        self.clients[name] = client
        tools = await client.fetch_tools()
        
        return {
            "status": "success",
            "name": name,
            "sse_url": sse_url,
            "tools": tools
        }

    def deregister_server(self, name: str) -> Dict[str, Any]:
        servers = self.get_servers()
        servers = [s for s in servers if s["name"] != name]
        
        world_store.state["mcp_servers"] = servers
        world_store.save()
        
        if name in self.clients:
            del self.clients[name]
            
        return {"status": "success"}

    async def fetch_all_tools(self) -> List[Dict[str, Any]]:
        all_tools = []
        servers = self.get_servers()
        for s in servers:
            name = s["name"]
            url = s["sse_url"]
            if name not in self.clients:
                self.clients[name] = MCPClient(name, url)
            tools = await self.clients[name].fetch_tools()
            for t in tools:
                all_tools.append({
                    "server": name,
                    "name": t.get("name"),
                    "description": t.get("description"),
                    "inputSchema": t.get("inputSchema", t.get("schema", {}))
                })
        return all_tools

    async def invoke_tool(self, server_name: str, tool_name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
        servers = self.get_servers()
        target = next((s for s in servers if s["name"] == server_name), None)
        if not target:
            return {"error": f"MCP Server '{server_name}' not found."}
            
        if server_name not in self.clients:
            self.clients[server_name] = MCPClient(server_name, target["sse_url"])
            
        return await self.clients[server_name].call_tool(tool_name, arguments)

mcp_manager = MCPManager()
