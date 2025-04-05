from kivy.config import Config
Config.set('graphics', 'width', '1200')
Config.set('graphics', 'height', '800')

from kivymd.app import MDApp
from kivymd.uix.boxlayout import MDBoxLayout
from kivymd.uix.label import MDLabel
from kivymd.uix.button import MDButtonIcon, MDButtonText, MDIconButton, MDButton
from kivymd.uix.textfield import MDTextField
from kivymd.uix.snackbar import MDSnackbar, MDSnackbarSupportingText
from kivymd.uix.card import MDCard
from kivy.animation import Animation

from kivy.app import App
from kivy.uix.boxlayout import BoxLayout
from kivy.uix.popup import Popup
from kivy.uix.scrollview import ScrollView
from kivy.uix.gridlayout import GridLayout
from kivy.uix.label import Label
from kivy.uix.textinput import TextInput
from kivy.uix.button import Button
from kivy_garden.matplotlib.backend_kivyagg import FigureCanvasKivyAgg
from kivy.properties import ObjectProperty, NumericProperty, StringProperty
from kivy.clock import Clock
from kivy.lang import Builder
from kivy.metrics import dp
from kivy.factory import Factory
from kivy.utils import get_color_from_hex
import matplotlib.pyplot as plt
import numpy as np
import os
from src.database import create_tables, get_all_categories, add_category, delete_category, update_category, get_category_by_id, add_allocation_transaction
import logging
import sqlite3 # To handle IntegrityError if adding duplicates

# --- Logging Configuration ---
# Global KivyLogHandler instance
kivy_log_handler_instance = None

class KivyLogHandler(logging.Handler):
    """A logging handler that sends logs to a Kivy Label."""
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.log_widget = None # Will be set later from the app

    def set_widget(self, widget):
        """Assigns the Kivy Label widget to display logs."""
        self.log_widget = widget

    def emit(self, record):
        """Formats and sends the log record to the Kivy widget."""
        if not self.log_widget:
            # Queue the message if the widget isn't ready yet? Or just drop?
            # For now, let's just drop if the widget isn't set.
            # print(f"Log widget not set, dropping message: {self.format(record)}") # Debug print
            return

        # Acortar mensajes largos para aprovechar mejor el espacio
        log_entry = self.format(record)
        
        # Optimizaciones para mensajes comunes y repetitivos
        if "Successfully allocated" in log_entry:
            # Formato más compacto para asignaciones
            parts = log_entry.split("to category ID")
            if len(parts) > 1:
                amount = parts[0].split("Successfully allocated")[1].strip()
                cat_info = parts[1].strip()
                log_entry = f"✅ Asignado {amount} → Cat ID{cat_info}"
        
        elif "Asignación del" in log_entry and "de $" in log_entry:
            # Acortar mensajes de asignación
            log_entry = log_entry.replace("[📝 Transacción 'Allocation' registrada para Cat ID", "💼 Cat ID")
            log_entry = log_entry.replace("Asignación del", "→")
        
        elif "[💰 Balance establecido para Cat ID" in log_entry:
            # Acortar mensajes de balance
            parts = log_entry.split("[💰 Balance establecido para Cat ID")
            if len(parts) > 1:
                cat_id = parts[1].split("]")[0].strip()
                balance = parts[1].split("]")[1].strip()
                log_entry = f"💰 Balance Cat ID {cat_id}: {balance}"
        
        # Limitar longitud máxima
        if len(log_entry) > 80:
            log_entry = log_entry[:77] + "..."
            
        # Basic color coding based on level
        level_color_map = {
            logging.INFO: "00ff00",    # Green
            logging.WARNING: "ffff00", # Yellow
            logging.ERROR: "ff0000",   # Red
            logging.CRITICAL: "ff0000",# Red
            logging.DEBUG: "00ffff",   # Cyan
        }
        color = level_color_map.get(record.levelno, "ffffff") # Default white

        # Append new log with color markup
        self.log_widget.text += f"[color={color}]{log_entry}[/color]\n"
        # Auto-scroll to the bottom
        if hasattr(self.log_widget.parent, 'scroll_y'):
            scroll_view = self.log_widget.parent # Assuming Label is direct child of ScrollView
            # Scroll only if needed (optional, might save minor performance)
            # if scroll_view.scroll_y > 0:
            scroll_view.scroll_y = 0

# --- UI Widgets (Popups, etc.) ---
class EditCategoryPopup(Popup):
    """Popup for editing categories."""
    category_id = NumericProperty(None)  # Properly define the property
    pass # Rest defined in KV

# --- Define Placeholder Classes for KV Popups --- #
class AddCategoryPopup(Popup):
    pass

class EditCategoryPopup(Popup):
    category_id = NumericProperty(0)
    pass # Defined in KV, but Python class helps linkage

# --- Define Root Widget Class Explicitly --- #
class FinanceRootWidget(MDBoxLayout): # Inherit from MDBoxLayout
    pass # No logic needed here, defined in KV

class FinanceApp(MDApp): # <--- Inherit from MDApp
    """Main application class."""
    fig = ObjectProperty(None)
    ax = ObjectProperty(None)
    graph_widget = ObjectProperty(None)

    def build(self):
        """Builds the app. KivyMD handles KV file loading automatically."""
        global kivy_log_handler_instance
        self.theme_cls.theme_style = "Dark"  # Uncommented - Restore Dark theme
        self.theme_cls.primary_palette = "Green" # Uncommented - Restore Green palette
        logging.info("Dark theme and Green palette re-enabled.")

        # Initialize popup instances to None
        self.add_category_popup_instance = None
        self.edit_popup = None

        # Setup logging handler instance (can be done early)
        if kivy_log_handler_instance is None:
             kivy_log_handler_instance = KivyLogHandler()
             formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')
             kivy_log_handler_instance.setFormatter(formatter)
             root_logger = logging.getLogger()
             # Remove old handlers of this type if any exist (useful for hot-reloading)
             for handler in root_logger.handlers[:]:
                 if isinstance(handler, KivyLogHandler):
                     root_logger.removeHandler(handler)
             root_logger.addHandler(kivy_log_handler_instance)
             root_logger.setLevel(logging.INFO) # Set root logger level

        logging.info("Configuring theme and loading KV file...")
        # Load the KV file. KivyMD automatically handles this if named correctly (financeapp.kv)
        # but explicit loading works too and is clearer here.
        # root_widget = Builder.load_file('src/ui/finance.kv')
        logging.info("KV file loaded.")
        return FinanceRootWidget() # Return the root widget

    def on_start(self):
        """Called after the build() method returns and the root widget is built."""
        logging.info("App started, scheduling UI initialization.")
        # Schedule the UI initialization for the next frame
        # This ensures the root widget and its ids dictionary are fully available.
        from kivy.clock import Clock
        Clock.schedule_once(self.initialize_ui, 0)
        Clock.schedule_once(self.update_graph, 0)  # Initial graph update

    def initialize_ui(self, dt): # dt argument is required by schedule_once
        """Initializes UI elements that depend on the root widget being ready."""
        try:
            global kivy_log_handler_instance
            if not self.root:
                logging.error("Root widget is None in initialize_ui. Cannot proceed.")
                return

            logging.info(f"Accessing root.ids in initialize_ui. Root type: {type(self.root)}")
            # We expect ids to be empty now as the KV is minimal
            if not hasattr(self.root, 'ids'):
                 logging.error("root.ids attribute is missing in initialize_ui.")
                 return
            logging.info(f"root.ids content: {self.root.ids}")

            # --- Link Log Handler to UI Label --- #
            log_label = self.root.ids.get('log_display_label')
            if log_label and kivy_log_handler_instance:
                kivy_log_handler_instance.set_widget(log_label)
                logging.info("Kivy log handler widget set successfully.")
            elif not log_label:
                logging.warning("'log_display_label' not found in root.ids.")
            elif not kivy_log_handler_instance:
                logging.warning("kivy_log_handler_instance is None, cannot set widget.")

            # --- Setup Graph --- #
            # Note: Graph setup now happens within update_graph, called from on_start
            # self.setup_graph(...) is likely deprecated or refactored
            logging.info("Graph setup is handled by update_graph.") 

            # --- Load Initial Categories --- #
            logging.info("Initializing categories list...")
            self.load_categories()

            logging.info("UI Initialization complete (or attempted).")

        except AttributeError as ae:
            logging.error(f"AttributeError during UI initialization: {ae}", exc_info=True)
        except KeyError as ke:
            logging.error(f"KeyError accessing root.ids in load_categories: {ke}. ID likely missing in KV file.", exc_info=True)
        except Exception as e:
            logging.error(f"Unexpected error during UI initialization: {e}", exc_info=True)

    # --- UI Interaction Methods --- #
    def setup_graph(self, graph_placeholder):
        """Sets up the Matplotlib graph area."""
        logging.info("Setting up graph placeholder...")
        # Create a figure and axis
        self.fig, self.ax = plt.subplots()
        # Set the figure background color to match the dark theme
        self.fig.patch.set_facecolor('#303030')
        self.ax.set_facecolor('#303030')
        # Set the text color for labels, titles, etc.
        self.ax.tick_params(axis='x', colors='white', rotation=45)
        self.ax.tick_params(axis='y', colors='white')
        self.ax.title.set_color('white')
        # Create a canvas to display the figure
        self.graph_widget = FigureCanvasKivyAgg(self.fig)
        # Add the canvas to the placeholder
        graph_placeholder.add_widget(self.graph_widget)

    def load_categories(self, dt=None):
        """Loads categories from the database and displays them using CategoryRow (KivyMD)."""
        try:
            category_list_layout = self.root.ids.get('category_list_layout')
            if not category_list_layout:
                logging.error("Category list layout not found in root.ids.")
                return

            # Clear existing widgets with animation
            for child in category_list_layout.children[:]:  # Create a copy of the list
                anim = Animation(opacity=0, duration=0.3)
                anim.bind(on_complete=lambda *args: category_list_layout.remove_widget(child))
                anim.start(child)

            # Get categories from database
            categories = get_all_categories()
            
            # Limpiar completamente el layout después de las animaciones
            Clock.schedule_once(lambda dt: self._add_category_widgets(categories), 0.4)

        except Exception as e:
            logging.error(f"Error loading categories: {e}", exc_info=True)
            self.show_error_popup(f"Error al cargar categorías: {str(e)}")
            
    def _add_category_widgets(self, categories):
        """Helper method to add category widgets after clearing the layout."""
        try:
            category_list_layout = self.root.ids.get('category_list_layout')
            if not category_list_layout:
                return
                
            # Asegurarse de que el layout esté completamente vacío
            category_list_layout.clear_widgets()
            
            # Add new category rows with fade-in animation
            for category in reversed(categories):  # Usamos reversed para que aparezcan en orden inverso
                logging.debug(f"Creating CategoryRow for: {category['name']}")
                balance = category['current_balance'] if category['current_balance'] is not None else 0.0
                
                # Create CategoryRow instance using Factory
                row = Factory.CategoryRow()
                
                # Set properties
                row.category_id = category['id']
                row.category_name = category['name']
                row.category_percentage = f"{category['percentage']}%"
                row.category_balance = f"{balance:.2f} €"
                
                # Add to layout (al principio)
                category_list_layout.add_widget(row)
                
                # Start fade-in animation
                row.opacity = 0
                anim = Animation(opacity=1, duration=0.5)
                anim.start(row)
                
        except Exception as e:
            logging.error(f"Error adding category widgets: {e}", exc_info=True)

    def update_graph(self, dt=None):
        """Updates the pie chart with current category data."""
        logging.info("Actualizando gráfico de categorías...")
        try:
            # Get the placeholder widget directly using its ID from root.ids
            graph_placeholder = self.root.ids.get('graph_placeholder')
            
            if not graph_placeholder:
                # Log if the placeholder ID wasn't found in the root ids dictionary
                logging.error("No se encontró el widget con id 'graph_placeholder' en root.ids")
                # Optional: Check if graph_card exists, just in case
                graph_card = self.root.ids.get('graph_card')
                if graph_card:
                     logging.debug(f"Contenido de graph_card.children: {graph_card.children}")
                else:
                     logging.debug("graph_card tampoco fue encontrado.")
                return

            # Clear previous graph from the placeholder
            graph_placeholder.clear_widgets()

            # Get categories data
            categories = get_all_categories()
            if not categories:
                logging.info("No hay categorías para mostrar en el gráfico")
                return

            # Prepare data for the pie chart
            labels = [cat['name'] for cat in categories]
            sizes = [cat['percentage'] for cat in categories]
            balances = [cat['current_balance'] if cat['current_balance'] is not None else 0 for cat in categories]

            # Create figure with dark theme
            plt.style.use('dark_background')
            fig, ax = plt.subplots(figsize=(8, 6))
            fig.patch.set_facecolor('#1E1E1E')  # Match MDBoxLayout background

            # Porcentajes Pie Chart with better colors
            colors = plt.cm.Greens(np.linspace(0.5, 0.8, len(sizes)))  # More saturated greens
            wedges, texts, autotexts = ax.pie(sizes, labels=labels, autopct='%1.1f%%',
                                            startangle=90, colors=colors,
                                            textprops={'color': 'white'},
                                            wedgeprops={'width': 0.7})  # Donut style
            
            # Center circle for donut effect
            centre_circle = plt.Circle((0,0), 0.50, fc='#1E1E1E')
            ax.add_artist(centre_circle)

            # Style the text
            plt.setp(autotexts, size=11, weight="bold", color="white")
            plt.setp(texts, size=10, color="#4CAF50")  # Match category text color

            # Add title with custom style
            ax.set_title('Distribución de Categorías', color='white', pad=20, fontsize=14, fontweight='bold')

            # Add the graph to the placeholder
            canvas = FigureCanvasKivyAgg(figure=fig)
            graph_placeholder.add_widget(canvas)
            plt.close(fig)  # Close the figure to free memory

        except KeyError as ke:
             # Catch KeyError specifically if .get() is not used or if accessing ids fails unexpectedly
             logging.error(f"KeyError al acceder a 'graph_placeholder': {ke}. ¿El ID existe en financeapp.kv y está en self.root.ids?", exc_info=True)
             self.show_error_popup(f"Error interno al buscar el área del gráfico (ID: {ke})")
        except Exception as e:
            logging.error(f"Error al actualizar el gráfico: {e}", exc_info=True)
            self.show_error_popup(f"Error al actualizar el gráfico: {str(e)}")

    def ui_distribute_income_kivy(self, income_text=None):
        """Distributes income based on the value in the income input field."""
        try:
            if income_text is None:
                income_input = self.root.ids.get('income_input')
                if not income_input:
                    logging.error("Income input field not found.")
                    return
                income_text = income_input.text
            
            # Replace comma with dot for float conversion
            income_text = income_text.replace(",", ".")
            total_income = float(income_text)
            
            if total_income <= 0:
                self.show_error_popup("El ingreso debe ser positivo")
                return
                
            logging.info(f"[Attempting to distribute income] {total_income:.2f}")
            
            categories = get_all_categories()
            if not categories:
                self.show_error_popup("No hay categorías definidas para distribuir")
                return
                
            total_percentage = sum(cat['percentage'] for cat in categories)
            if not (99.9 < total_percentage < 100.1) and total_percentage != 0:
                logging.warning(f"Total category percentage is {total_percentage:.2f}%, not 100%.")
            elif total_percentage == 0 and len(categories) > 0:
                self.show_error_popup("Todas las categorías tienen 0%. No se puede distribuir.")
                return
                
            logging.info(f"Starting income distribution for ${total_income:.2f}")
            
            # Loop through categories and allocate income
            for category in categories:
                cat_id = category['id']
                cat_name = category['name']
                percentage = category['percentage']
                allocated_amount = round((percentage / 100.0) * total_income, 2)
                
                if allocated_amount > 0:
                    description = f"Asignación del {percentage:.2f}% de ${total_income:.2f}"
                    try:
                        add_allocation_transaction(cat_id, allocated_amount, description)
                        logging.info(f"Successfully allocated ${allocated_amount:.2f} to category ID {cat_id} ('{cat_name}')")
                    except Exception as db_err:
                        logging.error(f"Error allocating to category ID {cat_id}: {db_err}", exc_info=True)
            
            logging.info("Income distribution process finished.")
            Clock.schedule_once(self.load_categories, 0)
            Clock.schedule_once(self.update_graph, 0.3)
            
            # Mostrar snackbar de éxito
            snackbar = MDSnackbar(
                MDBoxLayout(
                    MDSnackbarSupportingText(
                        text=f"¡Ingreso de {total_income:.2f}€ distribuido con éxito! 💰",
                        text_color=get_color_from_hex('#FFFFFF'),
                        theme_text_color="Custom",
                    ),
                    md_bg_color=get_color_from_hex('#00796B'),  # Teal oscuro
                    padding="12dp",
                    adaptive_height=True,
                ),
            )
            snackbar.y = dp(24)
            snackbar.pos_hint = {"center_x": 0.5}
            snackbar.size_hint_x = 0.5
            snackbar.snackbar_animation_dir = "Bottom"
            snackbar.md_bg_color = (0, 0, 0, 0)  # Hacer transparente el snackbar exterior
            snackbar.duration = 1.5
            snackbar.open()
            
        except ValueError:
            self.show_error_popup(f"Entrada de ingreso inválida: '{income_text}'. Introduce un número válido.")
        except Exception as e:
            logging.error(f"Error distributing income: {e}", exc_info=True)
            self.show_error_popup(f"Error al distribuir ingreso: {str(e)}")

    def delete_category_action(self, category_id):
        """Deletes a category after user interaction (called from CategoryRow button)."""
        logging.info(f"Intentando borrar categoría ID: {category_id}")
        # TODO: Añadir diálogo de confirmación aquí para UX
        try:
            # Find the category widget
            category_list = self.root.ids.category_list_layout
            category_widget = None
            for widget in category_list.children:
                if widget.category_id == category_id:
                    category_widget = widget
                    break

            if category_widget:
                # Create fade-out animation
                anim = Animation(opacity=0, duration=0.3)
                
                # Definir la función fuera del callback para evitar problemas
                def on_complete_delete(animation, target_widget):
                    try:
                        delete_category(category_id)
                        Clock.schedule_once(self.load_categories, 0)
                        Clock.schedule_once(self.update_graph, 0.1)
                        
                        # Show deletion notification
                        snackbar = MDSnackbar(
                            MDBoxLayout(
                                MDSnackbarSupportingText(
                                    text="Categoría eliminada ✨",
                                    text_color=get_color_from_hex('#FAFAFA'), # Casi blanco para buen contraste
                                    theme_text_color="Custom",
                                ),
                                md_bg_color=get_color_from_hex('#FF5252'), # Fondo rojo
                                padding="12dp",
                                adaptive_height=True,
                            ),
                        )
                        snackbar.y = dp(24)
                        snackbar.pos_hint = {"center_x": 0.5}
                        snackbar.size_hint_x = 0.5
                        snackbar.snackbar_animation_dir = "Bottom"
                        snackbar.md_bg_color = (0, 0, 0, 0) # Hacer transparente el snackbar exterior
                        snackbar.duration = 1.5
                        snackbar.open()
                    except Exception as inner_e:
                        logging.error(f"Error en callback de eliminación: {inner_e}")
                        self.show_error_popup(f"Error al finalizar eliminación: {inner_e}")
                
                anim.bind(on_complete=on_complete_delete)
                anim.start(category_widget)
            
        except Exception as e:
            logging.error(f"Error inesperado al borrar categoría ID {category_id}: {e}")
            # Mostrar popup de error genérico
            self.show_error_popup(f"Error al borrar categoría: {e}")

    def open_edit_popup(self, category_id):
        """Alias for show_edit_category_popup for backwards compatibility."""
        self.show_edit_category_popup(category_id)

    def show_edit_category_popup(self, category_id):
        """Shows the popup for editing an existing category."""
        logging.info(f"[Abriendo popup de edición para categoría ID] {category_id}")
        try:
            category = get_category_by_id(category_id)
            if not category:
                logging.error(f"Categoría ID {category_id} no encontrada para editar.")
                self.show_error_popup(f"No se pudo encontrar la categoría ID {category_id}")
                return
                
            popup = EditCategoryPopup()
            popup.category_id = category_id
            
            # Get references to the input fields
            name_input = popup.ids.get('edit_category_name_input')
            percentage_input = popup.ids.get('edit_category_percentage_input')
            
            if name_input and percentage_input:
                name_input.text = category['name']
                percentage_input.text = str(category['percentage'])
            else:
                logging.error("No se pudieron encontrar los campos de entrada en el popup de edición.")
                
            popup.open()
        except Exception as e:
            logging.error(f"Error al abrir popup de edición: {e}", exc_info=True)
            self.show_error_popup(f"Error al abrir editor: {str(e)}")

    # --- Add Category Popup --- > NUEVA FUNCIÓN
    def show_add_category_popup(self):
        """Shows the popup for adding a new category."""
        logging.info("Abriendo popup para añadir categoría...")
        popup = AddCategoryPopup()
        popup.open()
        
    # --- Process Add Category Popup --- > RECONSTRUCCIÓN
    def add_category_from_popup(self, popup, name, percentage):
        """Adds a new category from the AddCategoryPopup data after validation."""
        log_widget = self.root.ids.get('log_label')
        name = name.strip()
        percentage = percentage.strip().replace(',', '.')

        # --- Validation --- #
        if not name:
            logging.warning("Intento de añadir categoría sin nombre.")
            self.show_error_popup("El nombre de la categoría no puede estar vacío.")
            # No cerramos el popup para que pueda corregir
            return

        try:
            percentage = float(percentage)
            if percentage <= 0:
                logging.warning(f"Intento de añadir categoría con porcentaje no positivo: {percentage}")
                self.show_error_popup("El porcentaje debe ser un número positivo.")
                return
        except ValueError:
            logging.warning(f"Intento de añadir categoría con porcentaje inválido: '{percentage}'")
            self.show_error_popup("El porcentaje introducido no es un número válido.")
            return

        # Check total percentage
        try:
            categories = get_all_categories()
            current_total_percentage = sum(cat['percentage'] for cat in categories)
            if current_total_percentage + percentage > 100.01: # Allow for small float inaccuracies
                logging.warning(f"Intento de superar el 100% (Actual: {current_total_percentage}, Nuevo: {percentage})")
                self.show_error_popup(f"Añadir {percentage}% superaría el 100% total (actual: {current_total_percentage:.2f}%)")
                return
        except Exception as e:
            logging.error(f"Error al obtener categorías para validar porcentaje: {e}")
            self.show_error_popup("Error al verificar el porcentaje total.")
            # Decide if you want to stop the whole process or continue with others
            # return # Example: Stop if one fails

        # --- Add to Database --- #
        try:
            success = add_category(name, percentage)
            if success:
                logging.info(f"Categoría '{name}' añadida exitosamente con {percentage}%.")
                if log_widget:
                     log_widget.text += f"[color=00ff00]Categoría '{name}' ({percentage}%) añadida.[/color]\n"
                popup.dismiss() # Cerrar popup si éxito
                Clock.schedule_once(self.load_categories, 0) # Refrescar lista
                Clock.schedule_once(self.update_graph, 0.1)  # Slight delay for smooth animation
                
                # Show success snackbar
                snackbar = MDSnackbar(
                    MDBoxLayout(
                        MDSnackbarSupportingText(
                            text=f"¡Categoría {name} añadida! 🎉",
                            text_color=get_color_from_hex('#FAFAFA'), # Casi blanco para buen contraste
                            theme_text_color="Custom",
                        ),
                        md_bg_color=get_color_from_hex('#00796B'), # Teal oscuro
                        padding="12dp",
                        adaptive_height=True,
                    ),
                )
                snackbar.y = dp(24)
                snackbar.pos_hint = {"center_x": 0.5}
                snackbar.size_hint_x = 0.5
                snackbar.snackbar_animation_dir = "Bottom"
                snackbar.md_bg_color = (0, 0, 0, 0)  # Hacer transparente el snackbar exterior
                snackbar.duration = 1.5
                snackbar.open()
            else:
                # add_category should log specifics, show generic error here
                self.show_error_popup(f"No se pudo añadir la categoría '{name}'. ¿Quizás ya existe?")
        except Exception as e:
            logging.error(f"Error inesperado al añadir categoría '{name}': {e}", exc_info=True)
            self.show_error_popup(f"Error inesperado al guardar: {e}")
            popup.dismiss() # Dismiss even on unexpected error?

    # --- Process Edit Category Popup --- > NUEVA FUNCIÓN
    def update_category_from_popup(self, popup, category_id_str, new_name, new_percentage_str):
        """Updates an existing category from the EditCategoryPopup data after validation."""
        log_widget = self.root.ids.get('log_label')
        new_name = new_name.strip()
        new_percentage_str = new_percentage_str.strip().replace(',', '.')

        # --- Validation --- #
        if not new_name:
            logging.warning("Intento de actualizar categoría sin nombre.")
            self.show_error_popup("El nombre de la categoría no puede estar vacío.")
            return

        try:
            category_id = int(category_id_str)
            new_percentage = float(new_percentage_str)
            if new_percentage <= 0:
                logging.warning(f"Intento de actualizar categoría ID {category_id} con porcentaje no positivo: {new_percentage}")
                self.show_error_popup("El porcentaje debe ser un número positivo.")
                return
        except ValueError:
            logging.warning(f"Intento de actualizar categoría con ID/porcentaje inválido: ID='{category_id_str}', %='{new_percentage_str}'")
            self.show_error_popup("El porcentaje o el ID interno no son válidos.")
            return
        except Exception as e:
             logging.error(f"Error inesperado en la validación inicial de edición para ID {category_id_str}: {e}")
             self.show_error_popup(f"Error de validación: {e}")
             popup.dismiss()
             return

        # Check total percentage (excluding the original percentage of the item being edited)
        try:
            categories = get_all_categories()
            current_total_percentage_others = sum(cat['percentage'] for cat in categories if cat['id'] != category_id)
            new_total_percentage = current_total_percentage_others + new_percentage

            if new_total_percentage > 100.01: # Allow for small float inaccuracies
                original_percentage = next((cat['percentage'] for cat in categories if cat['id'] == category_id), 0)
                logging.warning(f"Intento de superar el 100% al editar ID {category_id} (Otros: {current_total_percentage_others}, Nuevo: {new_percentage})")
                self.show_error_popup(f"Editar a {new_percentage}% superaría el 100% total (actual otros: {current_total_percentage_others:.2f}%)")
                return
        except Exception as e:
            logging.error(f"Error al obtener categorías para validar porcentaje en edición: {e}")
            self.show_error_popup("Error al verificar el porcentaje total durante la edición.")
            popup.dismiss()
            return

        # --- Update Database --- #
        try:
            success = update_category(category_id, new_name, new_percentage)
            if success:
                logging.info(f"Categoría ID {category_id} actualizada a '{new_name}' con {new_percentage}%.")
                if log_widget:
                    log_widget.text += f"[color=00ff00]Categoría '{new_name}' ({new_percentage}%) actualizada.[/color]\n"
                popup.dismiss() # Cerrar popup si éxito
                Clock.schedule_once(self.load_categories, 0) # Refrescar lista
                Clock.schedule_once(self.update_graph, 0.1)  # Slight delay for smooth animation
                
                # Show success snackbar
                snackbar = MDSnackbar(
                    MDBoxLayout(
                        MDSnackbarSupportingText(
                            text=f"¡Categoría {new_name} actualizada! 🎉",
                            text_color=get_color_from_hex('#FAFAFA'), # Casi blanco
                            theme_text_color="Custom",
                        ),
                        md_bg_color=get_color_from_hex('#00796B'), # Teal oscuro
                        padding="12dp",
                        adaptive_height=True,
                    ),
                )
                snackbar.y = dp(24)
                snackbar.pos_hint = {"center_x": 0.5}
                snackbar.size_hint_x = 0.5
                snackbar.snackbar_animation_dir = "Bottom"
                snackbar.md_bg_color = (0, 0, 0, 0)  # Hacer transparente el snackbar exterior
                snackbar.duration = 1.5
                snackbar.open()
            else:
                # update_category should log specifics, show generic error here
                logging.error(f"Fallo al actualizar la categoría ID {category_id} desde la UI (update_category devolvió False)")
                self.show_error_popup(f"No se pudo actualizar la categoría '{new_name}'. ¿Conflicto de nombre?")
        except Exception as e:
            logging.error(f"Error inesperado al actualizar categoría ID {category_id} ('{new_name}'): {e}", exc_info=True)
            self.show_error_popup(f"Error inesperado al guardar cambios: {e}")
            popup.dismiss()

    # --- Generic Error Popup --- > RECONSTRUCCIÓN
    def show_error_popup(self, error_message):
        """Displays a simple popup with an error message."""
        logging.error(f"Mostrando popup de error: {error_message}") # Log the error being shown
        try:
            popup = Popup(
                title='Error',
                content=MDLabel(
                    text=error_message,
                    halign='center',
                    text_color=(1, 1, 1, 1)  # <--- ¡Forzando color blanco!
                ),
                size_hint=(None, None),
                size=(dp(400), dp(200))
            )
            
            # Start minimized and scale up
            popup.opacity = 0
            popup.scale = 0
            popup.open()
            
            anim = (Animation(opacity=1, duration=0.2) & 
                   Animation(scale=1.1, duration=0.2)) + \
                   Animation(scale=1, duration=0.1)
            anim.start(popup)
            
        except Exception as e:
            # Fallback si crear el popup falla
            logging.critical(f"CRÍTICO: Fallo al crear/mostrar popup de error: {e}", exc_info=True)
            print(f"ERROR CRÍTICO AL MOSTRAR POPUP: {error_message}\nError creación popup: {e}")

    # --- Entry Point --- #
if __name__ == '__main__':
    # Create tables if they don't exist
    create_tables()

    # Setup Kivy logging *before* running the app
    # Note: We instantiate the handler here, but it needs the widget from on_start
    kivy_log_handler_instance = KivyLogHandler()
    formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')
    kivy_log_handler_instance.setFormatter(formatter)
    root_logger = logging.getLogger()
    # Clean up potential old handlers (important for reloading/multiple runs)
    for handler in root_logger.handlers[:]:
        if isinstance(handler, KivyLogHandler):
            root_logger.removeHandler(handler)
    root_logger.addHandler(kivy_log_handler_instance)
    root_logger.setLevel(logging.INFO) # Set the desired level for the root logger

    logging.info("Iniciando la aplicación FinanceApp...")
    FinanceApp().run()
