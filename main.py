import customtkinter as ctk
import os
from PIL import Image, ImageTk # Import Pillow components
import matplotlib.pyplot as plt  # Import for creating pie chart
from matplotlib.backends.backend_tkagg import FigureCanvasTkAgg # Matplotlib canvas for Tkinter
# Import our database functions
from database import create_tables, DB_PATH, get_all_categories, add_category, update_category, delete_category, distribute_income
import sqlite3 # Import for IntegrityError handling
from tkinter import messagebox # Import for confirmation dialog

# Set theme BEFORE creating the main window
ctk.set_default_color_theme("green")
ctk.set_appearance_mode("dark")  # Usar modo oscuro para mejor contraste

class FinanceApp(ctk.CTk):
    def __init__(self):
        super().__init__()

        # --- Initialize Database ---
        create_tables()

        # --- Load Icons (Requires 'assets' folder with PNGs) ---
        self.icon_size = (20, 20) # Define a standard size
        self.save_icon = self.load_icon("assets/save_icon.png")
        self.delete_icon = self.load_icon("assets/delete_icon.png")
        self.add_icon = self.load_icon("assets/add_icon.png")
        self.distribute_icon = self.load_icon("assets/distribute_icon.png")

        self.title("Gestor Financiero Personal")
        self.geometry("1200x800") # Ventana más grande para mejor visualización
        self.minsize(1000, 700)   # Tamaño mínimo para evitar problemas de UI

        # --- Main Layout --- 
        self.grid_columnconfigure(0, weight=3) # Column for Categories (wider)
        self.grid_columnconfigure(1, weight=2) # Column for Income/Chart (wider than before)
        self.grid_rowconfigure(0, weight=3) # Row 0 for categories (taller)
        self.grid_rowconfigure(1, weight=0) # Row 1 for adding categories (fixed height)
        self.grid_rowconfigure(2, weight=2) # Row 2 for chart (medium height)

        # --- Frame for displaying categories --- 
        self.categories_frame = ctk.CTkScrollableFrame(
            self, 
            label_text="Categorías y Porcentajes",
            label_font=ctk.CTkFont(size=16, weight="bold"),
            height=400,  # Más alto para mostrar más categorías sin scroll
            corner_radius=10
        ) 
        self.categories_frame.grid(row=0, column=0, padx=20, pady=20, sticky="nsew")
        
        # Configure columns in categories_frame
        self.categories_frame.grid_columnconfigure(0, weight=3) # Name column (wider)
        self.categories_frame.grid_columnconfigure(1, weight=1) # Percentage column
        self.categories_frame.grid_columnconfigure(2, weight=2) # Balance column (wider for currency)
        self.categories_frame.grid_columnconfigure(3, weight=0) # Save button column
        self.categories_frame.grid_columnconfigure(4, weight=0) # Delete button column 

        # Category Headers with better styling
        headers = ["Nombre Categoría", "% Asignado", "Saldo Actual", "", ""]
        header_font = ctk.CTkFont(size=14, weight="bold")
        for i, header in enumerate(headers):
            if header:  # Skip empty headers (button columns)
                header_label = ctk.CTkLabel(self.categories_frame, text=header, font=header_font)
                sticky_val = "w" if i < 2 else "e" # Align text left/right
                header_label.grid(row=0, column=i, padx=10, pady=(10, 15), sticky=sticky_val)

        # --- Frame for adding new categories ---
        self.add_category_frame = ctk.CTkFrame(self, corner_radius=10)
        self.add_category_frame.grid(row=1, column=0, padx=20, pady=(0, 20), sticky="ew")
        # Configuration for elements inside add_category_frame
        self.add_category_frame.grid_columnconfigure(0, weight=1)
        self.add_category_frame.grid_columnconfigure(1, weight=0)
        self.add_category_frame.grid_columnconfigure(2, weight=0)

        self.new_category_name_entry = ctk.CTkEntry(
            self.add_category_frame, 
            placeholder_text="Nombre categoría",
            height=35  # Más alto para mejor visibilidad
        )
        self.new_category_name_entry.grid(row=0, column=0, padx=(15, 5), pady=15, sticky="ew")

        self.new_category_percentage_entry = ctk.CTkEntry(
            self.add_category_frame, 
            placeholder_text="%", 
            width=70,
            height=35  # Más alto para mejor visibilidad
        )
        self.new_category_percentage_entry.grid(row=0, column=1, padx=5, pady=15)

        self.add_category_button = ctk.CTkButton(
            self.add_category_frame, 
            text="Añadir Categoría", 
            image=self.add_icon,
            height=35,  # Más alto para mejor visibilidad
            command=self.ui_add_category
        )
        self.add_category_button.grid(row=0, column=2, padx=(5, 15), pady=15)

        # --- Frame for Adding Income ---
        self.income_frame = ctk.CTkFrame(self, corner_radius=10)
        self.income_frame.grid(row=0, column=1, padx=20, pady=20, sticky="nsew") 
        self.income_frame.grid_columnconfigure(0, weight=1)
        
        self.income_label = ctk.CTkLabel(
            self.income_frame, 
            text="Añadir Ingreso", 
            font=ctk.CTkFont(size=18, weight="bold")
        )
        self.income_label.grid(row=0, column=0, padx=20, pady=(20, 15), sticky="ew")

        self.income_entry = ctk.CTkEntry(
            self.income_frame, 
            placeholder_text="Monto Total Ingreso",
            height=40,  # Más alto para mejor visibilidad
            font=ctk.CTkFont(size=14)
        )
        self.income_entry.grid(row=1, column=0, padx=20, pady=(5, 15), sticky="ew")

        self.distribute_button = ctk.CTkButton(
            self.income_frame, 
            text="Distribuir Ingreso", 
            image=self.distribute_icon,
            height=40,  # Más alto para mejor visibilidad
            font=ctk.CTkFont(size=14),
            command=self.ui_distribute_income
        )
        self.distribute_button.grid(row=2, column=0, padx=20, pady=(5, 20), sticky="ew")

        # --- Frame for Chart ---
        self.chart_frame = ctk.CTkFrame(self, corner_radius=10)
        self.chart_frame.grid(row=1, column=1, rowspan=2, padx=20, pady=(0, 20), sticky="nsew")
        
        # Title for chart frame
        self.chart_title = ctk.CTkLabel(
            self.chart_frame, 
            text="Distribución de Ingresos", 
            font=ctk.CTkFont(size=18, weight="bold")
        )
        self.chart_title.pack(pady=(15, 5))
        
        # Initialize chart
        self.canvas_widget = None # To keep track of the canvas
        
        # --- Store entry widgets for updating ---
        self.category_entries = {} # Dictionary to hold {'cat_id': {'name_entry': widget, 'perc_entry': widget}}
        
        # --- Load and display initial categories ---
        self.load_and_display_categories()
        self.update_pie_chart()

    def load_icon(self, path):
        """Helper function to load an icon, returning None if not found."""
        try:
            return ctk.CTkImage(Image.open(path), size=self.icon_size)
        except FileNotFoundError:
            print(f" Icono no encontrado en: {path}")
            return None # Return None if icon is missing
        except Exception as e:
            print(f" Error cargando icono {path}: {e}")
            return None

    def load_and_display_categories(self):
        """Obtiene categorías de la BD y las muestra en el frame con campos editables."""
        # Limpiar frame anterior y entry storage
        for widget in self.categories_frame.winfo_children():
            if widget.winfo_y() > 0:  # Skip headers (row 0)
                widget.destroy()
        self.category_entries = {}
        
        # Obtener categorías de la BD
        categories = get_all_categories()
        
        # Configurar el grid y mostrar categorías
        current_row = 1  # Start at row 1 (after headers)
        
        for category in categories:
            cat_id = category['id']
            
            # Name Entry (editable)
            name_entry = ctk.CTkEntry(
                self.categories_frame, 
                height=35,  # Más alto para mejor visibilidad
                font=ctk.CTkFont(size=13)
            )
            name_entry.grid(row=current_row, column=0, padx=10, pady=8, sticky="ew")
            name_entry.insert(0, category['name'])
            
            # Percentage Entry (editable)
            percentage_entry = ctk.CTkEntry(
                self.categories_frame, 
                width=70, 
                height=35,  # Más alto para mejor visibilidad
                font=ctk.CTkFont(size=13)
            )
            percentage_entry.grid(row=current_row, column=1, padx=10, pady=8, sticky="w")
            percentage_entry.insert(0, f"{category['percentage']:.2f}") # Format nicely
            
            # Display Balance (non-editable, with Euro symbol)
            balance_label = ctk.CTkLabel(
                self.categories_frame, 
                text=f"€ {category['current_balance']:.2f}",
                font=ctk.CTkFont(size=13, weight="bold"),  # Negrita para destacar
                fg_color=("gray85", "gray25"),  # Color de fondo para destacar
                corner_radius=6,
                padx=10,
                pady=5
            )
            balance_label.grid(row=current_row, column=2, padx=10, pady=8, sticky="e")
            
            # Store references to the entries for this category ID
            self.category_entries[cat_id] = {'name_entry': name_entry, 'perc_entry': percentage_entry}
            
            # Save Button per row
            save_button = ctk.CTkButton(
                self.categories_frame, 
                text="Guardar", 
                image=self.save_icon,
                width=80,
                height=30,  # Altura ajustada
                command=lambda c_id=cat_id: self.ui_update_category(c_id)
            )
            save_button.grid(row=current_row, column=3, padx=(5, 5), pady=8)
            
            # Delete Button
            delete_button = ctk.CTkButton(
                self.categories_frame, 
                text="", 
                image=self.delete_icon,
                width=30,  # Botón cuadrado
                height=30,
                fg_color="#D32F2F",  # Rojo para indicar peligro
                hover_color="#B71C1C",
                command=lambda c_id=cat_id, c_name=category['name']: self.ui_delete_category(c_id, c_name)
            )
            delete_button.grid(row=current_row, column=4, padx=(5, 10), pady=8)
            
            current_row += 1
            
        # If no categories, display a message
        if current_row == 1:  # No categories were added
            no_cat_label = ctk.CTkLabel(
                self.categories_frame, 
                text="No hay categorías añadidas todavía.",
                font=ctk.CTkFont(size=14, slant="italic")
            )
            no_cat_label.grid(row=1, column=0, columnspan=5, pady=20)

    def update_pie_chart(self):
        """Fetches data and updates the pie chart with a modern look."""
        print("📊 Actualizando gráfico (modo moderno)...")
        # Clear previous chart if exists
        if self.canvas_widget:
            self.canvas_widget.destroy()
            self.canvas_widget = None
        # Clear any potential placeholder text
        for widget in self.chart_frame.winfo_children():
            if widget != self.chart_title:  # Mantener el título
                widget.destroy()

        # Get data: categories with balance > 0
        categories = get_all_categories()
        chart_data = {cat['name']: cat['current_balance'] for cat in categories if cat['current_balance'] > 0}

        if not chart_data:
            no_data_label = ctk.CTkLabel(
                self.chart_frame, 
                text="No hay datos con saldo positivo para mostrar.",
                font=ctk.CTkFont(size=14, slant="italic")
            )
            no_data_label.pack(pady=50, padx=20)
            print("  -> No hay datos para el gráfico.")
            return

        labels = list(chart_data.keys())
        sizes = list(chart_data.values())

        # Create matplotlib figure and axes with fixed background color
        fig, ax = plt.subplots(figsize=(6, 5), facecolor='#2b2b2b')  # Fondo oscuro para modo dark

        # Modern Look Settings
        colors = ['#66BB6A', '#42A5F5', '#FFEE58', '#AB47BC', '#FF7043', '#5C6BC0', '#EC407A', '#26C6DA'] # Paleta ligeramente más suave
        # Explode the largest slice slightly
        explode = [0.05 if s == max(sizes) else 0 for s in sizes] 
        # Wedge properties for donut effect and borders
        wedgeprops = {'width': 0.4, 'edgecolor': 'white', 'linewidth': 1}

        # Create the Donut chart
        wedges, texts, autotexts = ax.pie(
            sizes, 
            labels=None,  # No labels on pie (we'll use legend)
            autopct='%1.1f%%', 
            startangle=90, 
            pctdistance=0.8, # Adjust pct distance for donut
            colors=colors[:len(labels)],
            explode=explode,
            shadow=True, # Añadir sombra
            wedgeprops=wedgeprops # Aplicar donut y bordes
        )

        # Improve text appearance
        for autotext in autotexts:
            autotext.set_color('white')
            autotext.set_fontsize(9)
            autotext.set_fontweight('bold') # Negrita para porcentajes

        # Add legend instead of labels on pie
        ax.legend(
            wedges, 
            labels, 
            title="Categorías",
            loc="center left", 
            bbox_to_anchor=(0.95, 0, 0.5, 1), # Ajustar posición leyenda
            fontsize=10, # Tamaño fuente leyenda
            facecolor='#3c3f41', # Fondo leyenda oscuro
            edgecolor='#555555', # Borde leyenda
            labelcolor='white' # Color texto leyenda
        )
        
        # Make legend title white
        leg = ax.get_legend()
        leg.get_title().set_color('white')
        leg.get_title().set_fontweight('bold')

        # Equal aspect ratio ensures that pie is drawn as a circle.
        ax.axis('equal')  
        
        # Remove title (we already have one in the frame)
        # ax.set_title("Distribución de Saldos", color='white')
        
        fig.tight_layout()  # Adjust layout

        # Embed the chart in the Tkinter window
        canvas = FigureCanvasTkAgg(fig, master=self.chart_frame)
        self.canvas_widget = canvas.get_tk_widget()
        self.canvas_widget.pack(fill='both', expand=True, padx=10, pady=10)
        canvas.draw()
        print(f"  -> Gráfico (moderno) actualizado con {len(labels)} categorías.")

    def ui_add_category(self):
        """Callback para el botón 'Añadir Categoría'."""
        name = self.new_category_name_entry.get().strip()
        percentage_str = self.new_category_percentage_entry.get().strip()

        if not name:
            print(" Error UI (Añadir): El nombre no puede estar vacío.")
            messagebox.showwarning("Entrada Inválida", "El nombre de la categoría no puede estar vacío.")
            return

        try:
            percentage = float(percentage_str)
            if percentage < 0:
                 print(" Error UI (Añadir): El porcentaje no puede ser negativo.")
                 messagebox.showwarning("Entrada Inválida", "El porcentaje no puede ser negativo.")
                 return
        except ValueError:
            print(f" Error UI (Añadir): Porcentaje inválido '{percentage_str}'. Debe ser un número.")
            messagebox.showwarning("Entrada Inválida", f"El porcentaje '{percentage_str}' no es un número válido.")
            return
        
        # Use the database function to add
        try:
            add_category(name, percentage)
            print(f" Categoría '{name}' añadida a la BD.")
            self.new_category_name_entry.delete(0, 'end') # Clear input fields
            self.new_category_percentage_entry.delete(0, 'end')
            self.load_and_display_categories() # Refresh the list
            messagebox.showinfo("Éxito", f"Categoría '{name}' añadida correctamente.")
        except sqlite3.IntegrityError: # Catch duplicate name error
            print(f" Error DB (Añadir): El nombre de categoría '{name}' ya existe.")
            messagebox.showerror("Error Base de Datos", f"La categoría '{name}' ya existe. Por favor, elige otro nombre.")
        except Exception as e:
            print(f" Error inesperado (Añadir): {e}")
            messagebox.showerror("Error Inesperado", f"Ocurrió un error al añadir la categoría: {e}")

    def ui_update_category(self, category_id):
        """Callback para el botón 'Guardar' de una categoría existente."""
        print(f"Intentando guardar cambios para ID: {category_id}")

        if category_id not in self.category_entries:
            print(f" Error UI (Guardar): No se encontraron los campos de entrada para ID {category_id}")
            messagebox.showerror("Error Interno", "No se pudieron encontrar los campos para guardar esta categoría.")
            return

        name_entry = self.category_entries[category_id]['name_entry']
        percentage_entry = self.category_entries[category_id]['perc_entry']

        new_name = name_entry.get().strip()
        new_percentage_str = percentage_entry.get().strip()

        if not new_name:
            print(" Error UI (Guardar): El nombre no puede estar vacío.")
            messagebox.showwarning("Entrada Inválida", "El nombre de la categoría no puede estar vacío al guardar.")
            return

        try:
            new_percentage = float(new_percentage_str)
            if new_percentage < 0:
                 print(" Error UI (Guardar): El porcentaje no puede ser negativo.")
                 messagebox.showwarning("Entrada Inválida", "El porcentaje no puede ser negativo.")
                 return
        except ValueError:
            print(f" Error UI (Guardar): Porcentaje inválido '{new_percentage_str}'. Debe ser un número.")
            messagebox.showwarning("Entrada Inválida", f"El porcentaje '{new_percentage_str}' no es un número válido.")
            return

        # Llamar a la función de la base de datos
        success = update_category(category_id, new_name, new_percentage)

        if success:
            print(f"UI: Categoría ID {category_id} guardada correctamente.")
            # Podríamos añadir un feedback visual más claro aquí
            self.load_and_display_categories() 
        else:
            print(f"UI: No se pudo guardar la categoría ID {category_id}. Ver consola (posible duplicado).")
            messagebox.showerror("Error Base de Datos", f"No se pudo guardar la categoría '{new_name}'. Es posible que ese nombre ya exista.")

    def ui_delete_category(self, category_id, category_name):
        """Callback para el botón 'Eliminar' de una fila de categoría."""
        print(f"Intentando eliminar categoría ID: {category_id}, Nombre: {category_name}")
        
        # --- Confirmation Dialog ---
        confirm = messagebox.askyesno("Confirmar Eliminación", 
                                      f"¿Estás seguro de que quieres eliminar la categoría '{category_name}'?\n\n" 
                                      f"(Las transacciones asociadas quedarán sin categoría)")
        
        if not confirm:
            print("Eliminación cancelada por el usuario.")
            return

        # --- Call database function ---
        success = delete_category(category_id)

        if success:
            print(f"UI: Categoría ID {category_id} ('{category_name}') eliminada.")
            # Eliminar entradas de nuestro diccionario interno si aún existen (aunque load_and_display las limpia)
            if category_id in self.category_entries:
                del self.category_entries[category_id]
            self.load_and_display_categories() # Refresh list
        else:
            print(f"UI: No se pudo eliminar la categoría ID {category_id}. Ver consola.")
            messagebox.showerror("Error Base de Datos", f"No se pudo eliminar la categoría '{category_name}'.")

    def ui_distribute_income(self):
        """Callback para el botón 'Distribuir Ingreso'."""
        income_str = self.income_entry.get().strip()

        if not income_str:
            messagebox.showwarning("Entrada Inválida", "Por favor, introduce un monto de ingreso.")
            return

        try:
            income_amount = float(income_str)
            if income_amount <= 0:
                 messagebox.showwarning("Entrada Inválida", "El monto del ingreso debe ser positivo.")
                 return
        except ValueError:
            messagebox.showwarning("Entrada Inválida", f"El monto '{income_str}' no es un número válido.")
            return

        # Call the database function
        success = distribute_income(income_amount)

        if success:
            messagebox.showinfo("Éxito", f"Ingreso de {income_amount:.2f}€ distribuido correctamente.")
            self.income_entry.delete(0, 'end') # Clear the entry
            # Refresh the category list (even though balances aren't shown yet)
            # If we were showing balances, this would update them visually
            self.load_and_display_categories() # Refresh list first
            self.update_pie_chart() # THEN refresh chart
        else:
            # The database function already prints details, show a generic UI error
            messagebox.showerror("Error", "No se pudo distribuir el ingreso. Revisa la consola para más detalles o si tienes categorías con porcentajes asignados.")


if __name__ == '__main__':
    # Check if the database file exists, create tables if not
    app = FinanceApp()
    app.mainloop()
