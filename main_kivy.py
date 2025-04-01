import kivy
from kivy.app import App
from kivy.uix.boxlayout import BoxLayout 
from kivy.uix.widget import Widget
from kivy.uix.label import Label
from kivy.uix.popup import Popup
from kivy.uix.textinput import TextInput 
from kivy.uix.gridlayout import GridLayout
from kivy.uix.scrollview import ScrollView
from kivy.uix.button import Button
from kivy.properties import NumericProperty
# Necesitamos Builder para cargar el .kv explícitamente
from kivy.lang import Builder
import os # Para construir la ruta al .kv
# Importamos el widget del gráfico
from kivy_garden.matplotlib.backend_kivyagg import FigureCanvasKivyAgg
import matplotlib.pyplot as plt
from kivy.clock import Clock
import logging

# Ajustamos la importación ahora que database.py está en src/
from src.database import * # O lista explícitamente las funciones que usas
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
    """Clase principal de la aplicación Kivy."""
    # Creamos la figura de Matplotlib aquí, una sola vez.
    fig = plt.figure()
    graph_widget = None # Para guardar la referencia al widget del gráfico creado dinámicamente
    logger = logging.getLogger('FinanceApp') # Usamos un logger específico para la app
    logger.setLevel(logging.INFO) # Captura desde nivel INFO hacia arriba

    # Handler personalizado para Kivy
    class KivyLogHandler(logging.Handler):
        def __init__(self, app, log_widget_id, scroll_view_id, **kwargs):
            super().__init__(**kwargs)
            self.app = app  # Guardamos referencia a la app
            self.log_widget_id = log_widget_id
            self.scroll_view_id = scroll_view_id
            # Mapeo de niveles de log a colores hexadecimales Kivy
            self.level_colors = {
                logging.DEBUG: '#FFFFFF',    # Blanco para Debug (si lo usas)
                logging.INFO: '#33FF33',     # Verde neón para Info
                logging.WARNING: '#FFBF00', # Amarillo ámbar para Warning
                logging.ERROR: '#FF3333',   # Rojo carmesí para Error
                logging.CRITICAL: '#FF0000' # Rojo brillante para Critical
            }
            # Formateador para incluir timestamp
            self.setFormatter(logging.Formatter('%(asctime)s', datefmt='%H:%M:%S'))

        def emit(self, record):
            # Solo intentamos actualizar si los IDs están presentes
            if hasattr(self.app.root, 'ids') and self.log_widget_id in self.app.root.ids and self.scroll_view_id in self.app.root.ids:
                log_output_label = self.app.root.ids[self.log_widget_id]
                scroll_view = self.app.root.ids[self.scroll_view_id]
                # Ahora obtenemos el mensaje formateado del logger
                log_entry = self.format(record)
                message = record.getMessage()
                # Obtenemos el color basado en el nivel del log
                log_level_color = self.level_colors.get(record.levelno, '#FFFFFF') # Blanco por defecto
                # Construimos el mensaje con markup de Kivy
                formatted_message = f"[color={log_level_color}]{log_entry} - {message}[/color]\n"
                log_output_label.text += formatted_message
                # Auto-scroll al final
                scroll_view.scroll_y = 0

    def build(self): 
        """Construye y devuelve el widget raíz de la aplicación."""
        # Creamos una instancia de nuestro widget raíz.
        # Kivy aplicará automáticamente las reglas de <FinanceRootWidget> del .kv cargado.
        self.logger.info("Construyendo el widget raíz...")
        root_widget = FinanceRootWidget()
        self.logger.info("Widget raíz construido. Devolviendo...")
        return root_widget # ¡Importante devolver la instancia!

    def on_start(self):
        """Se llama después de que build() ha terminado y la UI está lista."""
        self.logger.info("App iniciada, preparando gráfico y cargando categorías...")

        # --- Crear y añadir el gráfico dinámicamente ---
        try:
            placeholder = self.root.ids.graph_placeholder
            # Creamos el widget de Kivy para Matplotlib CON nuestra figura
            self.graph_widget = FigureCanvasKivyAgg(figure=self.fig)
            # Lo añadimos al BoxLayout que dejamos como placeholder en el KV
            placeholder.add_widget(self.graph_widget)
            self.logger.info("Widget de gráfico añadido al placeholder.")
        except Exception as e:
            self.logger.error(f"Error al añadir dinámicamente el widget del gráfico: {e}")
            # Puedes decidir si la app debe continuar sin gráfico o parar

        self.load_categories()
        self.update_graph()
        self._setup_logging()
        
    # --- Métodos de Interacción con la UI y la Lógica --- 
    def load_categories(self):
        """Carga las categorías de la BD y las muestra en la lista."""
        self.logger.info("Cargando categorías desde la BD...")
        category_list = self.root.ids.category_list_layout 
        category_list.clear_widgets()

        categories_data = get_all_categories()
        if not categories_data:
            self.logger.info("No hay categorías en la BD.")
            # Podríamos mostrar un mensaje en la UI aquí, como un Label
            no_cat_label = Label(text="Aún no hay categorías", size_hint_y=None, height='30dp')
            category_list.add_widget(no_cat_label)
            return
        
        self.logger.info(f"Encontradas {len(categories_data)} categorías. Construyendo widgets...")
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
            self.logger.info(f"  - Fila añadida para: {category['name']} (ID: {row.category_id})")
            
        self.logger.info(f"Carga de categorías completada.")
        # Actualizamos el gráfico después de cargar/recargar categorías
        # self.update_graph()
            
    def show_add_category_popup(self):
        """Muestra un Popup para añadir una nueva categoría."""
        self.logger.info("Mostrando popup para añadir categoría...")
        
        # --- Contenido del Popup ---
        content = BoxLayout(orientation='vertical', padding=10, spacing=10)
        grid = GridLayout(cols=2, spacing=10, size_hint_y=None, height='80dp')
 
        grid.add_widget(Label(text='Nombre:'))
        name_input = TextInput(multiline=False)
        grid.add_widget(name_input)
 
        grid.add_widget(Label(text='Porcentaje (%):'))
        percentage_input = TextInput(multiline=False, input_filter='float')
        grid.add_widget(percentage_input)
 
        content.add_widget(grid)
 
        # Label para mostrar mensajes de error dentro del popup
        error_label = Label(text='', color=(1, 0, 0, 1), size_hint_y=None, height='30dp') 
        content.add_widget(error_label)
        
        # --- Botones del Popup ---
        button_layout = BoxLayout(size_hint_y=None, height='50dp', spacing=10)
        save_button = Button(text='Guardar')
 
        # --- Acciones de los botones del Popup --- 
        def save_action(instance, error_widget):
            error_widget.text = '' # Limpiar errores previos al intentar guardar
            name = name_input.text.strip()
            percentage_str = percentage_input.text.strip().replace(',', '.') # Reemplazar coma por punto
            self.logger.info(f"Intentando guardar nueva categoría: {name}, {percentage_str}%")
 
            if not name or not percentage_str:
                self.logger.error("Error: Nombre y porcentaje no pueden estar vacíos.")
                error_widget.text = "Nombre y porcentaje no pueden estar vacíos."
                return
                
            try:
                percentage = float(percentage_str)
                if not (0 <= percentage <= 100):
                    raise ValueError("Porcentaje fuera de rango")
            except ValueError as e:
                self.logger.error(f"Error de valor: {e}")
                error_widget.text = "Porcentaje debe ser un número válido entre 0 y 100."
                return
                
            # --- Validación del 100% --- 
            try:
                current_categories = get_all_categories()
                current_total_percentage = sum(float(cat['percentage']) for cat in current_categories)
                self.logger.info(f"Porcentaje total actual: {current_total_percentage:.2f}%")
                
                if current_total_percentage + percentage > 100.001: # Pequeño margen para errores de flotantes
                    error_msg = f"Error: Supera el 100% (actual: {current_total_percentage:.2f}%)"
                    self.logger.error(error_msg)
                    error_widget.text = error_msg
                    return
            except Exception as e:
                self.logger.error(f"Error al obtener categorías para validación: {e}")
                error_widget.text = "Error al validar porcentajes."
                return # No continuar si no podemos validar
            # --- Fin Validación --- 
 
            try:
                if add_category(name, percentage):
                    self.logger.info(f"Categoría '{name}' añadida con éxito desde Popup.")
                    self.load_categories() # Recargar la lista
                    self.update_graph() # Actualizar el gráfico
                    popup.dismiss() # Cerrar el popup
                else:
                    self.logger.error("Error desconocido al añadir categoría desde Popup.")
                    error_widget.text = "Error desconocido al guardar."
            except sqlite3.IntegrityError:
                error_msg = f"Error: La categoría '{name}' ya existe."
                self.logger.error(error_msg)
                error_widget.text = error_msg
            except Exception as e:
                self.logger.error(f"Error inesperado al guardar desde Popup: {e}")
                error_widget.text = "Error inesperado al guardar."
                
        def cancel_action(instance, error_widget):
            error_widget.text = '' # Limpiar también al cancelar
            self.logger.info("Popup de añadir categoría cancelado.")
            popup.dismiss()
 
        save_button.bind(on_press=lambda instance: save_action(instance, error_label))
        button_layout.add_widget(save_button)
 
        cancel_button = Button(text='Cancelar')
        cancel_button.bind(on_press=lambda instance: cancel_action(instance, error_label))
        button_layout.add_widget(cancel_button)
 
        content.add_widget(button_layout)
        
        # --- Crear y abrir el Popup --- 
        popup = Popup(title='Añadir Categoría',
                      content=content, # Usamos el layout que creamos
                      size_hint=(0.8, 0.6), # Ajustamos tamaño si es necesario
                      auto_dismiss=False) # Evita que se cierre al tocar fuera

        popup.open()

    def show_edit_popup(self, category_id):
        """Muestra un Popup para editar la categoría especificada."""
        self.logger.info(f"Mostrando popup para editar categoría ID: {category_id}")
        
        # 1. Obtener datos actuales de la categoría (¡Necesitamos una función en database.py!)
        # category_data = get_category_by_id(category_id) # Asumimos que existe
        # if not category_data:
        #     self.logger.error(f"Error: No se encontró la categoría con ID {category_id}")
        #     return
            
        # --- Creación del contenido del Popup (Placeholder) ---
        # Esto será un Layout (e.g., BoxLayout) con Labels, TextInputs y Buttons
        popup_content = BoxLayout(orientation='vertical', padding=10, spacing=5)
        popup_content.add_widget(Label(text=f"Editando Categoría ID: {category_id}"))

        # 2. Obtener datos actuales de la categoría
        try:
            category_data = get_category_by_id(category_id)
            if not category_data:
                self.logger.error(f"Error: No se encontró la categoría con ID {category_id}")
                # TODO: Mostrar error en popup o label
                return
        except Exception as e:
            self.logger.error(f"Error al obtener datos para editar categoría ID {category_id}: {e}")
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

        # Label para mostrar mensajes de error dentro del popup
        error_label = Label(text='', color=(1, 0, 0, 1), size_hint_y=None, height='30dp') 
        content_layout.add_widget(error_label)

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
        def save_action(instance, error_widget):
            error_widget.text = '' # Limpiar errores previos
            new_name = name_input.text.strip()
            new_percentage_str = percentage_input.text.strip().replace(',', '.') # Reemplazar coma
            
            # Validación simple
            if not new_name or not new_percentage_str:
                self.logger.error("Error: El nombre y porcentaje no pueden estar vacíos.")
                error_widget.text = "Nombre y porcentaje no pueden estar vacíos."
                return
            try:
                new_percentage = float(new_percentage_str)
                if not (0 <= new_percentage <= 100):
                    raise ValueError("El porcentaje debe estar entre 0 y 100.")
            except ValueError as ve:
                self.logger.error(f"Error de valor: {ve}")
                error_widget.text = "Porcentaje debe ser numérico (0-100)."
                return # Salir si el porcentaje no es válido
                
            # --- Validación del 100% --- 
            try:
                current_categories = get_all_categories()
                # Sumar porcentajes EXCEPTO el de la categoría actual
                current_total_excluding_this = sum(float(cat['percentage']) for cat in current_categories if cat['id'] != category_id)
                self.logger.info(f"Porcentaje total actual (sin ID {category_id}): {current_total_excluding_this:.2f}%")
                
                if current_total_excluding_this + new_percentage > 100.001:
                    error_msg = f"Error: Supera 100% (actual sin esta: {current_total_excluding_this:.2f}%)"
                    self.logger.error(error_msg)
                    error_widget.text = error_msg
                    return
            except Exception as e:
                self.logger.error(f"Error al obtener categorías para validación del 100%: {e}")
                error_widget.text = "Error al validar porcentajes."
                return # No continuar si no podemos validar
            # --- Fin Validación ---
            
            # Si la validación pasa, intentamos actualizar la BD
            try:
                if update_category(category_id, new_name, new_percentage):
                    self.logger.info("Actualización exitosa en BD.")
                    self.load_categories() # Recargar la lista principal
                    self.update_graph() # Actualizar el gráfico
                    popup.dismiss() # Cerrar el popup
                else:
                    self.logger.error("Error al guardar en BD (ver logs de database.py).")
                    error_widget.text = "Error al guardar en BD."
            except sqlite3.IntegrityError:
                error_msg = f"Error: Ya existe una categoría con el nombre '{new_name}'."
                self.logger.error(error_msg)
                error_widget.text = error_msg
            except Exception as e:
                self.logger.error(f"Error al guardar cambios: {e}")
                error_widget.text = "Error inesperado al guardar."

        def cancel_action(instance, error_widget):
            error_widget.text = '' # Limpiar también al cancelar
            self.logger.info("Edición cancelada.")
            popup.dismiss()
            
        save_button.bind(on_press=lambda instance: save_action(instance, error_label))
        cancel_button.bind(on_press=lambda instance: cancel_action(instance, error_label))
        # ---------------------------------------

        popup.open()

    def ui_distribute_income_kivy(self):
        """Se llama al pulsar el botón 'Distribuir Ingreso'"""
        self.logger.info("\n--- Intentando distribuir ingreso --- ")
        income_input = self.root.ids.income_input 
        try:
            total_income = float(income_input.text.strip())
            if total_income <= 0:
                 self.logger.warning("Error: El ingreso debe ser un número positivo.")
                 # TODO: Mostrar feedback en la UI
                 return
            
            self.logger.info(f"Distribuyendo {total_income:.2f}€...")
            if distribute_income(total_income):
                self.logger.info("Distribución completada. Recargando categorías...")
                self.load_categories() # Recargar para ver nuevos balances
                self.update_graph() # Actualiza el gráfico
                # Limpiar input?
                # income_input.text = ""
            else:
                self.logger.error("La distribución falló (ver logs de database.py). อาจจะไม่มีหมวดหมู่ที่มีเปอร์เซ็นต์")
                 # TODO: Mostrar feedback en la UI

        except ValueError:
            self.logger.error("Error: Ingreso inválido. Introduce un número.")
            # TODO: Mostrar feedback en la UI
        except Exception as e:
            self.logger.error(f"Error inesperado al distribuir: {e}")
            # TODO: Mostrar feedback en la UI

    def update_graph(self):
        """Actualiza el gráfico de Matplotlib con los datos actuales."""
        # Asegurarnos que el widget del gráfico se creó correctamente en on_start
        if not self.graph_widget:
            self.logger.error("Error: El widget del gráfico (self.graph_widget) no está inicializado.")
            return

        self.logger.info("Actualizando gráfico...")
        try:
            # Limpiamos la figura (self.fig), no el widget
            self.fig.clf()

            categories = get_all_categories()
            if not categories:
                self.logger.info("No hay categorías para graficar.")
                # Podríamos mostrar un mensaje en el gráfico o dejarlo vacío
                ax = self.fig.add_subplot(111)
                ax.text(0.5, 0.5, 'Sin datos', ha='center', va='center') # Usar ha y va
                self.graph_widget.draw() # Llamamos draw sobre el widget guardado
                return

            # Preparamos datos para el gráfico (ej: gráfico de pastel de balances)
            labels = [c['name'] for c in categories]
            # Asegúrate que 'current_balance' existe en los datos de get_all_categories
            sizes = [c.get('current_balance', 0) for c in categories] # Usar .get con default 0
            # Filtrar categorías con balance > 0 para que el gráfico sea más limpio?
            positive_labels = [labels[i] for i, size in enumerate(sizes) if size > 0]
            positive_sizes = [size for size in sizes if size > 0]

            if not positive_sizes:
                 self.logger.warning("No hay balances positivos para graficar.")
                 ax = self.fig.add_subplot(111)
                 ax.text(0.5, 0.5, 'Sin balances > 0', ha='center', va='center')
                 self.graph_widget.draw() # Llamamos draw sobre el widget guardado
                 return

            # Creamos el gráfico de pastel en la figura (self.fig)
            ax = self.fig.add_subplot(111)
            ax.pie(positive_sizes, labels=positive_labels, autopct='%1.1f%%', startangle=90)
            ax.axis('equal')  # Asegura que el pastel sea un círculo.
            self.fig.tight_layout() # Ajusta para que no se corten las etiquetas

            # Redibujamos el widget Kivy que contiene la figura
            self.graph_widget.draw() # Llamamos draw sobre el widget guardado
            self.logger.info("Gráfico actualizado.")

        except Exception as e:
            # Captura más genérica para depuración
            self.logger.error(f"Error inesperado al actualizar el gráfico: {e}")
            import traceback
            traceback.print_exc() # Imprime el traceback completo

    def delete_category(self, category_id):
        """Se llama al pulsar el botón 'X' (borrar) en una fila de categoría."""
        self.logger.info(f"Intentando borrar categoría con ID: {category_id}")
        
        # --- ¡IMPORTANTE! Añadir confirmación --- 
        # TODO: Implementar un Popup de Kivy para preguntar "¿Estás seguro?"
        # Por ahora, borramos directamente para probar.
        
        try:
            if delete_category(category_id):
                self.logger.info(f"Categoría ID {category_id} borrada con éxito.")
                # Recargar la lista para reflejar el cambio
                self.load_categories()
                self.update_graph() # Actualiza el gráfico
            else:
                self.logger.error(f"Error: No se pudo borrar la categoría ID {category_id} (quizás no existía?).")
                # TODO: Mostrar feedback en la UI si es necesario
        except Exception as e:
            self.logger.error(f"Error inesperado al borrar categoría ID {category_id}: {e}")
            # TODO: Mostrar feedback en la UI

    def _setup_logging(self):
        """Configura el handler de logging personalizado para la UI."""
        if hasattr(self.root, 'ids') and 'log_output_label' in self.root.ids and 'log_scrollview' in self.root.ids:
            kivy_handler = self.KivyLogHandler(self, 'log_output_label', 'log_scrollview')
            formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')
            kivy_handler.setFormatter(formatter)
            self.logger.addHandler(kivy_handler)
            # Opcional: Eliminar otros handlers si solo quieres logs en la UI
            # for handler in logging.root.handlers[:]:
            #     logging.root.removeHandler(handler)
            self.logger.info("Logging inicializado y conectado a la UI.")
        else:
            print("ADVERTENCIA: No se encontró log_output_label o log_scrollview en los IDs del root widget. El log no aparecerá en la UI.")

    def add_log_message(self, message):
        """Añade un mensaje al Label de log y hace scroll."""
        try:
            log_label = self.root.ids.log_output_label
            log_scroll = self.root.ids.log_scrollview
            
            # Añadir mensaje con color verde Matrix
            log_label.text += f"[color=00ff00]{message}[/color]\n"
            
            # Hacer scroll hacia abajo para mostrar el último mensaje
            # Esperar un frame para que el tamaño del label se actualice
            Clock.schedule_once(lambda dt: setattr(log_scroll, 'scroll_y', 0), 0)
            
        except KeyError:
            self.logger.error(f"Error: No se encontró log_output_label o log_scrollview. Mensaje: {message}")
        except Exception as e:
            self.logger.error(f"Error inesperado en add_log_message: {e}")

class Separator(Widget):
    pass

if __name__ == '__main__':
    # Ya no necesitamos llamar a create_tables() aquí si se llama
    # automáticamente al conectar (aunque no hace daño llamarlo)
    print("Verificando/Creando tablas si es necesario...")
    create_tables() # Asegura que las tablas existen antes de iniciar la app
    
    FinanceApp().run()
