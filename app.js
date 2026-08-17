// app.js - JoJo Web Console

const urlParams = new URLSearchParams(window.location.search);
const mode = urlParams.get('mode');
const peerId = urlParams.get('peer');

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

    // Configuração do EmulatorJS carregando a ROM direto do Internet Archive
    window.EJS_player = '#game';
    window.EJS_core = 'fbneo';
    window.EJS_gameUrl = 'https://archive.org/download/lvalriv_gmail_Cps3/Roms/Capcom%20Play%20System%20III/jojoba.zip';
    window.EJS_pathtodata = 'https://cdn.emulatorjs.org/stable/data/';

    // Carrega o script loader do EmulatorJS
    const ejsScript = document.createElement('script');
    ejsScript.src = 'https://cdn.emulatorjs.org/stable/data/loader.js';
    document.body.appendChild(ejsScript);

    // Inicialização da conexão PeerJS na TV
    const peer = new Peer();

    peer.on('open', (id) => {
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

    const peer = new Peer();

    peer.on('open', () => {
        // Conecta à TV usando canal de dados direto (UDP / un-reliable para latência zero)
        const conn = peer.connect(peerId, { reliable: false });

        conn.on('open', () => {
            console.log("Conectado à TV com sucesso!");
            
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

        conn.on('error', (err) => {
            console.error("Erro na conexão:", err);
            alert("Erro ao conectar com a TV.");
        });
    });
}
