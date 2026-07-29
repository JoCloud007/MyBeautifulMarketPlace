#!/usr/bin/env python3
"""Comprehensive Backend REST API tests for CloudMarket IaaS."""

import json
import unittest
import urllib.request
import urllib.error
import uuid

API = "http://localhost:3002"


def req(method, path, data=None):
    url = f"{API}{path}"
    headers = {"Content-Type": "application/json"}
    body = json.dumps(data).encode() if data else None
    r = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(r) as resp:
            return resp.status, resp.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()


def j(data):
    return json.loads(data) if data else {}


class TestHealth(unittest.TestCase):
    def test_health(self):
        status, data = req("GET", "/health")
        self.assertEqual(status, 200)
        body = j(data)
        self.assertEqual(body.get("status"), "ok")
        self.assertIn("timestamp", body)


class TestProducts(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Fetch existing seeded data references
        status, data = req("GET", "/api/categories")
        cls.categories = j(data)
        cls.cat_id = cls.categories[0]["id"]
        cls.cat_slug = cls.categories[0]["slug"]

        status, data = req("GET", "/api/products")
        cls.products = j(data)
        cls.prod = cls.products[0]
        cls.prod_id = cls.prod["id"]
        cls.prod_slug = cls.prod["slug"]
        cls.prod2_id = cls.products[2]["id"]

    def test_01_list_products(self):
        status, data = req("GET", "/api/products")
        self.assertEqual(status, 200)
        products = j(data)
        self.assertIsInstance(products, list)
        self.assertGreaterEqual(len(products), 1)
        # Verify structure
        for p in products:
            self.assertIn("id", p)
            self.assertIn("name", p)
            self.assertIn("slug", p)
            self.assertIn("category", p)
            self.assertIn("flavors", p)
            self.assertIn("dependencies", p)
            self.assertIn("dependentProducts", p)

    def test_02_get_product_by_slug(self):
        status, data = req("GET", f"/api/products/{self.prod_slug}")
        self.assertEqual(status, 200)
        p = j(data)
        self.assertEqual(p["id"], self.prod_id)
        self.assertIn("documentation", p)
        self.assertIn("roadmap", p)

    def test_03_get_product_not_found(self):
        status, data = req("GET", "/api/products/nonexistent-slug-12345")
        self.assertEqual(status, 404)
        self.assertIn("error", j(data))

    def test_04_filter_by_category(self):
        status, data = req("GET", f"/api/products?category={self.cat_slug}")
        self.assertEqual(status, 200)
        products = j(data)
        for p in products:
            self.assertEqual(p["category"]["slug"], self.cat_slug)

    def test_05_filter_by_os(self):
        status, data = req("GET", "/api/products?os=Linux")
        self.assertEqual(status, 200)
        products = j(data)
        for p in products:
            self.assertEqual(p.get("os"), "Linux")

    def test_06_filter_by_search(self):
        status, data = req("GET", "/api/products?search=debian")
        self.assertEqual(status, 200)
        products = j(data)
        for p in products:
            name = p.get("name", "").lower()
            desc = p.get("description", "").lower()
            self.assertTrue("debian" in name or "debian" in desc)

    def test_07_filter_by_flavor(self):
        status, data = req("GET", "/api/products?flavor=Small")
        self.assertEqual(status, 200)
        products = j(data)
        for p in products:
            flavor_names = [f["name"] for f in p.get("flavors", [])]
            self.assertIn("Small", flavor_names)

    def test_08_create_product(self):
        payload = {
            "name": "Test Product API",
            "slug": "test-product-api",
            "description": "Created via API test",
            "categoryId": self.cat_id,
            "os": "Linux",
        }
        status, data = req("POST", "/api/products", payload)
        self.assertEqual(status, 201)
        p = j(data)
        self.assertEqual(p["name"], payload["name"])
        self.assertEqual(p["slug"], payload["slug"])
        self.__class__.created_prod_id = p["id"]

    def test_09_create_product_duplicate_slug(self):
        payload = {
            "name": "Duplicate",
            "slug": self.prod_slug,
            "categoryId": self.cat_id,
        }
        status, data = req("POST", "/api/products", payload)
        self.assertEqual(status, 409)

    def test_10_create_product_invalid_slug(self):
        payload = {
            "name": "Bad Slug",
            "slug": "bad slug spaces",
            "categoryId": self.cat_id,
        }
        status, data = req("POST", "/api/products", payload)
        self.assertEqual(status, 400)
        body = j(data)
        self.assertEqual(body.get("error"), "Validation Error")

    def test_11_create_product_missing_name(self):
        payload = {"slug": "no-name", "categoryId": self.cat_id}
        status, data = req("POST", "/api/products", payload)
        self.assertEqual(status, 400)

    def test_12_create_product_invalid_category_uuid(self):
        payload = {
            "name": "Bad Cat",
            "slug": "bad-cat",
            "categoryId": "not-a-uuid",
        }
        status, data = req("POST", "/api/products", payload)
        self.assertEqual(status, 400)

    def test_13_update_product(self):
        # Depends on create test
        if not hasattr(self.__class__, "created_prod_id"):
            self.skipTest("Create product test did not run")
        status, data = req(
            "PATCH",
            f"/api/products/{self.__class__.created_prod_id}",
            {"name": "Test Product Updated"},
        )
        self.assertEqual(status, 200)
        self.assertEqual(j(data)["name"], "Test Product Updated")

    def test_14_update_product_not_found(self):
        fake_id = str(uuid.uuid4())
        status, data = req("PATCH", f"/api/products/{fake_id}", {"name": "Nope"})
        self.assertEqual(status, 404)

    def test_15_delete_product(self):
        if not hasattr(self.__class__, "created_prod_id"):
            self.skipTest("Create product test did not run")
        status, _ = req("DELETE", f"/api/products/{self.__class__.created_prod_id}")
        self.assertEqual(status, 204)

    def test_16_delete_product_not_found(self):
        fake_id = str(uuid.uuid4())
        status, data = req("DELETE", f"/api/products/{fake_id}")
        self.assertEqual(status, 404)

    def test_17_get_product_forecasts(self):
        # vm-debian-12 has forecasts in seed
        status, data = req("GET", "/api/products/vm-debian-12/forecasts")
        self.assertEqual(status, 200)
        forecasts = j(data)
        self.assertIsInstance(forecasts, list)

    def test_18_get_product_forecasts_not_found(self):
        status, data = req("GET", "/api/products/nonexistent-slug/forecasts")
        self.assertEqual(status, 404)


class TestCategories(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        status, data = req("GET", "/api/categories")
        cls.categories = j(data)
        cls.cat_id = cls.categories[0]["id"]
        cls.cat_slug = cls.categories[0]["slug"]

    def test_01_list_categories(self):
        status, data = req("GET", "/api/categories")
        self.assertEqual(status, 200)
        cats = j(data)
        self.assertGreaterEqual(len(cats), 4)  # Seed has 4
        for c in cats:
            self.assertIn("_count", c)
            self.assertIn("products", c["_count"])

    def test_02_get_category_by_slug(self):
        status, data = req("GET", f"/api/categories/{self.cat_slug}")
        self.assertEqual(status, 200)
        c = j(data)
        self.assertEqual(c["id"], self.cat_id)
        self.assertIn("products", c)

    def test_03_get_category_not_found(self):
        status, data = req("GET", "/api/categories/nonexistent")
        self.assertEqual(status, 404)

    def test_04_create_category(self):
        payload = {
            "name": "TestCategoryAPI",
            "slug": "test-category-api",
            "description": "Test category",
        }
        status, data = req("POST", "/api/categories", payload)
        self.assertEqual(status, 201)
        c = j(data)
        self.assertEqual(c["name"], payload["name"])
        self.__class__.created_cat_id = c["id"]

    def test_05_create_category_duplicate_slug(self):
        payload = {"name": "Dup", "slug": self.cat_slug}
        status, data = req("POST", "/api/categories", payload)
        self.assertEqual(status, 409)

    def test_06_update_category(self):
        if not hasattr(self.__class__, "created_cat_id"):
            self.skipTest("Create category test did not run")
        status, data = req(
            "PATCH",
            f"/api/categories/{self.__class__.created_cat_id}",
            {"description": "Updated desc"},
        )
        self.assertEqual(status, 200)
        self.assertEqual(j(data)["description"], "Updated desc")

    def test_07_delete_category(self):
        if not hasattr(self.__class__, "created_cat_id"):
            self.skipTest("Create category test did not run")
        status, _ = req("DELETE", f"/api/categories/{self.__class__.created_cat_id}")
        self.assertEqual(status, 204)

    def test_08_delete_category_with_products_fails(self):
        # Try deleting a category that has products
        status, data = req("DELETE", f"/api/categories/{self.cat_id}")
        self.assertEqual(status, 409)
        body = j(data)
        self.assertIn("Cannot delete category", body.get("error", ""))


class TestFlavors(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        status, data = req("GET", "/api/products")
        cls.prod_id = j(data)[0]["id"]
        status, data = req("GET", "/api/flavors")
        cls.flavors = j(data)
        cls.flavor_id = cls.flavors[0]["id"]

    def test_01_list_flavors(self):
        status, data = req("GET", "/api/flavors")
        self.assertEqual(status, 200)
        flavors = j(data)
        self.assertGreaterEqual(len(flavors), 1)
        for f in flavors:
            self.assertIn("product", f)
            self.assertIn("_count", f)

    def test_02_list_flavors_by_product(self):
        status, data = req("GET", f"/api/flavors?productId={self.prod_id}")
        self.assertEqual(status, 200)
        flavors = j(data)
        for f in flavors:
            self.assertEqual(f["productId"], self.prod_id)

    def test_03_get_flavor(self):
        status, data = req("GET", f"/api/flavors/{self.flavor_id}")
        self.assertEqual(status, 200)
        f = j(data)
        self.assertEqual(f["id"], self.flavor_id)

    def test_04_get_flavor_not_found(self):
        fake_id = str(uuid.uuid4())
        status, data = req("GET", f"/api/flavors/{fake_id}")
        self.assertEqual(status, 404)

    def test_05_create_flavor(self):
        payload = {
            "name": "TinyTest",
            "vcpu": 1,
            "ramGb": 2,
            "productId": self.prod_id,
        }
        status, data = req("POST", "/api/flavors", payload)
        self.assertEqual(status, 201)
        f = j(data)
        self.assertEqual(f["name"], payload["name"])
        self.assertEqual(f["vcpu"], 1)
        self.__class__.created_flavor_id = f["id"]

    def test_06_create_flavor_invalid_product(self):
        payload = {
            "name": "BadProd",
            "vcpu": 1,
            "ramGb": 2,
            "productId": str(uuid.uuid4()),
        }
        status, data = req("POST", "/api/flavors", payload)
        self.assertEqual(status, 404)

    def test_07_create_flavor_negative_vcpu(self):
        payload = {
            "name": "BadVcpu",
            "vcpu": -1,
            "ramGb": 2,
            "productId": self.prod_id,
        }
        status, data = req("POST", "/api/flavors", payload)
        self.assertEqual(status, 400)

    def test_08_update_flavor(self):
        if not hasattr(self.__class__, "created_flavor_id"):
            self.skipTest("Create flavor test did not run")
        status, data = req(
            "PATCH",
            f"/api/flavors/{self.__class__.created_flavor_id}",
            {"ramGb": 4},
        )
        self.assertEqual(status, 200)
        self.assertEqual(j(data)["ramGb"], 4)

    def test_09_delete_flavor(self):
        if not hasattr(self.__class__, "created_flavor_id"):
            self.skipTest("Create flavor test did not run")
        status, _ = req("DELETE", f"/api/flavors/{self.__class__.created_flavor_id}")
        self.assertEqual(status, 204)

    def test_10_delete_flavor_with_forecasts_fails(self):
        # Find a flavor that has forecasts
        flavor_with_forecasts = None
        for f in self.flavors:
            if f.get("_count", {}).get("forecasts", 0) > 0:
                flavor_with_forecasts = f["id"]
                break
        if not flavor_with_forecasts:
            self.skipTest("No flavor with forecasts found")
        status, data = req("DELETE", f"/api/flavors/{flavor_with_forecasts}")
        self.assertEqual(status, 409)
        self.assertIn("Cannot delete flavor", j(data).get("error", ""))


class TestDependencies(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        status, data = req("GET", "/api/products")
        products = j(data)
        cls.prod1_id = products[0]["id"]
        cls.prod2_id = products[1]["id"]
        cls.prod3_id = products[2]["id"]
        status, data = req("GET", "/api/dependencies")
        cls.deps = j(data)

    def test_01_list_dependencies(self):
        status, data = req("GET", "/api/dependencies")
        self.assertEqual(status, 200)
        deps = j(data)
        self.assertIsInstance(deps, list)
        for d in deps:
            self.assertIn("product", d)
            self.assertIn("dependsOn", d)
            self.assertIn(d["type"], ["REQUIRED", "RECOMMENDED"])

    def test_02_list_dependencies_by_product(self):
        status, data = req("GET", f"/api/dependencies?productId={self.prod1_id}")
        self.assertEqual(status, 200)
        deps = j(data)
        for d in deps:
            self.assertEqual(d["productId"], self.prod1_id)

    def test_03_get_dependency(self):
        if not self.deps:
            self.skipTest("No dependencies in database")
        dep_id = self.deps[0]["id"]
        status, data = req("GET", f"/api/dependencies/{dep_id}")
        self.assertEqual(status, 200)
        self.assertEqual(j(data)["id"], dep_id)

    def test_04_get_dependency_not_found(self):
        fake_id = str(uuid.uuid4())
        status, data = req("GET", f"/api/dependencies/{fake_id}")
        self.assertEqual(status, 404)

    def test_05_create_dependency(self):
        # Find a product pair that does not already have a dependency
        existing_pairs = {(d["productId"], d["dependsOnId"]) for d in self.deps}
        payload = None
        for p1 in [self.prod1_id, self.prod2_id, self.prod3_id]:
            for p2 in [self.prod1_id, self.prod2_id, self.prod3_id]:
                if p1 != p2 and (p1, p2) not in existing_pairs:
                    payload = {
                        "productId": p1,
                        "dependsOnId": p2,
                        "type": "RECOMMENDED",
                        "description": "Test dependency",
                    }
                    break
            if payload:
                break
        self.assertIsNotNone(payload, "No available product pair without existing dependency")
        status, data = req("POST", "/api/dependencies", payload)
        self.assertEqual(status, 201)
        d = j(data)
        self.assertEqual(d["type"], "RECOMMENDED")
        self.__class__.created_dep_id = d["id"]

    def test_06_create_self_dependency_fails(self):
        payload = {
            "productId": self.prod1_id,
            "dependsOnId": self.prod1_id,
            "type": "REQUIRED",
        }
        status, data = req("POST", "/api/dependencies", payload)
        self.assertEqual(status, 400)
        self.assertIn("cannot depend on itself", j(data).get("error", "").lower())

    def test_07_create_duplicate_dependency_fails(self):
        # Create a dependency then try to recreate it
        payload = {
            "productId": self.prod2_id,
            "dependsOnId": self.prod3_id,
            "type": "REQUIRED",
        }
        status, data = req("POST", "/api/dependencies", payload)
        self.assertIn(status, [201, 409])
        if status == 201:
            self.__class__.dup_dep_id = j(data)["id"]
            status2, data2 = req("POST", "/api/dependencies", payload)
            self.assertEqual(status2, 409)

    def test_08_create_dependency_invalid_product(self):
        payload = {
            "productId": str(uuid.uuid4()),
            "dependsOnId": self.prod2_id,
            "type": "REQUIRED",
        }
        status, data = req("POST", "/api/dependencies", payload)
        self.assertEqual(status, 404)

    def test_09_update_dependency(self):
        if not hasattr(self.__class__, "created_dep_id"):
            self.skipTest("Create dependency test did not run")
        status, data = req(
            "PATCH",
            f"/api/dependencies/{self.__class__.created_dep_id}",
            {"type": "REQUIRED"},
        )
        self.assertEqual(status, 200)
        self.assertEqual(j(data)["type"], "REQUIRED")

    def test_10_delete_dependency(self):
        if not hasattr(self.__class__, "created_dep_id"):
            self.skipTest("Create dependency test did not run")
        status, _ = req("DELETE", f"/api/dependencies/{self.__class__.created_dep_id}")
        self.assertEqual(status, 204)
        if hasattr(self.__class__, "dup_dep_id"):
            req("DELETE", f"/api/dependencies/{self.__class__.dup_dep_id}")


class TestForecasts(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        status, data = req("GET", "/api/products")
        products = j(data)
        cls.prod_id = products[0]["id"]
        # Get a flavor for this product
        status, data = req("GET", f"/api/flavors?productId={cls.prod_id}")
        flavors = j(data)
        cls.flavor_id = flavors[0]["id"]
        status, data = req("GET", "/api/forecasts")
        cls.forecasts = j(data)

    def test_01_list_forecasts(self):
        status, data = req("GET", "/api/forecasts")
        self.assertEqual(status, 200)
        forecasts = j(data)
        self.assertIsInstance(forecasts, list)
        for f in forecasts:
            self.assertIn("product", f)
            self.assertIn("flavor", f)
            self.assertIn(f["status"], ["PENDING", "APPROVED", "REJECTED"])

    def test_02_get_forecasts_stats(self):
        status, data = req("GET", "/api/forecasts/stats")
        self.assertEqual(status, 200)
        stats = j(data)
        self.assertIn("total", stats)
        self.assertIn("pending", stats)
        self.assertIn("approved", stats)
        self.assertIn("rejected", stats)
        self.assertEqual(
            stats["total"],
            stats["pending"] + stats["approved"] + stats["rejected"],
        )

    def test_03_create_forecast(self):
        payload = {
            "productId": self.prod_id,
            "flavorId": self.flavor_id,
            "requestedBy": "Test Runner",
            "requesterEmail": "test@example.com",
            "quantity": 5,
            "justification": "Automated test forecast",
        }
        status, data = req("POST", "/api/forecasts", payload)
        self.assertEqual(status, 201)
        f = j(data)
        self.assertEqual(f["quantity"], 5)
        self.assertEqual(f["status"], "PENDING")
        self.__class__.created_forecast_id = f["id"]

    def test_04_create_forecast_invalid_email(self):
        payload = {
            "productId": self.prod_id,
            "flavorId": self.flavor_id,
            "requestedBy": "Test",
            "requesterEmail": "not-an-email",
            "quantity": 1,
        }
        status, data = req("POST", "/api/forecasts", payload)
        self.assertEqual(status, 400)

    def test_05_create_forecast_zero_quantity(self):
        payload = {
            "productId": self.prod_id,
            "flavorId": self.flavor_id,
            "requestedBy": "Test",
            "requesterEmail": "test@example.com",
            "quantity": 0,
        }
        status, data = req("POST", "/api/forecasts", payload)
        self.assertEqual(status, 400)

    def test_06_update_forecast_status(self):
        if not hasattr(self.__class__, "created_forecast_id"):
            self.skipTest("Create forecast test did not run")
        status, data = req(
            "PATCH",
            f"/api/forecasts/{self.__class__.created_forecast_id}",
            {"status": "APPROVED", "reviewedBy": "Test Admin"},
        )
        self.assertEqual(status, 200)
        f = j(data)
        self.assertEqual(f["status"], "APPROVED")
        self.assertEqual(f["reviewedBy"], "Test Admin")
        self.assertIsNotNone(f.get("reviewedAt"))

    def test_07_update_forecast_invalid_status(self):
        if not hasattr(self.__class__, "created_forecast_id"):
            self.skipTest("Create forecast test did not run")
        status, data = req(
            "PATCH",
            f"/api/forecasts/{self.__class__.created_forecast_id}",
            {"status": "INVALID", "reviewedBy": "Test"},
        )
        self.assertEqual(status, 400)

    def test_08_delete_forecast(self):
        if not hasattr(self.__class__, "created_forecast_id"):
            self.skipTest("Create forecast test did not run")
        status, _ = req("DELETE", f"/api/forecasts/{self.__class__.created_forecast_id}")
        self.assertEqual(status, 204)


class TestUsers(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        status, data = req("GET", "/api/users")
        cls.users = j(data)
        cls.user_id = cls.users[0]["id"] if cls.users else None

    def test_01_list_users(self):
        status, data = req("GET", "/api/users")
        self.assertEqual(status, 200)
        users = j(data)
        self.assertIsInstance(users, list)
        for u in users:
            self.assertIn("email", u)
            self.assertIn("name", u)
            self.assertIn("role", u)

    def test_02_get_user(self):
        if not self.user_id:
            self.skipTest("No users in database")
        status, data = req("GET", f"/api/users/{self.user_id}")
        self.assertEqual(status, 200)
        self.assertEqual(j(data)["id"], self.user_id)

    def test_03_get_user_not_found(self):
        fake_id = str(uuid.uuid4())
        status, data = req("GET", f"/api/users/{fake_id}")
        self.assertEqual(status, 404)

    def test_04_create_user(self):
        payload = {
            "email": "test-api-user@example.com",
            "name": "Test API User",
            "role": "USER",
        }
        status, data = req("POST", "/api/users", payload)
        self.assertEqual(status, 201)
        u = j(data)
        self.assertEqual(u["email"], payload["email"])
        self.assertEqual(u["role"], "USER")
        self.__class__.created_user_id = u["id"]

    def test_05_create_user_duplicate_email(self):
        if not self.user_id:
            self.skipTest("No users in database")
        existing_email = self.users[0]["email"]
        payload = {"email": existing_email, "name": "Dup"}
        status, data = req("POST", "/api/users", payload)
        self.assertEqual(status, 409)

    def test_06_create_user_invalid_email(self):
        payload = {"email": "not-email", "name": "Bad"}
        status, data = req("POST", "/api/users", payload)
        self.assertEqual(status, 400)

    def test_07_update_user(self):
        if not hasattr(self.__class__, "created_user_id"):
            self.skipTest("Create user test did not run")
        status, data = req(
            "PATCH",
            f"/api/users/{self.__class__.created_user_id}",
            {"name": "Updated Name"},
        )
        self.assertEqual(status, 200)
        self.assertEqual(j(data)["name"], "Updated Name")

    def test_08_update_user_duplicate_email(self):
        if not self.user_id or not hasattr(self.__class__, "created_user_id"):
            self.skipTest("Prerequisites not met")
        existing_email = self.users[0]["email"]
        status, data = req(
            "PATCH",
            f"/api/users/{self.__class__.created_user_id}",
            {"email": existing_email},
        )
        self.assertEqual(status, 409)

    def test_09_delete_user(self):
        if not hasattr(self.__class__, "created_user_id"):
            self.skipTest("Create user test did not run")
        status, _ = req("DELETE", f"/api/users/{self.__class__.created_user_id}")
        self.assertEqual(status, 204)


class TestAdminRoutes(unittest.TestCase):
    def test_01_dashboard(self):
        status, data = req("GET", "/api/admin/dashboard")
        self.assertEqual(status, 200)
        d = j(data)
        self.assertIn("counts", d)
        self.assertIn("recentForecasts", d)
        counts = d["counts"]
        self.assertIn("products", counts)
        self.assertIn("categories", counts)
        self.assertIn("forecasts", counts)
        self.assertIn("users", counts)

    def test_02_admin_products(self):
        status, data = req("GET", "/api/admin/products")
        self.assertEqual(status, 200)
        products = j(data)
        self.assertIsInstance(products, list)
        for p in products:
            self.assertIn("_count", p)
            self.assertIn("forecasts", p["_count"])

    def test_03_admin_categories(self):
        status, data = req("GET", "/api/admin/categories")
        self.assertEqual(status, 200)
        self.assertIsInstance(j(data), list)

    def test_04_admin_flavors(self):
        status, data = req("GET", "/api/admin/flavors")
        self.assertEqual(status, 200)
        self.assertIsInstance(j(data), list)

    def test_05_admin_dependencies(self):
        status, data = req("GET", "/api/admin/dependencies")
        self.assertEqual(status, 200)
        self.assertIsInstance(j(data), list)

    def test_06_admin_forecasts(self):
        status, data = req("GET", "/api/admin/forecasts")
        self.assertEqual(status, 200)
        self.assertIsInstance(j(data), list)

    def test_07_admin_users(self):
        status, data = req("GET", "/api/admin/users")
        self.assertEqual(status, 200)
        self.assertIsInstance(j(data), list)

    def test_08_admin_create_product(self):
        status, data = req("GET", "/api/categories")
        cat_id = j(data)[0]["id"]
        payload = {
            "name": "Admin Product",
            "slug": "admin-product",
            "categoryId": cat_id,
        }
        status, data = req("POST", "/api/admin/products", payload)
        self.assertEqual(status, 201)
        p = j(data)
        self.__class__.admin_prod_id = p["id"]

    def test_09_admin_update_product(self):
        if not hasattr(self.__class__, "admin_prod_id"):
            self.skipTest("Admin create product did not run")
        status, data = req(
            "PATCH",
            f"/api/admin/products/{self.__class__.admin_prod_id}",
            {"name": "Admin Product Updated"},
        )
        self.assertEqual(status, 200)
        self.assertEqual(j(data)["name"], "Admin Product Updated")

    def test_10_admin_delete_product(self):
        if not hasattr(self.__class__, "admin_prod_id"):
            self.skipTest("Admin create product did not run")
        status, _ = req("DELETE", f"/api/admin/products/{self.__class__.admin_prod_id}")
        self.assertEqual(status, 204)

    def test_11_admin_create_category(self):
        payload = {"name": "AdminCat", "slug": "admin-cat"}
        status, data = req("POST", "/api/admin/categories", payload)
        self.assertEqual(status, 201)
        self.__class__.admin_cat_id = j(data)["id"]

    def test_12_admin_delete_category(self):
        if not hasattr(self.__class__, "admin_cat_id"):
            self.skipTest("Admin create category did not run")
        status, _ = req("DELETE", f"/api/admin/categories/{self.__class__.admin_cat_id}")
        self.assertEqual(status, 204)

    def test_13_admin_create_flavor(self):
        status, data = req("GET", "/api/products")
        prod_id = j(data)[0]["id"]
        payload = {"name": "AdminFlavor", "vcpu": 2, "ramGb": 4}
        status, data = req("POST", f"/api/admin/products/{prod_id}/flavors", payload)
        self.assertEqual(status, 201)
        self.__class__.admin_flavor_id = j(data)["id"]

    def test_14_admin_update_flavor(self):
        if not hasattr(self.__class__, "admin_flavor_id"):
            self.skipTest("Admin create flavor did not run")
        status, data = req(
            "PATCH",
            f"/api/admin/flavors/{self.__class__.admin_flavor_id}",
            {"ramGb": 8},
        )
        self.assertEqual(status, 200)
        self.assertEqual(j(data)["ramGb"], 8)

    def test_15_admin_delete_flavor(self):
        if not hasattr(self.__class__, "admin_flavor_id"):
            self.skipTest("Admin create flavor did not run")
        status, _ = req("DELETE", f"/api/admin/flavors/{self.__class__.admin_flavor_id}")
        self.assertEqual(status, 204)

    def test_16_admin_create_user(self):
        payload = {"email": "admin-test@example.com", "name": "Admin Test"}
        status, data = req("POST", "/api/admin/users", payload)
        self.assertEqual(status, 201)
        self.__class__.admin_user_id = j(data)["id"]

    def test_17_admin_update_user(self):
        if not hasattr(self.__class__, "admin_user_id"):
            self.skipTest("Admin create user did not run")
        status, data = req(
            "PATCH",
            f"/api/admin/users/{self.__class__.admin_user_id}",
            {"name": "Updated Admin"},
        )
        self.assertEqual(status, 200)

    def test_18_admin_delete_user(self):
        if not hasattr(self.__class__, "admin_user_id"):
            self.skipTest("Admin create user did not run")
        status, _ = req("DELETE", f"/api/admin/users/{self.__class__.admin_user_id}")
        self.assertEqual(status, 204)

    def test_19_admin_create_dependency(self):
        status, data = req("GET", "/api/products")
        products = j(data)
        status, data = req("GET", "/api/dependencies")
        deps = j(data)
        existing_pairs = {(d["productId"], d["dependsOnId"]) for d in deps}
        payload = None
        for i, p1 in enumerate(products):
            for p2 in products[i+1:]:
                p1_id, p2_id = p1["id"], p2["id"]
                if (p1_id, p2_id) not in existing_pairs and (p2_id, p1_id) not in existing_pairs:
                    payload = {"productId": p1_id, "dependsOnId": p2_id, "type": "RECOMMENDED"}
                    break
            if payload:
                break
        self.assertIsNotNone(payload, "No available product pair without existing dependency")
        status, data = req("POST", "/api/admin/dependencies", payload)
        self.assertEqual(status, 201)
        self.__class__.admin_dep_id = j(data)["id"]

    def test_20_admin_update_dependency(self):
        if not hasattr(self.__class__, "admin_dep_id"):
            self.skipTest("Admin create dependency did not run")
        status, data = req(
            "PATCH",
            f"/api/admin/dependencies/{self.__class__.admin_dep_id}",
            {"type": "REQUIRED"},
        )
        self.assertEqual(status, 200)
        self.assertEqual(j(data)["type"], "REQUIRED")

    def test_21_admin_delete_dependency(self):
        if not hasattr(self.__class__, "admin_dep_id"):
            self.skipTest("Admin create dependency did not run")
        status, _ = req("DELETE", f"/api/admin/dependencies/{self.__class__.admin_dep_id}")
        self.assertEqual(status, 204)


class Test404Handler(unittest.TestCase):
    def test_unknown_route(self):
        status, data = req("GET", "/api/unknown-route-that-does-not-exist")
        self.assertEqual(status, 404)
        self.assertIn("error", j(data))


if __name__ == "__main__":
    # Use verbosity=2 for detailed test output
    unittest.main(verbosity=2)
