# Create your tests here.

from django.test import TestCase


class MigrationSmokeTest(TestCase):
    def test_migrations_apply(self):
        # This test will always pass, but ensures migrations are applied
        self.assertTrue(True)
