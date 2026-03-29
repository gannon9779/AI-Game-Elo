// options.js

document.addEventListener('DOMContentLoaded', async () => {
    const apiKeyInput = document.getElementById('apiKey');
    const userNameInput = document.getElementById('userName');
    const saveBtn = document.getElementById('saveBtn');
    const statusMsg = document.getElementById('statusMsg');

    // Load existing settings
    const storageData = await chrome.storage.local.get(['groqApiKey', 'userName']);
    
    if (storageData.groqApiKey) {
        apiKeyInput.value = storageData.groqApiKey;
    }
    if (storageData.userName) {
        userNameInput.value = storageData.userName;
    }

    // Save logic
    saveBtn.addEventListener('click', async () => {
        const key = apiKeyInput.value.trim();
        const name = userNameInput.value.trim();

        await chrome.storage.local.set({
            groqApiKey: key,
            userName: name
        });

        // Show success message briefly
        statusMsg.style.display = 'block';
        setTimeout(() => {
            statusMsg.style.display = 'none';
        }, 3000);
    });
});
