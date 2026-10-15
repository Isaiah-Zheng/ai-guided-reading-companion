"""Start the local Reader and, when available, the installed Ollama runtime."""
import os
from pathlib import Path
import runpy
import subprocess
import time
import urllib.request

def running(port):
    try:
        opener=urllib.request.build_opener(urllib.request.ProxyHandler({}))
        with opener.open(f'http://127.0.0.1:{port}/'+('api/tags' if port==11434 else 'health'),timeout=2):
            return True
    except OSError:
        return False

if __name__=='__main__':
    if not running(11434):
        binary=Path(os.environ.get('LOCALAPPDATA',''))/'Programs/Ollama/ollama.exe'
        if binary.exists():
            subprocess.Popen([str(binary),'serve'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,
                             creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
            for _ in range(15):
                if running(11434):break
                time.sleep(1)
        else:print('Ollama is not installed. The bundled dictionary still works.')
    if running(8766):print('Reading Tutor is already running on http://127.0.0.1:8766')
    else:runpy.run_path(str(Path(__file__).with_name('server.py')),run_name='__main__')
