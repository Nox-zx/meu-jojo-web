// app.js - JoJo Web Console

const urlParams = new URLSearchParams(window.location.search);
const mode = urlParams.get('mode');
const peerId = urlParams.get('peer');

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
    // Caso nenhuma opção seja passada, exibe tela de seleção básica
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
// MODO TV (CONSOLE)
// ---------------------------------------------------------
function initTVMode() {
    document.getElementById('controller-container').style.display = 'none';
    document.getElementById('tv-container').style.display = 'block';

    // Mapeamento de teclas virtuais para o EmulatorJS
    const keyMap = {
        'UP': 'ArrowUp',
        'DOWN': 'ArrowDown',
        'LEFT': 'ArrowLeft',
        'RIGHT': 'ArrowRight',
        'LP': 'a',       // Soco Fraco
        'MP': 's',       // Soco Médio
        'HP': 'q',       // Soco Forte
        'LK': 'z',       // Chute Fraco
        'MK': 'x',       // Chute Médio
        'HK': 'e',       // Chute Forte
        'START': 'Enter',
        'SELECT': 'Shift'
    };

    // Configuração do EmulatorJS. O URL da ROM foi mantido exactamente igual.
    window.EJS_player = '#game';
    window.EJS_core = 'fbneo';
    window.EJS_gameUrl = ORIGINAL_GAME_URL;
    window.EJS_pathtodata = EJS_DATA_PATH;
    window.EJS_gameName = 'JoJo';
    window.EJS_startOnLoad = true;

    setStatus('A carregar o emulador…', 'info');

    // Diagnóstico global: Smart TVs podem transformar falhas de CORS/rede em
    // mensagens genéricas. Guardamos o erro real no console e mostramos uma
    // mensagem útil na interface sem alterar o URL da ROM.
    window.addEventListener('error', (event) => {
        const message = event?.message || 'Falha de rede ou carregamento.';
        console.error('[TV] erro global:', event.error || message, event.filename || '');
        if (/network|load|fetch|cors|wasm|script/i.test(message)) {
            setStatus(`Erro de carregamento: ${message}`, 'error');
        }
    });

    window.addEventListener('unhandledrejection', (event) => {
        const reason = event?.reason?.message || String(event?.reason || 'Erro desconhecido');
        console.error('[TV] promessa rejeitada:', event.reason);
        if (/network|load|fetch|cors|wasm|archive|rom/i.test(reason)) {
            setStatus(`Erro de rede: ${reason}`, 'error');
        }
    });

    // Carrega o script loader do EmulatorJS.
    const ejsScript = document.createElement('script');
    ejsScript.src = `${EJS_DATA_PATH}loader.js`;
    ejsScript.async = false;
    ejsScript.onload = () => {
        console.log('[TV] EmulatorJS loader carregado.');
        setStatus('Emulador carregado. A preparar o jogo…', 'info');
    };
    ejsScript.onerror = (event) => {
        console.error('[TV] Falha ao carregar EmulatorJS:', event);
        setStatus('Não foi possível carregar o EmulatorJS. Verifica a ligação à Internet da TV.', 'error');
    };
    document.body.appendChild(ejsScript);

    // Inicialização da conexão PeerJS na TV
    if (typeof Peer !== 'function') {
        console.error('[TV] PeerJS não foi carregado.');
        setStatus('O emulador pode continuar, mas o comando remoto não foi carregado.', 'error');
        return;
    }

    const peer = new Peer();

    peer.on('open', (id) => {
        setStatus('Jogo em carregamento. Comando remoto pronto.', 'info');
        // Constrói a URL para o celular se conectar como controle
        const controllerUrl = `${window.location.origin}${window.location.pathname}?mode=controller&peer=${id}`;
        
        // Gera o QR Code na tela
        const qrcodeContainer = document.getElementById("qrcode");
        qrcodeContainer.innerHTML = "";
        new QRCode(qrcodeContainer, {
            text: controllerUrl,
            width: 128,
            height: 128
        });
    });

    peer.on('connection', (conn) => {
        console.log("Controle conectado!");
        
        // Oculta o QR Code após a conexão para não atrapalhar a visão da TV
        const qrcodeContainer = document.getElementById("qrcode");
        if (qrcodeContainer) {
            qrcodeContainer.style.display = 'none';
        }

        // Escuta os comandos enviados pelo celular
        conn.on('open', () => {
            console.log('[TV] Canal de controlo aberto.');
            setStatus('Comando remoto conectado.', 'success');
        });

        conn.on('data', (data) => {
            if (data && data.button && keyMap[data.button]) {
                const mappedKey = keyMap[data.button];
                const eventType = data.action === 'keydown' ? 'keydown' : 'keyup';

                window.dispatchEvent(new KeyboardEvent(eventType, {
                    key: mappedKey,
                    code: mappedKey,
                    bubbles: true
                }));
            }
        });

        conn.on('close', () => {
            console.log('[TV] Comando desligado.');
            setStatus('Comando desligado. O jogo continua na TV.', 'info');
        });

        conn.on('close', () => {
            setControllerStatus('Ligação à TV encerrada.', 'error');
        });

        conn.on('error', (err) => {
            console.error('[TV] Erro no canal de controlo:', err);
            setStatus('O comando perdeu a ligação.', 'error');
        });
    });

    peer.on('error', (err) => {
        console.error('[TV] Erro PeerJS:', err);
        setStatus(`Erro do comando remoto: ${err?.type || err?.message || 'erro de rede'}`, 'error');
    });

    peer.on('disconnected', () => {
        console.warn('[TV] PeerJS desconectado.');
        setStatus('Comando remoto temporariamente desligado.', 'error');
    });
}

// ---------------------------------------------------------
// MODO CONTROLE (CELULAR)
// ---------------------------------------------------------
function initControllerMode() {
    document.getElementById('tv-container').style.display = 'none';
    document.getElementById('controller-container').style.display = 'block';

    if (!peerId) {
        alert("Erro: ID da TV não encontrado na URL. Escaneie o QR Code novamente.");
        return;
    }

    if (typeof Peer !== 'function') {
        setControllerStatus('PeerJS não foi carregado. Verifica a Internet.', 'error');
        return;
    }

    const peer = new Peer();

    peer.on('open', () => {
        // Conecta à TV usando canal de dados direto (UDP / un-reliable para latência zero)
        const conn = peer.connect(peerId, { reliable: false });

        conn.on('open', () => {
            console.log("Conectado à TV com sucesso!");
            setControllerStatus('Ligado à TV.', 'success');
            
            // Mapeia todos os botões do controle
            const buttons = document.querySelectorAll('[data-button]');

            buttons.forEach((btn) => {
                const buttonName = btn.getAttribute('data-button');

                // Envia comando ao pressionar o botão
                btn.addEventListener('pointerdown', (e) => {
                    e.preventDefault();
                    conn.send({ button: buttonName, action: 'keydown' });
                });

                // Envia comando ao soltar ou arrastar o dedo para fora do botão
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
            console.error("Erro na conexão:", err);
            setControllerStatus(`Erro ao conectar com a TV: ${err?.type || err?.message || 'erro de rede'}`, 'error');
        });
    });

    peer.on('error', (err) => {
        console.error('[CONTROLE] Erro PeerJS:', err);
        setControllerStatus(`Erro de rede: ${err?.type || err?.message || 'erro desconhecido'}`, 'error');
    });
}