"""
Lanzador local de desarrollo para Astro Analytics Pro (FastAPI + Uvicorn + Supabase).
Ejecución: python run.py
"""
import os
import threading
import time
import webbrowser
import uvicorn
from dotenv import load_dotenv

load_dotenv()


def main():
    port = int(os.getenv("PORT", "8000"))
    url = f"http://localhost:{port}"

    def abrir_navegador():
        time.sleep(1.2)
        print(f"Abriendo {url} en tu navegador...")
        webbrowser.open(url)

    threading.Thread(target=abrir_navegador, daemon=True).start()
    uvicorn.run("api.main:app", host="127.0.0.1", port=port, reload=False)


if __name__ == "__main__":
    main()
