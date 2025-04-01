# Resumen del Proyecto: Finanzas Personales Kivy 💰📱

Este documento resume el progreso del desarrollo de la aplicación de finanzas personales, migrando desde `customtkinter` a Kivy para compatibilidad con Android.

## 🎯 Objetivo Principal

*   Adaptar la aplicación existente a Kivy.
*   Permitir su funcionamiento en dispositivos Android (futuro empaquetado APK).

## 🏗️ Estructura del Proyecto Actual

*   **`main_kivy.py`**: Punto de entrada de la aplicación Kivy, contiene la lógica principal de la app y la definición de clases como `FinanceApp` y `CategoryRow`.
*   **`finance.kv`**: Archivo de diseño Kivy que define la estructura visual de la interfaz (layouts, botones, inputs).
*   **`database.py`**: Módulo para gestionar toda la interacción con la base de datos SQLite (crear tablas, añadir, obtener, actualizar, borrar categorías).
*   **`database.db`**: El archivo de la base de datos SQLite.
*   **`.venv/`**: Directorio del entorno virtual con las dependencias.
*   **`requirements.txt`**: Lista las dependencias Python (como Kivy).

## ✨ Funcionalidades Implementadas (Kivy)

*   **Interfaz Base:**
    *   Layout principal vertical (`BoxLayout`).
    *   Área superior para futuros gráficos (placeholder).
    *   Lista desplazable (`ScrollView` + `GridLayout`) para mostrar categorías.
    *   Widget reutilizable `CategoryRow` para mostrar cada categoría con sus botones.
    *   Inputs y botón para añadir nuevas categorías.
    *   Input y botón para distribuir ingresos (aún no funcional).
*   **Gestión de Categorías:**
    *   ✅ **Carga y Muestra:** Las categorías se leen de `database.db` al iniciar y se muestran en la lista usando `CategoryRow`.
    *   ✅ **Añadir:** Se pueden añadir nuevas categorías (nombre y porcentaje) a través de la interfaz. La app valida si el porcentaje es un número válido.
    *   ✅ **Borrar:** El botón 'X' en cada fila elimina la categoría correspondiente de la base de datos y actualiza la lista.
*   **Base de Datos:**
    *   Inicialización automática de tablas (`Categories`, `Transactions`) si no existen.
    *   Funciones implementadas en `database.py`: `create_tables`, `get_db_connection`, `add_category`, `get_all_categories`, `delete_category`, `update_category`, `get_category_by_id`.

## 🛠️ En Progreso

*   **Editar Categorías:**
    *   Se ha conectado el botón "Edit".
    *   Se muestra un `Popup` básico al pulsar "Edit".
    *   Se ha añadido la función `get_category_by_id` a `database.py`.
    *   *Siguiente paso:* Completar el `Popup` con `TextInput`s y botones "Guardar"/"Cancelar" y la lógica asociada.

## 🚀 Próximos Pasos

1.  **Finalizar Edición:** Implementar la lógica completa de guardado en el Popup de edición.
2.  **Implementar Distribución:** Conectar el botón "Distribuir Ingreso" a una función que actualice los balances en la base de datos según los porcentajes.
3.  **Integrar Gráficos:** Utilizar Kivy Garden Matplotlib (u otra librería) para mostrar un gráfico (ej. tarta) con la distribución de categorías.
4.  **Añadir Confirmaciones:** Mejorar la UX añadiendo popups de confirmación para acciones destructivas (como borrar).
5.  **Gestión de Transacciones:** (Futuro) Añadir funcionalidad para registrar y ver transacciones.
6.  **Empaquetado Android:** Configurar `Buildozer` para generar el archivo APK.

## 📦 Organización Desktop vs. Android

La estructura actual del proyecto **ya es adecuada** tanto para ejecutar en escritorio como para ser empaquetada para Android. ¡No necesitas carpetas separadas!

*   **Desktop:** Simplemente ejecutas `python main_kivy.py` desde tu entorno virtual activado.
*   **Android:** Más adelante, usaremos una herramienta llamada **Buildozer**.
    *   Crearemos un archivo `buildozer.spec` en la raíz del proyecto.
    *   Este archivo le dice a Buildozer qué necesita tu app (Python, Kivy, otras librerías de `requirements.txt`), qué icono usar, permisos necesarios, etc.
    *   Buildozer se encargará de compilar todo en un APK que podrás instalar en un dispositivo Android.

¡No te preocupes por la estructura ahora, está bien montada para ambos mundos! 🌍➡️📱
