#!/usr/bin/env bash
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

python -m venv .venv
.venv/bin/python -m pip install --upgrade pip
.venv/bin/python -m pip install -r requirements.txt

# Inicializa una base vacía; los datos personales nunca se suben al repositorio.
export FINANZAS_DATA_DIR="${FINANZAS_DATA_DIR:-/tmp/finanzas-data}"
.venv/bin/python -c "from src.database import create_tables; create_tables()"

echo "Entorno listo. Activa el virtualenv con: source .venv/bin/activate"
