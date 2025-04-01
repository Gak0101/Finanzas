from kivy.config import Config
Config.set('graphics', 'width', '1200')
Config.set('graphics', 'height', '800')

from kivymd.app import MDApp
from kivymd.uix.boxlayout import MDBoxLayout # Import needed for FinanceRootWidget
from kivymd.uix.label import MDLabel
from kivymd.uix.button import MDRaisedButton, MDIconButton
from kivymd.uix.textfield import MDTextField

from kivy.uix.boxlayout import BoxLayout
from kivy.uix.gridlayout import GridLayout
from kivy.uix.popup import Popup # Added for Error Popup
from kivy.uix.scrollview import ScrollView
from kivy.uix.label import Label
from kivy.uix.textinput import TextInput
from kivy.uix.button import Button
from kivy_garden.matplotlib.backend_kivyagg import FigureCanvasKivyAgg
from kivy.properties import ObjectProperty, StringProperty, NumericProperty
from kivy.clock import Clock
from kivy.lang import Builder
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

        log_entry = self.format(record)
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
        self.log_widget.text += f"[color={color}]{log_entry}[/color]\\n"
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

# --- Kivy Dynamic Class for Category Rows --- #
class CategoryRow(MDBoxLayout):
    """Widget that represents a category row in the list."""
    category_id = NumericProperty(None)
    category_name = StringProperty("")
    category_percentage = StringProperty("")
    category_balance = StringProperty("")

# --- Define Placeholder Classes for KV Popups --- #
class AddCategoryPopup(Popup):
    pass # Defined in KV

class EditCategoryPopup(Popup):
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

            # --- Keep actual UI interactions commented out for now ---
            # # 1. Setup Kivy Log Handler Widget
            # log_label = self.root.ids.get('log_display_label')
            # if log_label and kivy_log_handler_instance:
            #     kivy_log_handler_instance.set_widget(log_label)
            #     logging.info("Kivy log handler widget set successfully.")
            # elif not log_label:
            #     logging.warning("'log_display_label' not found in root.ids.")
            # elif not kivy_log_handler_instance:
            #     logging.warning("kivy_log_handler_instance is None, cannot set widget.")

            # # 2. Setup Matplotlib Graph (Placeholder logic)
            # graph_placeholder = self.root.ids.get('graph_placeholder')
            # if graph_placeholder:
            #     self.setup_graph(graph_placeholder) # Call setup_graph
            #     logging.info("Graph setup initiated.")
            # else:
            #     logging.warning("'graph_placeholder' not found in root.ids.")

            # # 3. Load Categories into the UI
            # category_list_layout = self.root.ids.get('category_list_layout')
            # if category_list_layout:
            #     self.load_categories() # Call load_categories (which uses the id)
            #     logging.info("Initial category loading initiated.")
            # else:
            #     logging.warning("'category_list_layout' not found in root.ids.")

            logging.info("UI Initialization complete (or attempted).")

        except AttributeError as ae:
            logging.error(f"AttributeError during UI initialization: {ae}", exc_info=True)
        except KeyError as ke:
            logging.error(f"KeyError accessing root.ids: {ke}. ID likely missing in KV file.", exc_info=True)
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

    def load_categories(self, dt=None): # Add dt=None argument to accept Clock's call
        """Loads categories from the database and displays them using CategoryRow (KivyMD)."""
        logging.info("Loading categories into KivyMD list...")
        try:
            category_list_layout = self.root.ids.get('category_list_layout')
            if not category_list_layout:
                logging.error("Cannot find 'category_list_layout' in root.ids")
                return

            category_list_layout.clear_widgets() # Clear previous widgets
            categories = get_all_categories() # Assuming this returns list of dicts

            if not categories:
                logging.info("No categories found in the database.")
                # Optional: Add a placeholder label if needed
                # category_list_layout.add_widget(MDLabel(text="No categories defined.", halign="center"))
                return

            logging.info(f"Found {len(categories)} categories. Populating list...")
            for category in categories:
                logging.debug(f"Creating CategoryRow for: {category['name']}")
                balance = category['current_balance'] if category['current_balance'] is not None else 0.0
                # Create CategoryRow instance using Factory and KV definition
                row = CategoryRow() # Create instance first
                # Then set properties
                row.category_id = category['id']
                row.category_name = category['name']
                row.category_percentage = f"{category['percentage']:.2f}%"
                row.category_balance = f"{balance:.2f} €"

                # Bind buttons inside the row (assuming buttons are defined in <CategoryRow> rule)
                # The KV rule already binds them: on_press: app.open_edit_popup(root.category_id)
                category_list_layout.add_widget(row)

        except KeyError as e:
            logging.error(f"KeyError accessing root.ids in load_categories: {e}. ID likely missing in KV file.", exc_info=True)
        except Exception as e:
            logging.error(f"Unexpected error during category loading: {e}", exc_info=True)

    def update_graph(self, dt=None):
        """Updates the pie chart with current category data."""
        logging.info("Actualizando gráfico de categorías...")
        try:
            # Get the graph layout widget
            graph_layout = self.root.ids.graph_layout
            if not graph_layout:
                logging.error("No se encontró el widget graph_layout")
                return

            # Clear previous graph
            graph_layout.clear_widgets()

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
            fig, ax = plt.subplots(figsize=(6, 5))
            fig.patch.set_facecolor('#121212')  # Dark background

            # Porcentajes Pie Chart
            wedges, texts, autotexts = ax.pie(sizes, labels=labels, autopct='%1.1f%%',
                                            startangle=90, colors=plt.cm.Greens(np.linspace(0.4, 0.8, len(sizes))))
            ax.set_title('Distribución de Porcentajes', color='white', pad=20)

            # Style the text
            plt.setp(autotexts, size=10, weight="bold", color="white")
            plt.setp(texts, size=10, color="white")

            # Add the graph to the layout
            canvas = FigureCanvasKivyAgg(figure=fig)
            graph_layout.add_widget(canvas)
            plt.close(fig)  # Close the figure to free memory

        except Exception as e:
            logging.error(f"Error al actualizar el gráfico: {e}", exc_info=True)
            self.show_error_popup(f"Error al actualizar el gráfico: {str(e)}")

    def ui_distribute_income_kivy(self):
        """Distributes the entered income across categories based on percentages."""
        log_widget = self.root.ids.get('log_display_label')
        income_input_widget = self.root.ids.get('income_input')

        if not log_widget or not income_input_widget:
            logging.error("Error: Log display or income input widget not found in root.ids.")
            # Optionally show a user-facing error popup
            return

        try:
            income_text = income_input_widget.text.strip()
            if not income_text:
                log_widget.text += "[color=ff0000]Error: El campo de ingreso está vacío.[/color]\n"
                logging.warning("Distribute income attempt with empty input.")
                return

            # Replace comma with dot for float conversion
            income_text = income_text.replace(",", ".")
            total_income = float(income_text)

            if total_income <= 0:
                log_widget.text += f"[color=ffff00]Advertencia: El ingreso debe ser positivo ({total_income} introducido).[/color]\n"
                logging.warning(f"Distribute income attempt with non-positive value: {total_income}")
                return

            log_widget.text += f"[color=00ff00]Distribuyendo ingreso: {total_income:.2f} €[/color]\n"
            logging.info(f"Attempting to distribute income: {total_income:.2f}")

            categories = get_all_categories()
            if not categories:
                log_widget.text += "[color=ff0000]Error: No hay categorías definidas para distribuir.[/color]\n"
                logging.warning("Distribute income attempt with no categories defined.")
                return

            total_percentage = sum(cat['percentage'] for cat in categories)
            # Optional: Check if total percentage is reasonable (e.g., close to 100)
            if not (99.9 < total_percentage < 100.1) and total_percentage != 0:
                log_widget.text += f"[color=ffff00]Advertencia: La suma de porcentajes ({total_percentage:.2f}%) no es 100%. La distribución puede ser inesperada.[/color]\n"
                logging.warning(f"Total category percentage is {total_percentage:.2f}%, not 100%.")
            elif total_percentage == 0 and len(categories) > 0:
                 log_widget.text += f"[color=ff0000]Error: Todas las categorías tienen 0%. No se puede distribuir.[/color]\n"
                 logging.error(f"Distribution impossible: All categories have 0%.")
                 return

            logging.info(f"Starting income distribution for ${total_income:.2f}")

            # --- Loop through categories and call the new DB function ---
            for category in categories:
                cat_id = category['id']
                cat_name = category['name']
                percentage = category['percentage']
                allocated_amount = round((percentage / 100.0) * total_income, 2)

                if allocated_amount > 0:
                    description = f"Asignación del {percentage:.2f}% de ${total_income:.2f}"
                    try:
                        # --- Call the new database function directly ---
                        add_allocation_transaction(cat_id, allocated_amount, description)
                        log_widget.text += f"[color=00ff00]  - Asignado ${allocated_amount:.2f} a '{cat_name}'[/color]\n"
                        logging.info(f"Successfully allocated ${allocated_amount:.2f} to category ID {cat_id} ('{cat_name}')")
                    except Exception as db_err:
                        # The DB function logs its own errors, but we add context here
                        log_widget.text += f"[color=ff0000]  - Error al asignar a '{cat_name}': {db_err}[/color]\n"
                        logging.error(f"Error calling add_allocation_transaction for category ID {cat_id} ('{cat_name}'): {db_err}", exc_info=True)
                        # Decide if you want to stop the whole process or continue with others
                        # return # Example: Stop if one fails

            # --- No longer needed: call to non-existent add_multiple_transactions ---
            # if transactions_to_add:
            #     try:
            #         # This function doesn't exist! This was the problem.
            #         # add_multiple_transactions(transactions_to_add)
            #         # log_widget.text += "[color=00ff00]Distribución completada y registrada.[/color]\n"
            #         # logging.info("Income distribution transactions presumably added.")
            #         pass # Now handled inside the loop
            #     except Exception as e:
            #         log_widget.text += f"[color=ff0000]Error al registrar la distribución: {e}[/color]\n"
            #         logging.error(f"Error during (non-existent) bulk transaction add: {e}", exc_info=True)

            log_widget.text += "[color=00ff00]Distribución procesada.[/color]\n"
            logging.info("Income distribution process finished.")
            Clock.schedule_once(self.load_categories, 0) # Schedule refresh for next frame
            Clock.schedule_once(self.update_graph, 0) # Update graph if it exists

        except ValueError:
            log_widget.text += f"[color=ff0000]Error: Entrada de ingreso inválida ('{income_input_widget.text}'). Introduce un número válido.[/color]\n"
            logging.error(f"ValueError converting income input: '{income_input_widget.text}'", exc_info=True)
        except Exception as e:
            log_widget.text += f"[color=ff0000]Error inesperado durante la distribución: {e}[/color]\n"
            logging.error(f"Unexpected error during income distribution: {e}", exc_info=True)

    def delete_category_action(self, category_id):
        """Deletes a category after user interaction (called from CategoryRow button)."""
        logging.info(f"Intentando borrar categoría ID: {category_id}")
        # TODO: Añadir diálogo de confirmación aquí para UX
        try:
            success = delete_category(category_id)
            if success:
                logging.info(f"Categoría ID {category_id} borrada exitosamente.")
                # Refrescar la lista para quitar la categoría borrada
                Clock.schedule_once(self.load_categories, 0)
                Clock.schedule_once(self.update_graph, 0) # Update graph
            else:
                # Esto podría pasar si el ID no existe, aunque delete_category ya loggea
                logging.warning(f"No se pudo borrar la categoría ID {category_id}, puede que ya no exista.")
                # Podríamos mostrar un popup de error aquí también
        except Exception as e:
            logging.error(f"Error inesperado al borrar categoría ID {category_id}: {e}")
            # Mostrar popup de error genérico
            self.show_error_popup(f"Error al borrar categoría: {e}")

    def open_edit_popup(self, category_id):
        """Opens the Edit Category Popup with the data of the selected category."""
        logging.info(f"Abriendo popup de edición para categoría ID: {category_id}")
        try:
            category = get_category_by_id(category_id)
            if category:
                if not self.edit_popup:
                    # Crear el popup si no existe (definido en KV)
                    self.edit_popup = EditCategoryPopup()

                # Llenar los campos del popup con los datos actuales
                self.edit_popup.category_id = category['id']  # Usar la propiedad definida
                self.edit_popup.ids.edit_category_name_input.text = category['name']
                self.edit_popup.ids.edit_category_percentage_input.text = str(category['percentage'])

                self.edit_popup.open()
            else:
                logging.error(f"No se encontró la categoría con ID {category_id} para editar.")
                self.show_error_popup("Error: No se encontró la categoría seleccionada.")
        except Exception as e:
            logging.error(f"Error al abrir el popup de edición para ID {category_id}: {e}")
            self.show_error_popup(f"Error al preparar edición: {e}")

    # --- Add Category Popup --- > NUEVA FUNCIÓN
    def show_add_category_popup(self):
        """Shows the Add Category Popup."""
        logging.info("Abriendo popup para añadir categoría...")
        try:
            if not self.add_category_popup_instance:
                # Crear instancia si no existe (definida en KV)
                self.add_category_popup_instance = AddCategoryPopup()
            
            # Limpiar campos antes de mostrar
            self.add_category_popup_instance.ids.category_name_input.text = ""
            self.add_category_popup_instance.ids.category_percentage_input.text = ""
            
            self.add_category_popup_instance.open()
        except Exception as e:
            logging.error(f"Error al mostrar el popup de añadir categoría: {e}")
            self.show_error_popup(f"Error al abrir el popup: {e}")

    # --- Process Add Category Popup --- > RECONSTRUCCIÓN
    def add_category_from_popup(self, popup, name, percentage_str):
        """Adds a new category from the AddCategoryPopup data after validation."""
        log_widget = self.root.ids.get('log_display_label')
        name = name.strip()
        percentage_str = percentage_str.strip().replace(',', '.')

        # --- Validation --- #
        if not name:
            logging.warning("Intento de añadir categoría sin nombre.")
            self.show_error_popup("El nombre de la categoría no puede estar vacío.")
            # No cerramos el popup para que pueda corregir
            return

        try:
            percentage = float(percentage_str)
            if percentage <= 0:
                logging.warning(f"Intento de añadir categoría con porcentaje no positivo: {percentage}")
                self.show_error_popup("El porcentaje debe ser un número positivo.")
                return
        except ValueError:
            logging.warning(f"Intento de añadir categoría con porcentaje inválido: '{percentage_str}'")
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
                Clock.schedule_once(self.update_graph, 0) # Update graph
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
        log_widget = self.root.ids.get('log_display_label')
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
                Clock.schedule_once(self.update_graph, 0) # Update graph
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
            # Contenido: Una etiqueta simple dentro de un BoxLayout
            content = MDBoxLayout(orientation='vertical', padding="10dp", spacing="10dp", adaptive_height=True)
            content.add_widget(MDLabel(text=error_message, halign='center', adaptive_height=True))

            # Botón OK para cerrar
            ok_button = MDRaisedButton(text="OK", size_hint_y=None, height="48dp", pos_hint={"center_x": 0.5})
            content.add_widget(ok_button)

            # Crear el popup
            popup = Popup(title='Error',
                          content=content,
                          size_hint=(0.7, None), # Ancho relativo, alto automático
                          height="200dp", # Altura fija o adaptativa? Intentemos fija por ahora
                          auto_dismiss=False) # Evitar cerrar al hacer clic fuera

            # Vincular el botón para cerrar el popup
            ok_button.bind(on_press=popup.dismiss)

            # Abrir el popup
            popup.open()
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
