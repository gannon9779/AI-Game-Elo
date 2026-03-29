// content.js

function extractConversation() {
  const messageNodes = document.querySelectorAll('[data-message-author-role]');
  let conversation = [];
  
  messageNodes.forEach(node => {
    const role = node.getAttribute('data-message-author-role');
    if (role === 'user' || role === 'assistant') {
      const text = node.innerText || "";
      if (text.trim().length > 0) {
        conversation.push({ 
          role: role === 'user' ? 'Human' : 'AI', 
          text: text.substring(0, 2500).trim() 
        });
      }
    }
  });
  return conversation;
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "scrapeChat") {
    try {
      const conversation = extractConversation();
      sendResponse({ success: true, conversation });
    } catch (e) {
      console.error("Scraping error:", e);
      sendResponse({ success: false, error: e.message });
    }
  }
  return true;
});


// Inject Floating Button
function injectAnalyzeButton() {
  if (document.getElementById('ai-game-elo-btn')) return; // already injected

  const btn = document.createElement('button');
  btn.id = 'ai-game-elo-btn';
  btn.innerText = 'Analyze Chat ELO';
  
  // Styling
  Object.assign(btn.style, {
    position: 'fixed',
    bottom: '80px', // slightly higher to avoid ChatGPT's input bar mechanics if they overlap
    right: '24px',
    zIndex: '99999',
    backgroundColor: '#2C2C2E',
    color: '#FFF',
    border: 'none',
    borderRadius: '8px',
    padding: '12px 20px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
    fontFamily: '"Inter", -apple-system, sans-serif',
    transition: 'all 0.2s ease',
    opacity: '0.9'
  });

  btn.onmouseover = () => { btn.style.backgroundColor = '#000'; btn.style.opacity = '1'; };
  btn.onmouseout = () => { btn.style.backgroundColor = '#2C2C2E'; btn.style.opacity = '0.9'; };

  btn.addEventListener('click', handleAnalyzeClick);
  
  document.body.appendChild(btn);
}

function resetBtn(btn, text) {
  btn.innerText = text;
  btn.disabled = false;
  btn.style.opacity = '0.9';
}

async function handleAnalyzeClick(e) {
  const btn = e.target;
  const originalText = 'Analyze Chat ELO';
  btn.innerText = 'Analyzing...';
  btn.disabled = true;
  btn.style.opacity = '1';

  try {
    const conversation = extractConversation();

    if (conversation.length === 0) {
      btn.innerText = "No Chat Found!";
      setTimeout(() => resetBtn(btn, originalText), 3000);
      return;
    }

    chrome.runtime.sendMessage({ action: "analyzeChat", conversation }, (response) => {
      if (chrome.runtime.lastError) {
        btn.innerText = "Connection Error";
        setTimeout(() => resetBtn(btn, originalText), 3000);
        return;
      }
      if (!response || !response.success) {
        btn.innerText = response.error ? "API Error" : "Unknown Error";
        console.error("Groq Analysis Error:", response ? response.error : "Unknown");
        setTimeout(() => resetBtn(btn, originalText), 3000);
        return;
      }

      // Success Display based on outcome
      const outcome = response.data.outcome;
      const eloDiff = response.data.eloDiff;
      
      if (outcome === 'Win') {
        btn.innerText = `Win +${Math.abs(eloDiff)} Elo!`;
        btn.style.backgroundColor = '#388E3C'; // green success
      } else if (outcome === 'Loss') {
        btn.innerText = `Loss -${Math.abs(eloDiff)} Elo :(`;
        btn.style.backgroundColor = '#D32F2F'; // red loss
      } else {
        btn.innerText = `Mixed +${Math.abs(eloDiff)} Elo`;
        btn.style.backgroundColor = '#FBC02D'; // yellow mixed
      }

      // Revert back after 5 seconds
      setTimeout(() => {
        btn.style.backgroundColor = '#2C2C2E';
        resetBtn(btn, originalText);
      }, 5000);
    });

  } catch (err) {
    btn.innerText = "Error Parsing";
    setTimeout(() => resetBtn(btn, originalText), 3000);
  }
}

// Check every 2 seconds to ensure the button stays injected even if SPA re-renders body
setInterval(injectAnalyzeButton, 2000);
