#!/usr/bin/env python3
import os
import socket
import sys
from http.server import HTTPServer, SimpleHTTPRequestHandler

PORT = 8080
FILENAME = "jojoba.zip"

SEARCH_PATHS = [
    os.path.abspath("."),
    "/storage/emulated/0/Download",
    "/storage/emulated/0/Downloads",
    os.path.expanduser("~/downloads"),
]

def get_local_ip():
    """Obtém o IP local do telemóvel na rede Wi-Fi."""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
    except Exception:
        ip = "127.0.0.1"
    finally:
        s.close()
    return ip

def locate_rom():
    """Procura pelo arquivo jojoba.zip nos diretórios padrão."""
    for path in SEARCH_PATHS:
        candidate = os.path.join(path, FILENAME)
        if os.path.isfile(candidate):
            return candidate
    return None

class ROMServerHandler(SimpleHTTPRequestHandler):
    """Handler HTTP customizado com suporte a CORS, Range Requests (HTTP 206) e Health Check."""

    def do_OPTIONS(self):
        """Responde a requisições preflight do CORS."""
        self.send_response(200)
        self.send_cors_headers()
        self.end_headers()

    def send_cors_headers(self):
        """Adiciona cabeçalhos CORS liberados para o EmulatorJS."""
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Range, Content-Type, Accept")
        self.send_header("Access-Control-Expose-Headers", "Content-Range, Content-Length, Accept-Ranges")

    def do_HEAD(self):
        """Suporte a requisições HEAD para verificar o tamanho da ROM."""
        if self.path.lstrip("/") == FILENAME:
            rom_path = locate_rom()
            if rom_path:
                file_size = os.path.getsize(rom_path)
                self.send_response(200)
                self.send_cors_headers()
                self.send_header("Content-Type", "application/zip")
                self.send_header("Accept-Ranges", "bytes")
                self.send_header("Content-Length", str(file_size))
                self.end_headers()
                return
        self.send_error(404, "Arquivo nao encontrado.")

    def do_GET(self):
        # Endpoint de status
        if self.path == "/health":
            self.send_response(200)
            self.send_header("Content-Type", "text/plain; charset=utf-8")
            self.send_cors_headers()
            self.end_headers()
            self.wfile.write(b"OK - Servidor de ROMs ativo")
            return

        # Página inicial de teste
        if self.path in ("/", "/index.html"):
            rom_path = locate_rom()
            status = f"ROM encontrada em: {rom_path}" if rom_path else "ATENCAO: jojoba.zip NAO encontrado nos downloads!"
            html = f"""<!DOCTYPE html>
<html>
<head><title>Servidor ROM JoJo</title></head>
<body style="font-family:sans-serif; padding:20px;">
    <h2>Servidor de ROMs - JoJo Web Console</h2>
    <p><strong>Status:</strong> {status}</p>
    <ul>
        <li><a href="/health">Testar Endpoint /health</a></li>
        <li><a href="/{FILENAME}">Baixar / Testar {FILENAME}</a></li>
    </ul>
</body>
</html>"""
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_cors_headers()
            self.end_headers()
            self.wfile.write(html.encode("utf-8"))
            return

        # Trata o download do jojoba.zip
        if self.path.lstrip("/") == FILENAME:
            rom_path = locate_rom()
            if not rom_path:
                self.send_error(404, f"Arquivo {FILENAME} nao encontrado no armazenamento do dispositivo.")
                return
            self.serve_file_with_range(rom_path)
            return

        super().do_GET()

    def serve_file_with_range(self, file_path):
        """Servidor de arquivo com suporte a HTTP 206 Partial Content (pedidos Range)."""
        try:
            file_size = os.path.getsize(file_path)
            range_header = self.headers.get("Range")

            if range_header:
                bytes_range = range_header.strip().lower().replace("bytes=", "")
                parts = bytes_range.split("-")
                start = int(parts[0]) if parts[0] else 0
                end = int(parts[1]) if len(parts) > 1 and parts[1] else file_size - 1

                if start >= file_size or end >= file_size or start > end:
                    self.send_response(416)
                    self.send_header("Content-Range", f"bytes */{file_size}")
                    self.end_headers()
                    return

                length = (end - start) + 1

                print(f"[PEDIDO RANGE] Enviando bytes {start}-{end}/{file_size}")

                self.send_response(206)
                self.send_cors_headers()
                self.send_header("Content-Type", "application/zip")
                self.send_header("Accept-Ranges", "bytes")
                self.send_header("Content-Range", f"bytes {start}-{end}/{file_size}")
                self.send_header("Content-Length", str(length))
                self.end_headers()

                with open(file_path, "rb") as f:
                    f.seek(start)
                    chunk_size = 64 * 1024
                    bytes_to_send = length
                    while bytes_to_send > 0:
                        chunk = f.read(min(chunk_size, bytes_to_send))
                        if not chunk:
                            break
                        self.wfile.write(chunk)
                        bytes_to_send -= len(chunk)
            else:
                print(f"[PEDIDO COMPLETO] Enviando arquivo total ({file_size} bytes)")
                self.send_response(200)
                self.send_cors_headers()
                self.send_header("Content-Type", "application/zip")
                self.send_header("Accept-Ranges", "bytes")
                self.send_header("Content-Length", str(file_size))
                self.end_headers()

                with open(file_path, "rb") as f:
                    chunk_size = 64 * 1024
                    while True:
                        chunk = f.read(chunk_size)
                        if not chunk:
                            break
                        self.wfile.write(chunk)

        except Exception as e:
            print(f"[ERRO] Falha ao servir arquivo: {e}")

def run():
    rom_path = locate_rom()
    local_ip = get_local_ip()

    print("=" * 60)
    print("      JOJO WEB CONSOLE - SERVIDOR ROM LOCAL (PYDROID 3)")
    print("=" * 60)

    if rom_path:
        print(f"[OK] ROM encontrada: {rom_path}")
    else:
        print(f"[AVISO] '{FILENAME}' NAO foi encontrado no Download.")
        print(f"        Certifique-se de colocar o arquivo em /storage/emulated/0/Download/")

    print("-" * 60)
    print(f"IP do Telemovel: {local_ip}")
    print(f"URL de Teste:   http://{local_ip}:{PORT}/")
    print(f"URL da ROM:     http://{local_ip}:{PORT}/{FILENAME}")
    print("=" * 60)
    print("Pressione CTRL+C no Pydroid 3 para encerrar.\n")

    server_address = ("", PORT)
    httpd = HTTPServer(server_address, ROMServerHandler)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nServidor encerrado.")
        httpd.server_close()

if __name__ == "__main__":
    run()
