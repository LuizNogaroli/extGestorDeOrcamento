"""Servidor de dev local para extGestorDeOrcamento — sem cache, MIME correto
para ES modules. Usado por rodar.bat para testar popup/options como pagina
comum, fora do contexto de extensao instalada.

Ver docs/plano-extensao-chrome.md secao 14.2 (armadilha de cache do
`python -m http.server` puro, que nao envia Cache-Control e faz o navegador
servir JS do cache mesmo apos reload).
"""
import http.server
import socketserver
import os

PORT = 8010
os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        '.js': 'text/javascript',
    }

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()


if __name__ == '__main__':
    with socketserver.TCPServer(('', PORT), NoCacheHandler) as httpd:
        print(f'extGestorDeOrcamento dev server em http://localhost:{PORT}/')
        print(f'  Popup:   http://localhost:{PORT}/popup/popup.html')
        print(f'  Options: http://localhost:{PORT}/options/options.html')
        httpd.serve_forever()
