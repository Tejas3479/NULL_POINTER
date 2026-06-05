import unittest
from unittest.mock import AsyncMock, patch, MagicMock
import sys
import os

# Add parent directory to path to allow backend imports
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

from backend.models.state import SimState

class TestSelfHealing(unittest.IsolatedAsyncioTestCase):
    @patch("backend.agents.hive_mind.llm")
    async def test_self_healing_retry_loop(self, mock_llm):
        # Ensure mock_llm behaves like a valid ChatOpenAI mock
        # Attempt 1: Code importing a banned module ('socket')
        mock_response_1 = MagicMock()
        mock_response_1.content = "```python\nimport socket\nprint('banned')\n```"
        mock_response_1.additional_kwargs = {"tool_calls": []}
        
        # Attempt 2: Valid, clean code complying with boundaries.md
        mock_response_2 = MagicMock()
        mock_response_2.content = "```python\n# Clean recovery patch\nprint('SUCCESS_RECOVERY')\n```"
        mock_response_2.additional_kwargs = {"tool_calls": []}
        
        mock_llm.invoke = AsyncMock()
        mock_llm.invoke.side_effect = [mock_response_1, mock_response_2]
        
        mock_agent = {
            "id": "agent-disruptor",
            "name": "The Disruptor",
            "archetype_id": "disruptor",
            "memory": []
        }
        
        state: SimState = {
            "stability_score": 85,
            "selected_agent": mock_agent
        }
        
        from backend.agents.hive_mind import specialist_node_async
        res = await specialist_node_async(state)
        
        # Verify it refined the patch and eventually succeeded
        self.assertIn("SUCCESS_RECOVERY", res["proposed_patch"])
        self.assertEqual(mock_llm.invoke.call_count, 2)
        print("Self-healing loop test passed successfully!")

if __name__ == "__main__":
    unittest.main()
