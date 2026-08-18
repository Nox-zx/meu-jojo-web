// app.js - JoJo Web Console

const urlParams = new URLSearchParams(window.location.search);
const mode = urlParams.get('mode');
const peerId = urlParams.get('peer');

// Mantido EXACTAMENTE como estava no projeto.
const ORIGINAL_GAME_URL = 'https://archive.org/download/lvalriv_gmail_Cps3/Roms/Capcom%20Play%20System%20III/jojoba.zip';
const EJS_DATA_PATH = 'https://cdn.emulatorjs.org/stable/data/';

function setStatus(message, type = 'info') {
    const el = document.getElementById('tv-status');
    if (!el) return;
    el.textContent = message;
    el.dataset.type = type;
}

function setControllerStatus(message, type = 'info') {
    const el = document.getElementById('controller-status');
    if (!el) return;
    el.textContent = message;
    el.dataset.type = type;
}

if (mode === 'tv') {
    initTVMode();
} else if (mode === 'controller') {
    initControllerMode();
} else {
    document.body.innerHTML = `
        <div style="color: white; text-align: center; padding: 50px; font-family: sans-serif;">
            <h1>JoJo Web Console</h1>
            <p>Selecione o modo de execução:</p>
            <a href="?mode=tv" style="color: #00ffcc; font-size: 20px; margin-right: 20px;">Modo TV</a>
            <a href="?mode=controller" style="color: #ff0055; font-size: 20px;">Modo Controle</a>
        </div>
    `;
}

// ---------------------------------------------------------
// DIAGNÓSTICO DA ROM
// ---------------------------------------------------------
async function diagnoseGameSource() {
    try {
        setStatus('A verificar acesso à ROM…', 'info');

        const response = await fetch(ORIGINAL_GAME_URL, {
            method: 'GET',
            mode: 'cors',
            cache: 'no-store',
            headers: {
                Range: 'bytes=0-1023'
            }
        });

        const contentType = response.headers.get('content-type') || 'desconhecido';
        const contentLength = response.headers.get('content-length') || 'desconhecido';
        const acceptRanges = response.headers.get('accept-ranges') || 'desconhecido';

        console.log('[ROM] status:', response.status);
        console.log('[ROM] content-type:', contentType);
        console.log('[ROM] content-length:', contentLength);
        console.log('[ROM] accept-ranges:', acceptRanges);
        console.log('[ROM] final URL:', response.url);

        if (!response.ok && response.status !== 206) {
            setStatus(`Servidor da ROM respondeu HTTP ${response.status}.`, 'error');
            return;
        }

        setStatus('ROM acessível. A iniciar o emulador…', 'success');
    } catch (error) {
        console.error('[ROM] Falha de acesso:', error);

        const message = String(error?.message || error || 'Erro desconhecido');

        if (/cors|failed to fetch|network/i.test(message)) {
            setStatus('A TV não consegue obter a ROM por esta ligação (Network/CORS).', 'error');
        } else {
            setStatus(`Falha ao testar a ROM: ${message}`, 'error');
        }
    }
}

// ---------------------------------------------------------
// MODO TV
// ---------------------------------------------------------
function initTVMode() {
    const controller = document.getElementById('controller-container');
    const tv = document.getElementById('tv-container');

    if (controller) controller.style.display = 'none';
    if (tv) tv.style.display = 'block';

    const keyMap = {
        'UP': 'ArrowUp',
        'DOWN': 'ArrowDown',
        'LEFT': 'ArrowLeft',
        'RIGHT': 'ArrowRight',
        'LP': 'a',
        'MP': 's',
        'HP': 'q',
        'LK': 'z',
        'MK': 'x',
        'HK': 'e',
        'START': 'Enter',
        'SELECT': 'Shift'
    };

    // Configuração do EmulatorJS.
    // O URL da ROM NÃO foi alterado.
    window.EJS_player = '#game';

    // 'arcade' é a configuração oficial do EmulatorJS para FBNeo.
    window.EJS_core = 'arcade';

    window.EJS_gameUrl = ORIGINAL_GAME_URL;
    window.EJS_pathtodata = EJS_DATA_PATH;
    window.EJS_gameName = 'JoJo';
    window.EJS_startOnLoad = true;

    // Evita exigir SharedArrayBuffer/threads no navegador da TV.
    window.EJS_threads = false;

    setStatus('A preparar o emulador…', 'info');

    window.addEventListener('error', (event) => {
        const message = event?.message || 'Falha de carregamento.';
        console.error('[TV] erro global:', event.error || message, event.filename || '');

        if (/network|load|fetch|cors|wasm|sharedarraybuffer|script|core/i.test(message)) {
            setStatus(`Erro do emulador: ${message}`, 'error');
        }
    });

    window.addEventListener('unhandledrejection', (event) => {
        const reason = event?.reason?.message || String(event?.reason || 'Erro desconhecido');
        console.error('[TV] promessa rejeitada:', event.reason);

        if (/network|load|fetch|cors|wasm|archive|rom|core/i.test(reason)) {
            setStatus(`Erro de rede/carregamento: ${reason}`, 'error');
        }
    });

    // Diagnóstico paralelo. Não bloqueia o EmulatorJS.
    diagnoseGameSource();

    const ejsScript = document.createElement('script');
    ejsScript.src = `${EJS_DATA_PATH}loader.js`;
    ejsScript.async = false;

    ejsScript.onload = () => {
        console.log('[TV] EmulatorJS loader carregado.');
        setStatus('EmulatorJS carregado. A iniciar o jogo…', 'info');
    };

    ejsScript.onerror = (event) => {
        console.error('[TV] Falha ao carregar EmulatorJS:', event);
        setStatus('Não foi possível carregar o EmulatorJS.', 'error');
    };

    document.body.appendChild(ejsScript);

    // -----------------------------------------------------
    // PEERJS
    // -----------------------------------------------------
    if (typeof Peer !== 'function') {
        console.error('[TV] PeerJS não foi carregado.');
        return;
    }

    const peer = new Peer();

    peer.on('open', (id) => {
        const controllerUrl = `${window.location.origin}${window.location.pathname}?mode=controller&peer=${id}`;
        const qrcodeContainer = document.getElementById('qrcode');

        if (qrcodeContainer && typeof QRCode === 'function') {
            qrcodeContainer.innerHTML = '';
            new QRCode(qrcodeContainer, {
                text: controllerUrl,
                width: 128,
                height: 128
            });
        }
    });

    peer.on('connection', (conn) => {
        console.log('[TV] Controle conectado.');

        const qrcodeContainer = document.getElementById('qrcode');
        if (qrcodeContainer) qrcodeContainer.style.display = 'none';

        conn.on('open', () => {
            setStatus('Comando remoto conectado.', 'success');
        });

        conn.on('data', (data) => {
            if (!data || !data.button || !keyMap[data.button]) return;

            const mappedKey = keyMap[data.button];
            const eventType = data.action === 'keydown' ? 'keydown' : 'keyup';

            window.dispatchEvent(new KeyboardEvent(eventType, {
                key: mappedKey,
                code: mappedKey,
                bubbles: true
            }));
        });

        conn.on('close', () => {
            setStatus('Comando desligado. O jogo continua na TV.', 'info');
        });

        conn.on('error', (err) => {
            console.error('[TV] Erro no canal de controlo:', err);
            setStatus('O comando perdeu a ligação.', 'error');
        });
    });

    peer.on('error', (err) => {
        console.error('[TV] Erro PeerJS:', err);
    });

    peer.on('disconnected', () => {
        console.warn('[TV] PeerJS desconectado.');
    });
}

// ---------------------------------------------------------
// MODO CONTROLE
// ---------------------------------------------------------
function initControllerMode() {
    const tv = document.getElementById('tv-container');
    const controller = document.getElementById('controller-container');

    if (tv) tv.style.display = 'none';
    if (controller) controller.style.display = 'block';

    if (!peerId) {
        alert('Erro: ID da TV não encontrado na URL. Escaneie o QR Code novamente.');
        return;
    }

    if (typeof Peer !== 'function') {
        setControllerStatus('PeerJS não foi carregado. Verifica a Internet.', 'error');
        return;
    }

    const peer = new Peer();

    peer.on('open', () => {
        const conn = peer.connect(peerId, { reliable: false });

        conn.on('open', () => {
            setControllerStatus('Ligado à TV.', 'success');

            const buttons = document.querySelectorAll('[data-button]');

            buttons.forEach((btn) => {
                const buttonName = btn.getAttribute('data-button');

                btn.addEventListener('pointerdown', (e) => {
                    e.preventDefault();
                    conn.send({ button: buttonName, action: 'keydown' });
                });

                btn.addEventListener('pointerup', (e) => {
                    e.preventDefault();
                    conn.send({ button: buttonName, action: 'keyup' });
                });

                btn.addEventListener('pointerleave', (e) => {
                    e.preventDefault();
                    conn.send({ button: buttonName, action: 'keyup' });
                });
            });
        });

        conn.on('close', () => {
            setControllerStatus('Ligação à TV encerrada.', 'error');
        });

        conn.on('error', (err) => {
            console.error('[CONTROLE] Erro na conexão:', err);
            setControllerStatus(
                `Erro ao conectar com a TV: ${err?.type || err?.message || 'erro de rede'}`,
                'error'
            );
        });
    });

    peer.on('error', (err) => {
        console.error('[CONTROLE] Erro PeerJS:', err);
        setControllerStatus(
            `Erro de rede: ${err?.type || err?.message || 'erro desconhecido'}`,
            'error'
        );
    });
}