import os
import tempfile
import unittest
from unittest.mock import patch

from src import database


class DatabaseTestCase(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.env_patch = patch.dict(
            os.environ, {"FINANZAS_DATA_DIR": self.temp_dir.name}
        )
        self.env_patch.start()
        database.create_tables()

    def tearDown(self):
        self.env_patch.stop()
        self.temp_dir.cleanup()

    def test_creates_database_in_configured_directory(self):
        self.assertEqual(
            database.get_db_path(),
            os.path.join(self.temp_dir.name, database.DATABASE_NAME),
        )
        self.assertTrue(os.path.isfile(database.get_db_path()))

    def test_category_crud(self):
        self.assertTrue(database.add_category("Ahorro", 25))
        category = database.get_all_categories()[0]
        self.assertEqual(category["name"], "Ahorro")
        self.assertTrue(database.update_category(category["id"], "Fondo", 30))
        self.assertEqual(database.get_category_by_id(category["id"])["name"], "Fondo")
        self.assertTrue(database.delete_category(category["id"]))
        self.assertEqual(database.get_all_categories(), [])


if __name__ == "__main__":
    unittest.main()
