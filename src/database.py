import sqlite3
import os

DATABASE_NAME = "finance_app.db"
# Ajustamos la ruta: subir un nivel (..) desde la ubicación de este script (src/) y entrar a data/
DB_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'data', DATABASE_NAME))

def get_db_connection():
    """Crea o conecta con la base de datos SQLite."""
    conn = sqlite3.connect(DB_PATH)
    # Para devolver filas como diccionarios (más fácil de usar)
    conn.row_factory = sqlite3.Row 
    return conn

def create_tables():
    """Crea las tablas Categories y Transactions si no existen."""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        # --- Tabla Categories ---
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS Categories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                percentage REAL NOT NULL DEFAULT 0, 
                current_balance REAL NOT NULL DEFAULT 0
            )
        ''')
        print("Tabla 'Categories' comprobada/creada. ")

        # --- Tabla Transactions ---
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS Transactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                type TEXT NOT NULL CHECK(type IN ('Income', 'Expense', 'Allocation')),
                description TEXT,
                amount REAL NOT NULL,
                date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                category_id INTEGER, 
                FOREIGN KEY (category_id) REFERENCES Categories (id) 
                    ON DELETE SET NULL -- Si se borra categoría, la transacción queda sin categoría
            )
        ''')
        print("Tabla 'Transactions' comprobada/creada. ")

        conn.commit()
        print("Base de datos inicializada correctamente! ")

    except sqlite3.Error as e:
        print(f" Error al crear las tablas: {e}")
    finally:
        conn.close()

# --- Funciones CRUD para Categorías ---

def get_all_categories() -> list[dict]:
    """Obtiene todas las categorías de la base de datos, incluyendo su balance actual."""
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        # Asegurarse de que la columna se llama 'current_balance'
        cursor.execute("SELECT id, name, percentage, current_balance FROM Categories ORDER BY name") # Añadido current_balance y orden
        categories = [{'id': row[0], 'name': row[1], 'percentage': row[2], 'current_balance': row[3]}
                      for row in cursor.fetchall()]
        return categories
    except sqlite3.Error as e:
        print(f"❌ Error al obtener categorías: {e}")
        return []
    finally:
        conn.close()

def add_category(name: str, percentage: float) -> bool:
    """Añade una nueva categoría a la base de datos."""
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("INSERT INTO Categories (name, percentage) VALUES (?, ?)", (name, percentage))
        conn.commit()
        print(f"Categoría '{name}' añadida con éxito. ")
        return True
    except sqlite3.IntegrityError: # Captura el error si el nombre ya existe (UNIQUE constraint)
        print(f" Error: La categoría '{name}' ya existe.")
        return False
    except sqlite3.Error as e:
        print(f" Error al añadir categoría: {e}")
        return False
    finally:
        conn.close()

def update_category(category_id: int, new_name: str, new_percentage: float):
    """Actualiza el nombre y porcentaje de una categoría existente."""
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("UPDATE Categories SET name = ?, percentage = ? WHERE id = ?", 
                       (new_name, new_percentage, category_id))
        conn.commit()
        if cursor.rowcount == 0:
            print(f" Error al actualizar: No se encontró la categoría con ID {category_id}.")
            return False
        else:
            print(f"Categoría ID {category_id} actualizada a '{new_name}' ({new_percentage}%) ")
            return True
    except sqlite3.IntegrityError: # Captura el error si el nuevo nombre ya existe (UNIQUE constraint)
        print(f" Error: Ya existe otra categoría con el nombre '{new_name}'.")
        return False
    except sqlite3.Error as e:
        print(f" Error al actualizar categoría ID {category_id}: {e}")
        return False
    finally:
        conn.close()

def delete_category(category_id: int):
    """Elimina una categoría de la base de datos."""
    # Podríamos añadir lógica para reasignar transacciones, pero por ahora las dejamos huérfanas (FOREIGN KEY ON DELETE SET NULL)
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("DELETE FROM Categories WHERE id = ?", (category_id,))
        conn.commit()
        if cursor.rowcount == 0:
            print(f"⚠️ Error al eliminar: No se encontró la categoría con ID {category_id}.")
            return False
        else:
            print(f"Categoría ID {category_id} eliminada con éxito. ✅")
            # Considerar eliminar/reasignar transacciones asociadas aquí si la lógica cambia
            return True
    except sqlite3.Error as e:
        print(f"❌ Error al eliminar categoría ID {category_id}: {e}")
        return False
    finally:
        conn.close()

def get_category_by_id(category_id: int):
    """Obtiene los datos de una categoría por su ID."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, name, percentage FROM Categories WHERE id = ?", (category_id,))
    category = cursor.fetchone() # fetchone devuelve una tupla o None
    conn.close()
    if category:
        # Convertimos la tupla a un diccionario para facilitar el acceso
        return {'id': category[0], 'name': category[1], 'percentage': category[2]}
    else:
        return None # O podrías lanzar una excepción

# --- Funciones para Transacciones (Placeholder) ---
# TODO: Añadir funciones para registrar, ver, editar, eliminar transacciones

# --- Funciones de Lógica Financiera ---
def distribute_income(total_income: float) -> bool:
    """Distribuye un ingreso total entre las categorías según sus porcentajes."""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    if total_income <= 0:
        print("El ingreso a distribuir debe ser positivo.")
        return False
        
    try:
        # Iniciar transacción
        cursor.execute("BEGIN TRANSACTION")
        
        # --- Reset all balances to 0 before distributing --- 
        cursor.execute("UPDATE Categories SET current_balance = 0")
        print("  -> Balances reseteados a 0.")
        
        # 1. Obtener todas las categorías con porcentaje > 0
        cursor.execute("SELECT id, percentage FROM Categories WHERE percentage > 0")
        categories_to_update = cursor.fetchall()
        
        if not categories_to_update:
            print("⚠️ No hay categorías con porcentaje asignado para distribuir el ingreso.")
            conn.rollback() # Cancelar transacción
            return False
            
        total_percentage = sum(row['percentage'] for row in categories_to_update)
        # Opcional: Validar si la suma es ~100% ? Por ahora, distribuimos proporcionalmente.
        # if not (99.9 < total_percentage < 100.1):
        #    print(f"Advertencia: La suma de porcentajes ({total_percentage}%) no es 100%.")
            
        # 2. Calcular y actualizar el saldo de cada categoría
        distributed_sum = 0
        updates = []
        for category_row in categories_to_update:
            category_id = category_row['id']
            percentage = category_row['percentage']
            
            # Calcula la porción para esta categoría
            # Usamos total_percentage por si no suman exactamente 100, para distribuir todo el ingreso proporcionalmente
            amount_to_add = (total_income * percentage / 100) 
            distributed_sum += amount_to_add
            updates.append((amount_to_add, category_id))

        # 3. Ejecutar las actualizaciones (OVERWRITE balance, don't add)
        cursor.executemany("UPDATE Categories SET current_balance = ? WHERE id = ?", updates)
        
        # Opcional: Manejar redondeo/sobrante. 
        # Podría ir a una categoría específica o registrarse aparte.
        remainder = total_income - distributed_sum
        if abs(remainder) > 0.001: # Pequeño umbral para errores de punto flotante
             print(f"💰 Se distribuyó {distributed_sum:.2f}€. Quedó un remanente de {remainder:.2f}€ (posiblemente por redondeo). Considera ajustar porcentajes.")
             # Aquí podríamos añadir el remanente a una categoría específica, ej. Ahorro
             # cursor.execute("UPDATE Categories SET current_balance = current_balance + ? WHERE name = ?", (remainder, 'Ahorro'))

        # Confirmar transacción
        conn.commit()
        print(f"✅ Ingreso de {total_income:.2f}€ distribuido correctamente.")
        return True

    except sqlite3.Error as e:
        print(f"❌ Error al distribuir ingreso: {e}")
        conn.rollback() # Revertir cambios si hay error
        return False
    finally:
        conn.close()


if __name__ == '__main__':
    # Esto se ejecuta solo si corres database.py directamente
    # Útil para inicializar/resetear la BD manualmente si es necesario
    print("Inicializando la base de datos...")
    create_tables()
    print("Proceso de inicialización terminado.")
