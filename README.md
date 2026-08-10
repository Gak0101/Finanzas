# Finanzas personales

Aplicación de escritorio Kivy/KivyMD para organizar ingresos por categorías y
porcentajes. La información se guarda en una base SQLite local.

## Usar el proyecto en ChatGPT/Codex Cloud

1. Sube este repositorio a un proveedor Git compatible y conéctalo al entorno
   Cloud.
2. Configura como script de preparación:

   ```bash
   bash .codex/setup.sh
   ```

3. Para ejecutar comprobaciones en una tarea Cloud:

   ```bash
   source .venv/bin/activate
   python -m unittest discover -s tests -v
   ```

El script crea un entorno virtual, instala únicamente las dependencias que usa
la aplicación e inicializa una base de datos vacía. No requiere secretos.

> **Importante:** ChatGPT/Codex Cloud es principalmente un entorno de terminal.
> La interfaz Kivy necesita un servidor gráfico. Para abrirla en un runner Linux
> con X virtual, usa `xvfb-run -a .venv/bin/python main_kivy.py`; en local basta
> con `.venv/bin/python main_kivy.py`.

## Datos y privacidad

La base SQLite y la hoja de cálculo personal están excluidas de Git. No subas
datos financieros reales ni archivos `.env` al repositorio. Por defecto la app
usa `data/finance_app.db`. Para cambiar la ubicación:

```bash
export FINANZAS_DATA_DIR=/ruta/privada/finanzas
```

Los discos de los entornos Cloud pueden ser efímeros. Descarga cualquier dato
que quieras conservar o configura un almacenamiento persistente externo.

## Desarrollo local

Requiere Python 3.10 o posterior y las librerías del sistema necesarias para
Kivy. Después ejecuta:

```bash
python -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
python main_kivy.py
```

Para Android se mantiene `buildozer.spec`; la compilación del APK requiere un
host Linux con el SDK/NDK de Android y Buildozer.
