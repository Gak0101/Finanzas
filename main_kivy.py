import kivy
from kivy.app import App
from kivy.uix.label import Label
# Importamos más widgets de Kivy que usaremos indirectamente desde .kv
from kivy.uix.boxlayout import BoxLayout 
from kivy.uix.gridlayout import GridLayout
from kivy.uix.scrollview import ScrollView
from kivy.uix.button import Button
from kivy.uix.textinput import TextInput
# Importar Popup
from kivy.uix.popup import Popup
# Importamos propiedades de Kivy para vincular datos
from kivy.properties import NumericProperty
# Importamos database
from database import create_tables, DB_PATH, get_all_categories, add_category, delete_category, update_category # Añadimos update_category
import sqlite3 # Para manejar IntegrityError si añadimos duplicados

kivy.require('2.3.0') # Especifica la versión mínima de Kivy

# Es buena práctica definir los widgets personalizados usados en .kv también en Python
class CategoryRow(BoxLayout):
    # Definimos una propiedad Kivy para almacenar el ID de la categoría
    # Esto permite que el .kv acceda a él con root.category_id
    category_id = NumericProperty(0) # Valor inicial por defecto
    pass

class FinanceApp(App):
    """La clase principal de la aplicación Kivy."""

    def build(self):
        """Este método construye la interfaz de usuario. 
           Kivy cargará automáticamente finance.kv y devolverá el widget raíz definido allí."""
        # Ya no necesitamos devolver un Label aquí porque .kv define el widget raíz
        # self.load_kv('finance.kv') # Kivy lo hace automáticamente
        # Inicialmente, podrías cargar las categorías aquí, pero es mejor hacerlo
        # después de que la UI esté construida (ej. en on_start)
        return super().build()
    
    def on_start(self):
        """Se llama después de que la UI esté construida."""
        print("App iniciada, cargando categorías...")
        self.load_categories()

    def load_categories(self):
        """Carga las categorías de la BD y las muestra en la lista."""
        print("Cargando categorías desde la BD...")
        category_list = self.root.ids.category_list_layout 
        category_list.clear_widgets()

        categories_data = get_all_categories()
        if not categories_data:
            print("No hay categorías en la BD.")
            # Podríamos mostrar un mensaje en la UI aquí, como un Label
            no_cat_label = Label(text="Aún no hay categorías", size_hint_y=None, height='30dp')
            category_list.add_widget(no_cat_label)
            return
        
        print(f"Encontradas {len(categories_data)} categorías. Construyendo widgets...")
        for category in categories_data:
            # Crear una instancia del widget definido en .kv
            # Pasamos los datos para que el widget los use
            # Nota: Kivy automáticamente intenta emparejar keys del dict con ids dentro del widget
            # pero es más explícito (y a veces necesario) hacerlo manualmente.
            row = CategoryRow() # Creamos la fila
            # Asignamos el ID de la base de datos a la propiedad Kivy de la fila
            row.category_id = category['id'] 
            row.ids.name_label.text = category['name']
            row.ids.percentage_label.text = f"{category['percentage']:.1f}%"
            row.ids.balance_label.text = f"€{category['current_balance']:.2f}"
            # Podríamos guardar el ID para futuras acciones (editar/borrar)
            # row.category_id = category['id'] 
            
            # Añadir la fila al GridLayout
            category_list.add_widget(row)
            print(f"  - Fila añadida para: {category['name']} (ID: {row.category_id})")
            
    def ui_add_category_kivy(self):
        """Se llama al pulsar el botón Añadir en la UI de Kivy."""
        name_input = self.root.ids.new_category_name
        percentage_input = self.root.ids.new_category_percentage
        
        name = name_input.text.strip()
        percentage_str = percentage_input.text.strip()
        
        print(f"Intentando añadir categoría: {name}, {percentage_str}%")
        
        if not name or not percentage_str:
            print("Error: Nombre y porcentaje no pueden estar vacíos.")
            # TODO: Mostrar feedback en la UI (e.g., Popup o Label)
            return
            
        try:
            percentage = float(percentage_str)
            if not (0 <= percentage <= 100):
                 raise ValueError("Porcentaje fuera de rango")
        except ValueError:
            print("Error: Porcentaje debe ser un número entre 0 y 100.")
            # TODO: Mostrar feedback en la UI
            return
            
        try:
            if add_category(name, percentage):
                print(f"Categoría '{name}' añadida con éxito.")
                # Limpiar inputs
                name_input.text = ""
                percentage_input.text = ""
                # Recargar la lista para mostrar la nueva categoría
                self.load_categories()
            else:
                # Esto no debería ocurrir si add_category devuelve bool o lanza error
                 print("Error desconocido al añadir categoría.")
                 # TODO: Mostrar feedback en la UI
        except sqlite3.IntegrityError:
            print(f"Error: La categoría '{name}' ya existe.")
            # TODO: Mostrar feedback en la UI
        except Exception as e:
            print(f"Error inesperado: {e}")
            # TODO: Mostrar feedback en la UI
            
    def delete_category(self, category_id):
        """Se llama al pulsar el botón 'X' (borrar) en una fila de categoría."""
        print(f"Intentando borrar categoría con ID: {category_id}")
        
        # --- ¡IMPORTANTE! Añadir confirmación --- 
        # TODO: Implementar un Popup de Kivy para preguntar "¿Estás seguro?"
        # Por ahora, borramos directamente para probar.
        
        try:
            if delete_category(category_id):
                print(f"Categoría ID {category_id} borrada con éxito.")
                # Recargar la lista para reflejar el cambio
                self.load_categories()
            else:
                print(f"Error: No se pudo borrar la categoría ID {category_id} (quizás no existía?).")
                # TODO: Mostrar feedback en la UI si es necesario
        except Exception as e:
            print(f"Error inesperado al borrar categoría ID {category_id}: {e}")
            # TODO: Mostrar feedback en la UI

    def show_edit_popup(self, category_id):
        """Muestra un Popup para editar la categoría especificada."""
        print(f"Mostrando popup para editar categoría ID: {category_id}")
        
        # 1. Obtener datos actuales de la categoría (¡Necesitamos una función en database.py!)
        # category_data = get_category_by_id(category_id) # Asumimos que existe
        # if not category_data:
        #     print(f"Error: No se encontró la categoría con ID {category_id}")
        #     return
            
        # --- Creación del contenido del Popup (Placeholder) ---
        # Esto será un Layout (e.g., BoxLayout) con Labels, TextInputs y Buttons
        popup_content = BoxLayout(orientation='vertical', padding=10, spacing=5)
        popup_content.add_widget(Label(text=f"Editando Categoría ID: {category_id}"))
        # TODO: Añadir TextInput para nombre (con valor actual)
        # TODO: Añadir TextInput para porcentaje (con valor actual)
        # TODO: Añadir botones Guardar y Cancelar
        # ------------------------------------------------------

        # --- Crear y abrir el Popup --- 
        popup = Popup(title="Editar Categoría",
                      content=popup_content,
                      size_hint=(0.8, 0.5)) # Tamaño relativo a la ventana principal
        popup.open()
        # ----------------------------- 
        
        # TODO: Implementar lógica de Guardar y Cancelar

if __name__ == '__main__':
    # Crea e inicializa la base de datos si es necesario (igual que antes)
    from database import create_tables
    create_tables() 
    print("Base de datos Kivy inicializada (si era necesario).") 

    FinanceApp().run() # Inicia la aplicación Kivy
