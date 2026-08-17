(() => {
    "use strict";

    const params = new URLSearchParams(window.location.search);
    const mode = params.get("mode");

    const BUTTON_TO_KEY = Object.freeze({
        UP: "ArrowUp",
        DOWN: "ArrowDown",
        LEFT: "ArrowLeft",
        RIGHT: "ArrowRight",
        LP: "a",
        MP: "s",
        HP: "q",
        LK: "z",
        MK: "x",
        HK: "e",
        START: "Enter",
        SELECT: "Shift"
    });

    const showElement = (element) => {
        if (element) {
            element.style.display = "";
        }
    };

    const hideElement = (element) => {
        if (element) {
            element.style.display = "none";
        }
    };

    const setStatus = (element, message) => {
        if (element) {
            element.textContent = message;
        }
    };

    const dispatchKeyboardEvent = (action, mappedKey) => {
        if (action !== "keydown" && action !== "keyup") {
            return;
        }

        const event = new KeyboardEvent(action, {
            key: mappedKey,
            code: mappedKey,
            bubbles: true,
            cancelable: true
        });

        window.dispatchEvent(event);
    };

    const loadEmulatorJS = () => {
        const script = document.createElement("script");
        script.src = "https://cdn.emulatorjs.org/latest/data/loader.js";
        script.async = true;
        script.onload = () => {
            setStatus(document.getElementById("tv-status"), "EmulatorJS carregado.");
        };
        script.onerror = () => {
            setStatus(document.getElementById("tv-status"), "Não foi possível carregar o EmulatorJS.");
        };
        document.body.appendChild(script);
    };

    const initTVMode = () => {
        const tvContainer = document.getElementById("tv-container");
        const controllerContainer = document.getElementById("controller-container");
        const game = document.getElementById("game");
        const tvStatus = document.getElementById("tv-status");

        hideElement(controllerContainer);
        showElement(tvContainer);

        window.EJS_player = "#game";
        window.EJS_core = "fbneo";
        window.EJS_gameUrl = "roms/jojo.zip";
        window.EJS_biosUrl = "";
        window.EJS_pathtodata = "https://cdn.emulatorjs.org/latest/data/";

        if (!game) {
            setStatus(tvStatus, "Erro: contentor do emulador não encontrado.");
            return;
        }

        setStatus(tvStatus, "A criar ligação do comando...");
        loadEmulatorJS();

        if (typeof window.Peer !== "function") {
            setStatus(tvStatus, "Erro: PeerJS não está disponível.");
            return;
        }

        const peer = new Peer();

        peer.on("open", (id) => {
            const controllerUrl = `${window.location.origin}${window.location.pathname}?mode=controller&peer=${encodeURIComponent(id)}`;
            const qrContainer = document.getElementById("qrcode");

            if (qrContainer && typeof window.QRCode === "function") {
                qrContainer.replaceChildren();
                new QRCode(qrContainer, controllerUrl);
            }

            setStatus(tvStatus, "Comando pronto. Leia o QR Code com o telemóvel.");
        });

        peer.on("connection", (conn) => {
            setStatus(tvStatus, "Comando ligado.");

            conn.on("data", (data) => {
                if (!data || typeof data !== "object") {
                    return;
                }

                const mappedKey = BUTTON_TO_KEY[data.button];

                if (!mappedKey) {
                    return;
                }

                dispatchKeyboardEvent(data.action, mappedKey);
            });

            conn.on("close", () => {
                setStatus(tvStatus, "Comando desligado. A aguardar nova ligação...");
            });

            conn.on("error", () => {
                setStatus(tvStatus, "Erro na ligação do comando.");
            });
        });

        peer.on("error", (error) => {
            const message = error && error.message ? error.message : "Erro de comunicação.";
            setStatus(tvStatus, `PeerJS: ${message}`);
        });
    };

    const initControllerMode = () => {
        const tvContainer = document.getElementById("tv-container");
        const controllerContainer = document.getElementById("controller-container");
        const status = document.getElementById("controller-status");
        const peerId = params.get("peer");

        hideElement(tvContainer);
        showElement(controllerContainer);

        if (!peerId) {
            setStatus(status, "Erro de conexão: o ID da TV não foi fornecido.");
            return;
        }

        if (typeof window.Peer !== "function") {
            setStatus(status, "Erro de conexão: PeerJS não está disponível.");
            return;
        }

        const peer = new Peer();

        peer.on("open", () => {
            const conn = peer.connect(peerId, {
                reliable: false
            });

            const setConnectionStatus = (message) => {
                setStatus(status, message);
            };

            conn.on("open", () => {
                setConnectionStatus("Comando ligado à TV.");
            });

            conn.on("close", () => {
                setConnectionStatus("Ligação encerrada.");
            });

            conn.on("error", () => {
                setConnectionStatus("Erro na ligação com a TV.");
            });

            const buttons = document.querySelectorAll("[data-button]");

            buttons.forEach((button) => {
                const buttonName = button.dataset.button;

                const sendAction = (action, event) => {
                    event.preventDefault();

                    if (!conn.open) {
                        setConnectionStatus("A ligar à TV...");
                        return;
                    }

                    conn.send({
                        button: buttonName,
                        action
                    });
                };

                button.addEventListener("pointerdown", (event) => {
                    button.setPointerCapture?.(event.pointerId);
                    button.classList.add("pressed");
                    sendAction("keydown", event);
                }, { passive: false });

                button.addEventListener("pointerup", (event) => {
                    button.classList.remove("pressed");
                    sendAction("keyup", event);
                }, { passive: false });

                button.addEventListener("pointerleave", (event) => {
                    button.classList.remove("pressed");
                    if (conn.open) {
                        event.preventDefault();
                        conn.send({
                            button: buttonName,
                            action: "keyup"
                        });
                    }
                }, { passive: false });

                button.addEventListener("pointercancel", (event) => {
                    button.classList.remove("pressed");
                    if (conn.open) {
                        event.preventDefault();
                        conn.send({
                            button: buttonName,
                            action: "keyup"
                        });
                    }
                }, { passive: false });
            });
        });

        peer.on("error", (error) => {
            const message = error && error.message ? error.message : "Não foi possível estabelecer a ligação.";
            setStatus(status, `Erro: ${message}`);
        });
    };

    const initUnknownMode = () => {
        const tvContainer = document.getElementById("tv-container");
        const controllerContainer = document.getElementById("controller-container");
        hideElement(tvContainer);
        hideElement(controllerContainer);

        const body = document.body;
        const error = document.createElement("div");
        error.style.cssText = "min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;background:#000;color:#fff;text-align:center;font-family:Arial,Helvetica,sans-serif;font-size:18px;";
        error.textContent = "Modo inválido. Use ?mode=tv ou ?mode=controller&peer=ID.";
        body.appendChild(error);
    };

    if (mode === "tv") {
        initTVMode();
    } else if (mode === "controller") {
        initControllerMode();
    } else {
        initUnknownMode();
    }
})();
