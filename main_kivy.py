import kivy
from kivy.app import App
from kivy.uix.boxlayout import BoxLayout
from kivy.uix.label import Label
from kivy.uix.gridlayout import GridLayout
from kivy.uix.scrollview import ScrollView
from kivy.uix.button import Button
from kivy.uix.textinput import TextInput
from kivy.uix.popup import Popup
from kivy.properties import NumericProperty
# Necesitamos Builder para cargar el .kv explícitamente
from kivy.lang import Builder
import os # Para construir la ruta al .kv

# Ajustamos la importación ahora que database.py está en src/
from src.database import ( 
    create_tables, 
    get_all_categories, 
    add_category, 
    delete_category, 
    update_category, 
    get_category_by_id, 
    distribute_income # Añadimos distribute_income si aún no estaba
)
import sqlite3 # Para manejar IntegrityError si añadimos duplicados

kivy.require('2.3.0') # Especifica la versión mínima de Kivy

# Cargamos el archivo .kv explícitamente ahora que está en otra carpeta
kv_file_path = os.path.join(os.path.dirname(__file__), 'src', 'ui', 'finance.kv')
Builder.load_file(kv_file_path)

# --- Widgets Personalizados ---
# Es buena práctica definir los widgets personalizados usados en .kv también en Python
# Clase para el widget raíz definido en KV
class FinanceRootWidget(BoxLayout):
    pass

class CategoryRow(BoxLayout):
    category_id = NumericProperty(0) 
    pass

# --- Clase Principal de la App ---
class FinanceApp(App):
    def build(self): 
        """Construye y devuelve el widget raíz de la aplicación."""
        # Creamos una instancia de nuestro widget raíz.
        # Kivy aplicará automáticamente las reglas de <FinanceRootWidget> del .kv cargado.
        print("Construyendo el widget raíz...")
        root_widget = FinanceRootWidget()
        print("Widget raíz construido. Devolviendo...")
        return root_widget # ¡Importante devolver la instancia!

    def on_start(self):
        """Se llama después de que build() ha terminado y la UI está lista."""
        print("App iniciada, cargando categorías...")
        self.load_categories()
        
    # --- Métodos de Interacción con la UI y la Lógica --- 
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

        # 2. Obtener datos actuales de la categoría
        try:
            category_data = get_category_by_id(category_id)
            if not category_data:
                print(f"Error: No se encontró la categoría con ID {category_id}")
                # TODO: Mostrar error en popup o label
                return
        except Exception as e:
            print(f"Error al obtener datos para editar categoría ID {category_id}: {e}")
            return

        # 3. Crear contenido del Popup
        content_layout = BoxLayout(orientation='vertical', padding=10, spacing=5)
        
        # Guardamos referencias a los inputs para leerlos después
        name_input = TextInput(text=category_data['name'], hint_text="Nombre categoría")
        percentage_input = TextInput(text=str(category_data['percentage']), hint_text="Porcentaje (%)", input_filter='float')
        
        content_layout.add_widget(Label(text="Nombre:"))
        content_layout.add_widget(name_input)
        content_layout.add_widget(Label(text="Porcentaje (%):"))
        content_layout.add_widget(percentage_input)

        # Botones dentro del Popup
        button_layout = BoxLayout(size_hint_y=None, height='50dp', spacing=5)
        save_button = Button(text="Guardar Cambios")
        cancel_button = Button(text="Cancelar")
        button_layout.add_widget(save_button)
        button_layout.add_widget(cancel_button)
        
        content_layout.add_widget(button_layout)

        # --- Crear y abrir el Popup --- 
        popup = Popup(title="Editar Categoría",
                      content=content_layout, # Usamos el layout que creamos
                      size_hint=(0.8, 0.6), # Ajustamos tamaño si es necesario
                      auto_dismiss=False) # Evita que se cierre al tocar fuera

        # --- Acciones de los botones del Popup ---
        def save_action(instance):
            print("Botón Guardar presionado")
            new_name = name_input.text.strip()
            new_percentage_str = percentage_input.text.strip()
            
            # Validación simple
            if not new_name:
                print("Error: El nombre no puede estar vacío.")
                # TODO: Mostrar feedback en el popup
                return
            try:
                new_percentage = float(new_percentage_str)
                if not (0 <= new_percentage <= 100):
                    raise ValueError("El porcentaje debe estar entre 0 y 100.")
            except ValueError as e:
                print(f"Error: Porcentaje inválido - {e}")
                 # TODO: Mostrar feedback en el popup
                return
                
            # Llamar a la función de actualización de la BD
            if update_category(category_id, new_name, new_percentage):
                print("Actualización exitosa en BD.")
                self.load_categories() # Recargar la lista principal
                popup.dismiss() # Cerrar el popup
            else:
                print("Error al guardar en BD (ver logs de database.py).")
                 # TODO: Mostrar feedback en el popup, no cerrar?

        def cancel_action(instance):
            print("Botón Cancelar presionado")
            popup.dismiss()
            
        save_button.bind(on_press=save_action)
        cancel_button.bind(on_press=cancel_action)
        # ---------------------------------------

        popup.open()

    def ui_distribute_income_kivy(self):
        """Se llama al pulsar el botón 'Distribuir Ingreso'"""
        print("\n--- Intentando distribuir ingreso --- ")
        income_input = self.root.ids.income_input 
        try:
            total_income = float(income_input.text.strip())
            if total_income <= 0:
                 print("Error: El ingreso debe ser un número positivo.")
                 # TODO: Mostrar feedback en la UI
                 return
                 
            print(f"Distribuyendo {total_income:.2f}€...")
            if distribute_income(total_income):
                print("Distribución completada. Recargando categorías...")
                self.load_categories() # Recargar para ver nuevos balances
                # Limpiar input?
                # income_input.text = ""
            else:
                print("La distribución falló (ver logs de database.py). อาจจะไม่มีหมวดหมู่ที่มีเปอร์เซ็นต์")
                 # TODO: Mostrar feedback en la UI

        except ValueError:
            print("Error: Ingreso inválido. Introduce un número.")
            # TODO: Mostrar feedback en la UI
        except Exception as e:
            print(f"Error inesperado al distribuir: {e}")
            # TODO: Mostrar feedback en la UI

if __name__ == '__main__':
    # Ya no necesitamos llamar a create_tables() aquí si se llama
    # automáticamente al conectar (aunque no hace daño llamarlo)
    print("Verificando/Creando tablas si es necesario...")
    create_tables() # Asegura que las tablas existen antes de iniciar la app
    
    FinanceApp().run()
