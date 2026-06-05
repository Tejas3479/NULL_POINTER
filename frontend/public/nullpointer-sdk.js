(function(global) {
  const NP = {
    connect: function(worldId, callback) {
      const wsUrl = `ws://127.0.0.1:8000/ws/spectate/${worldId}`;
      const socket = new WebSocket(wsUrl);

      socket.onmessage = function(event) {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'world_update' && data.world) {
            callback(data.world);
          } else if (data.type === 'reality_patch' && data.world) {
            callback(data.world);
          } else if (data.type === 'attack_result' && data.world) {
            callback(data.world);
          }
        } catch (e) {
          console.error("SDK socket parse error", e);
        }
      };

      socket.onclose = function() {
        // Auto-reconnect after 3 seconds
        setTimeout(() => {
          NP.connect(worldId, callback);
        }, 3000);
      };

      return socket;
    },

    init: function(worldId, elementId) {
      const container = document.getElementById(elementId);
      if (!container) return;

      const badgeUrl = `http://localhost:8000/v1/simulation/${worldId}/badge.svg`;
      
      // Fetch initial SVG and embed inline
      fetch(badgeUrl)
        .then(res => {
          if (!res.ok) throw new Error("Status " + res.status);
          return res.text();
        })
        .then(svgText => {
          container.innerHTML = svgText;
          
          // Subscribe to live updates
          NP.connect(worldId, function(worldState) {
            const bar = container.querySelector('#np-bar-rect');
            const stabText = container.querySelector('#np-stability-text');
            const agentText = container.querySelector('#np-agent-text');
            const tickText = container.querySelector('#np-tick-text');

            if (worldState.stability !== undefined) {
              const stability = worldState.stability;
              if (bar) {
                const width = Math.max(0, Math.min(50, (stability / 100) * 50));
                bar.setAttribute('width', width);
                
                let color = "#10B981"; // emerald
                if (stability < 25) color = "#EF4444"; // red
                else if (stability < 70) color = "#F59E0B"; // amber
                bar.setAttribute('fill', color);
                
                if (stabText) {
                  stabText.setAttribute('fill', color);
                  stabText.textContent = `${stability}%`;
                }
              }
            }

            if (worldState.agents !== undefined && agentText) {
              const activeAgents = worldState.agents.filter(a => a.active).length;
              agentText.textContent = activeAgents;
            }

            if (worldState.tick !== undefined && tickText) {
              tickText.textContent = worldState.tick;
            }
          });
        })
        .catch(err => {
          console.error("SDK failed to fetch badge", err);
          // Fallback to static img
          container.innerHTML = `<img src="${badgeUrl}" alt="Simulation Badge" style="display:inline-block;border:none;" />`;
        });
    }
  };

  global.NP = NP;
})(typeof window !== 'undefined' ? window : this);
