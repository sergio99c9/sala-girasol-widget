(function() {
    // URL del script actual (el widget se servira desde hosting estatico).
    const SCRIPT_URL = document.currentScript.src;
    const ASSET_BASE = SCRIPT_URL.substring(0, SCRIPT_URL.lastIndexOf('/'));

    // URL del backend: se define con data-api en el <script> del widget.
    // Ejemplo: <script src=".../script.js" data-api="https://tu-backend.onrender.com"></script>
    const rawApi = document.currentScript.getAttribute('data-api');
    const API_URL = rawApi ? rawApi.replace(/\/+$/, '') : "";

    // Mantener sincronizado con el backend.
    const MAX_MESSAGE_CHARS = 120;

    // Carga los estilos del widget desde el mismo hosting del script.
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    const cacheBuster = SCRIPT_URL.includes('?') ? SCRIPT_URL.split('?')[1] : `v=${Date.now()}`;
    link.href = `${ASSET_BASE}/style.css?${cacheBuster}`;
    document.head.appendChild(link);

    // Plantilla HTML del boton y la ventana de chat.
    const widgetHTML = `
    <button class="chat-toggler" onclick="toggleChat()">
        <svg class="icon-open" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM13 17H11V15H13V17ZM13 13H11V7H13V13Z" fill="white"/><path d="M20 2H4C2.9 2 2 2.9 2 4V22L6 18H20C21.1 18 22 17.1 22 16V4C22 2.9 21.1 2 20 2ZM20 16H6L4 18V4H20V16Z" fill="currentColor"/></svg>
        <svg class="icon-close" style="display: none;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
    </button>
    <div class="chat-widget" id="chat-widget">
        <div class="chat-header">
            <div class="header-info">
                <h3>Sala Girasol 🌻</h3>
                <p id="chat-status">En linea | Respuesta inmediata</p>
            </div>
            <button class="close-btn" onclick="toggleChat()">×</button>
        </div>
        <div class="chat-body" id="chat-box">
            <div class="message bot">
                <div class="bubble">👋 ¡Hola! Soy el asistente virtual.<br>Puedo ayudarte con la <b>cartelera</b> o hacer una <b>reserva</b>.</div>
            </div>
        </div>
        <div class="chat-footer">
            <div class="input-wrapper">
                <input type="text" id="user-input" placeholder="Escribe tu mensaje..." autocomplete="off" maxlength="${MAX_MESSAGE_CHARS}">
                <span class="char-counter" id="char-counter">0/${MAX_MESSAGE_CHARS}</span>
            </div>
            <button id="send-btn"><svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"></path></svg></button>
        </div>
    </div>
    `;
    document.body.insertAdjacentHTML('beforeend', widgetHTML);

    // Logica de interaccion del widget.
    window.toggleChat = function() {
        document.body.classList.toggle('show-chat');
    };

    const chatBox = document.getElementById('chat-box');
    const userInput = document.getElementById('user-input');
    const sendBtn = document.getElementById('send-btn');
    const charCounter = document.getElementById('char-counter');
    const chatStatus = document.getElementById('chat-status');
    userInput.setAttribute('maxlength', MAX_MESSAGE_CHARS);
    let history = [];
    let backendReady = false;

    function updateCounter() {
        if (userInput.value.length > MAX_MESSAGE_CHARS) {
            userInput.value = userInput.value.slice(0, MAX_MESSAGE_CHARS);
        }
        charCounter.textContent = `${userInput.value.length}/${MAX_MESSAGE_CHARS}`;
    }

    function addMessage(role, text) {
        const div = document.createElement('div');
        div.className = `message ${role}`;
        const bubble = document.createElement('div');
        bubble.className = 'bubble';
        bubble.innerHTML = text.replace(/\n/g, '<br>');
        div.appendChild(bubble);
        chatBox.appendChild(div);
        chatBox.scrollTop = chatBox.scrollHeight;
    }

    function setBackendState(isReady) {
        backendReady = isReady;
        userInput.disabled = !isReady;
        sendBtn.disabled = !isReady;
        chatStatus.textContent = isReady ? "En linea | Respuesta inmediata" : "Activando el chat...";
    }

    async function pingBackend() {
        if (!API_URL) {
            setBackendState(false);
            addMessage('bot', '⚠️ Falta configurar la URL del servidor.');
            return;
        }

        try {
            const resp = await fetch(`${API_URL}/`, { method: 'GET', cache: 'no-store' });
            if (!resp.ok) throw new Error('Not ready');
            setBackendState(true);
        } catch (e) {
            setBackendState(false);
            setTimeout(pingBackend, 5000);
        }
    }

    async function sendMessage() {
        if (!backendReady) {
            addMessage('bot', '⏳ Estoy activandome, dame unos segundos y prueba otra vez.');
            return;
        }
        const text = userInput.value.trim();
        if (!text) return;

        addMessage('user', text);
        userInput.value = '';
        updateCounter();
        history.push({ role: "user", content: text });

        const loadingId = "loading-" + Date.now();
        addMessage('bot', '<span id="' + loadingId + '">Pensando... 🌻</span>');

        try {
            // Llamada al endpoint del backend configurado.
            const response = await fetch(`${API_URL}/api/v1/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messages: history })
            });
            
            const loadEl = document.getElementById(loadingId);
            if (loadEl) loadEl.parentElement.parentElement.remove();

            if (!response.ok) throw new Error('Error API');
            const data = await response.json();
            
            addMessage('bot', data.reply);
            history.push({ role: "assistant", content: data.reply });

        } catch (e) {
            console.error(e);
            const loadEl = document.getElementById(loadingId);
            if (loadEl) loadEl.parentElement.parentElement.remove();
            addMessage('bot', '⚠️ Error de conexion.');
        }
    }

    sendBtn.addEventListener('click', sendMessage);
    userInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendMessage(); });
    userInput.addEventListener('input', updateCounter);
    updateCounter();

    // Arranque: deshabilitar y activar cuando el backend responda.
    setBackendState(false);
    pingBackend();

})();
