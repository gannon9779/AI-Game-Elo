// popup.js

document.addEventListener('DOMContentLoaded', async () => {
  // Elements
  const tabs = document.querySelectorAll('.tab-button');
  const tabContents = document.querySelectorAll('.tab-content');
  const closePopup = document.getElementById('closePopup');
  
  const userNameEl = document.querySelector('.user-name');
  const currentScoreEl = document.getElementById('currentScore');
  const currentRankEl = document.getElementById('currentRank');
  
  const apiKeyInput = document.getElementById('apiKey');
  const userNameInput = document.getElementById('userName');
  const saveSettingsBtn = document.getElementById('saveSettingsBtn');
  const resetDataBtn = document.getElementById('resetDataBtn');
  const settingsMessage = document.getElementById('settingsMessage');
  
  const analyzeBtn = document.getElementById('analyzeBtn');
  const loadingStatus = document.getElementById('loadingStatus');
  const errorMessage = document.getElementById('errorMessage');
  
  const historyList = document.getElementById('historyList');

  // Load Initial Data
  let storageData = await chrome.storage.local.get(['groqApiKey', 'userName', 'currentElo', 'eloHistory']);
  
  // Set defaults
  let currentElo = storageData.currentElo || 1200;
  let history = storageData.eloHistory || [];
  
  userNameInput.value = storageData.userName || "";
  apiKeyInput.value = storageData.groqApiKey || "";
  userNameEl.textContent = storageData.userName || "Player";

  updateUI(currentElo, history);

  // --- TAB LOGIC ---
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      // Remove active classes
      tabs.forEach(t => t.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));
      
      // Add active class
      tab.classList.add('active');
      document.getElementById(`tab-${tab.dataset.tab}`).classList.add('active');
      
      // Draw graph when score tab is active
      if (tab.dataset.tab === 'score') {
        renderGraph(history);
      }
    });
  });

  // --- CLOSE ---
  closePopup.addEventListener('click', () => {
    window.close();
  });

  // --- SETTINGS LOGIC ---
  saveSettingsBtn.addEventListener('click', async () => {
    const key = apiKeyInput.value.trim();
    const name = userNameInput.value.trim();
    await chrome.storage.local.set({ groqApiKey: key, userName: name });
    
    userNameEl.textContent = name || "Player";
    
    settingsMessage.textContent = "Saved successfully.";
    settingsMessage.classList.remove('hidden');
    setTimeout(() => settingsMessage.classList.add('hidden'), 3000);
  });

  resetDataBtn.addEventListener('click', async () => {
    if(confirm("Are you sure you want to reset your Elo and History?")) {
      await chrome.storage.local.remove(['currentElo', 'eloHistory']);
      currentElo = 1200;
      history = [];
      updateUI(currentElo, history);
      settingsMessage.textContent = "Data reset successfully.";
      settingsMessage.classList.remove('hidden');
      setTimeout(() => settingsMessage.classList.add('hidden'), 3000);
    }
  });



  // --- UI & GRAPH LOGIC ---
  function getRankDetails(elo) {
    if (elo < 1100) return { name: 'Bronze', class: 'bronze', color: '#cd7f32' };
    if (elo < 1200) return { name: 'Silver', class: 'silver', color: '#9e9e9e' };
    if (elo < 1300) return { name: 'Gold', class: 'gold', color: '#e2c044' };
    if (elo < 1400) return { name: 'Platinum', class: 'platinum', color: '#8bc8cb' };
    if (elo < 1500) return { name: 'Diamond', class: 'diamond', color: '#9E8EE4' };
    return { name: 'Master', class: 'master', color: '#E91E63' };
  }

  function updateUI(elo, hist) {
    currentScoreEl.textContent = elo;
    const rank = getRankDetails(elo);
    currentRankEl.textContent = rank.name;

    // Remove all old rank colors
    const rankClasses = ['bronze', 'silver', 'gold', 'platinum', 'diamond', 'master'];
    currentScoreEl.classList.remove(...rankClasses);
    currentRankEl.classList.remove(...rankClasses);

    currentScoreEl.classList.add(rank.class);
    currentRankEl.classList.add(rank.class);

    renderHistory(hist);
    renderGraph(hist);
  }

  function renderHistory(hist) {
    historyList.innerHTML = '';
    
    if (hist.length === 0) {
      historyList.innerHTML = `<div class="history-empty">No games played yet.</div>`;
      return;
    }

    const reversed = [...hist].reverse(); // newest first
    
    reversed.forEach(item => {
      const el = document.createElement('div');
      el.className = 'history-item';
      
      let outcomeColor = item.outcome === 'Win' ? '#388E3C' : (item.outcome === 'Loss' ? '#D32F2F' : '#6B6B70');
      
      const d = new Date(item.date);
      const dateFormat = `${d.toLocaleDateString()} ${d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;

      el.innerHTML = `
        <div class="history-item-left">
          <div class="date">${dateFormat}</div>
          <div class="outcome" style="color: ${outcomeColor}">${item.outcome}</div>
        </div>
        <div class="history-item-right rank-color ${getRankDetails(item.elo).class}">
          ${item.elo}
        </div>
      `;
      historyList.appendChild(el);
    });
  }

  function renderGraph(hist) {
    const canvas = document.getElementById('eloGraph');
    const ctx = canvas.getContext('2d');
    
    // Setup dimensions for high DPI
    const rect = canvas.parentElement.getBoundingClientRect();
    const width = rect.width - 32; // padding
    const height = 120;
    
    // Scale for crisp rendering
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';

    ctx.clearRect(0, 0, width, height);

    if (hist.length === 0) return;

    // Get last 20
    const pointsData = hist.slice(-20).map(h => ({ elo: h.elo }));
    if (pointsData.length === 1) {
      // Just visually add the start 1200 point for better UX
      pointsData.unshift({ elo: 1200 });
    }

    const minElo = Math.min(...pointsData.map(p => p.elo));
    const maxElo = Math.max(...pointsData.map(p => p.elo));
    
    // Add buffer
    const buffer = 50;
    const yMin = Math.max(0, minElo - buffer);
    const yMax = maxElo + buffer;
    
    const rangeY = yMax - yMin;
    
    // Graph bounds padding
    const paddingX = 20;
    const paddingY = 15;
    const gWidth = width - (paddingX * 2);
    const gHeight = height - (paddingY * 2);

    // Draw Axes
    ctx.beginPath();
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    // Y axis
    ctx.moveTo(paddingX, paddingY);
    ctx.lineTo(paddingX, height - paddingY);
    // X axis
    ctx.lineTo(width - paddingX, height - paddingY);
    ctx.stroke();

    // Draw X-axis Text labels
    ctx.fillStyle = '#6B6B70';
    ctx.font = '10px Inter';
    ctx.textAlign = 'left';
    ctx.fillText(pointsData.length > 1 ? `${pointsData.length - 1} ago` : 'Origin', paddingX, height);
    ctx.textAlign = 'right';
    ctx.fillText('Now', width - paddingX, height);

    // Calculate coordinates
    const points = pointsData.map((data, i) => {
      const x = paddingX + (i * (gWidth / (pointsData.length - 1 || 1)));
      const y = (height - paddingY) - (((data.elo - yMin) / rangeY) * gHeight);
      return { x, y, elo: data.elo };
    });

    // Draw straight grey lines
    ctx.beginPath();
    ctx.strokeStyle = '#A8A8A8'; // grey
    ctx.lineWidth = 2;
    points.forEach((p, i) => {
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.stroke();

    // Draw discrete points
    points.forEach(p => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = getRankDetails(p.elo).color;
      ctx.fill();
    });
  }
});
