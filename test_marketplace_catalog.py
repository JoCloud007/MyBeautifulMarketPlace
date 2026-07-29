#!/usr/bin/env python3
"""
Tests for the "Marketplace Catalog & Product Details" feature.

Covers:
- Marketplace catalog listing with filters (category, OS, search, flavor)
- Product detail pages (description, documentation, roadmap, dependencies)
- Edge cases (empty results, 404s, validation, case-insensitive search)
- Data integrity (flavors, dependencies, category nesting)
"""

import json
import urllib.request
import urllib.error
import sys

API = "http://localhost:3002"

PASS = 0
FAIL = 0
FAILED_TESTS = []


def req(method, path, data=None):
    """Make an HTTP request and return (status, body_json)."""
    url = f"{API}{path}"
    headers = {"Content-Type": "application/json"}
    body = json.dumps(data).encode() if data else None
    r = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(r) as resp:
            return resp.status, json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        try:
            body = json.loads(e.read().decode())
        except Exception:
            body = {"raw": e.read().decode()}
        return e.code, body
    except Exception as e:
        return -1, {"error": str(e)}


def assert_eq(name, got, expected):
    global PASS, FAIL, FAILED_TESTS
    if got == expected:
        PASS += 1
        print(f"  ✓ {name}")
    else:
        FAIL += 1
        FAILED_TESTS.append(name)
        print(f"  ✗ {name} — got {got!r}, expected {expected!r}")


def assert_true(name, condition):
    global PASS, FAIL, FAILED_TESTS
    if condition:
        PASS += 1
        print(f"  ✓ {name}")
    else:
        FAIL += 1
        FAILED_TESTS.append(name)
        print(f"  ✗ {name} — condition was False")


def assert_in(name, item, container):
    global PASS, FAIL, FAILED_TESTS
    if item in container:
        PASS += 1
        print(f"  ✓ {name}")
    else:
        FAIL += 1
        FAILED_TESTS.append(name)
        print(f"  ✗ {name} — {item!r} not in {container!r}")


# =============================================================================
# 1. MARKETPLACE CATALOG
# =============================================================================
print("=" * 60)
print("SUITE 1: Marketplace Catalog")
print("=" * 60)

# 1.1 List all active products
status, products = req("GET", "/api/products")
assert_eq("GET /api/products returns 200", status, 200)
assert_true("Products list is non-empty", isinstance(products, list) and len(products) > 0)

# Store reference data
product_slugs = {p["slug"] for p in products}
product_ids = {p["id"] for p in products}
first_product = products[0] if products else {}

# 1.2 Each product has required fields
for field in ["id", "name", "slug", "description", "category", "flavors", "dependencies", "isActive", "createdAt"]:
    assert_true(f"Product has '{field}'", all(field in p for p in products))

# 1.3 Inactive products are excluded
assert_true("All returned products are active", all(p.get("isActive") is True for p in products))

# 1.4 Categories are populated
assert_true("Products have category populated", all(p.get("category") and isinstance(p["category"], dict) for p in products))
assert_true("Category has name", all(p["category"].get("name") for p in products))

# 1.5 Flavors are populated
assert_true("Products have flavors array", all(isinstance(p.get("flavors"), list) for p in products))

# 1.6 Dependencies include nested dependsOn
if any(p.get("dependencies") for p in products):
    dep_products = [p for p in products if p.get("dependencies")]
    for p in dep_products:
        for d in p["dependencies"]:
            assert_true(f"Dependency {d.get('id','')} has dependsOn", isinstance(d.get("dependsOn"), dict))
            assert_true(f"Dependency dependsOn has name", d["dependsOn"].get("name") is not None)

# 1.7 Filter by category
status, compute_products = req("GET", "/api/products?category=compute")
assert_eq("Filter by category=compute returns 200", status, 200)
assert_true("Category filter returns non-empty list", isinstance(compute_products, list) and len(compute_products) > 0)
assert_true("All compute products have compute category", all(p["category"]["slug"] == "compute" for p in compute_products))

# 1.8 Filter by OS
status, linux_products = req("GET", "/api/products?os=Linux")
assert_eq("Filter by os=Linux returns 200", status, 200)
assert_true("OS filter returns non-empty list", isinstance(linux_products, list) and len(linux_products) > 0)
assert_true("All Linux products have os=Linux", all(p.get("os") == "Linux" for p in linux_products))

# 1.9 Filter by OS case-insensitivity (edge case)
status, linux_upper = req("GET", "/api/products?os=linux")
assert_eq("Filter by os=linux (lowercase) returns 200", status, 200)
assert_eq("Case-insensitive OS filter returns same results", len(linux_upper), len(linux_products))

# 1.10 Search by name
status, search_debian = req("GET", "/api/products?search=Debian")
assert_eq("Search 'Debian' returns 200", status, 200)
assert_true("Search returns results", isinstance(search_debian, list) and len(search_debian) > 0)
assert_true("Search results contain 'Debian' in name", any("Debian" in p["name"] for p in search_debian))

# 1.11 Search by description
status, search_storage = req("GET", "/api/products?search=durability")
assert_eq("Search description word returns 200", status, 200)
assert_true("Description search returns results", isinstance(search_storage, list) and len(search_storage) > 0)

# 1.12 Search case-insensitive
status, search_upper = req("GET", "/api/products?search=DEBIAN")
assert_eq("Search 'DEBIAN' (uppercase) returns 200", status, 200)
assert_eq("Case-insensitive search returns same count", len(search_upper), len(search_debian))

# 1.13 Filter by flavor
status, small_flavor = req("GET", "/api/products?flavor=Small")
assert_eq("Filter by flavor=Small returns 200", status, 200)
assert_true("Flavor filter returns non-empty list", isinstance(small_flavor, list) and len(small_flavor) > 0)
assert_true("All Small-flavor products have Small flavor", all(any(f["name"] == "Small" for f in p["flavors"]) for p in small_flavor))

# 1.14 Combined filters
status, combined = req("GET", "/api/products?category=compute&os=Linux")
assert_eq("Combined filters return 200", status, 200)
assert_true("Combined filters return results", isinstance(combined, list) and len(combined) > 0)
assert_true("Combined: all compute", all(p["category"]["slug"] == "compute" for p in combined))
assert_true("Combined: all Linux", all(p.get("os") == "Linux" for p in combined))

# 1.15 Filter with no matches
status, no_match = req("GET", "/api/products?search=xyznonexistent123")
assert_eq("No-match search returns 200", status, 200)
assert_eq("No-match search returns empty list", no_match, [])

# 1.16 Invalid category returns empty (no 500)
status, invalid_cat = req("GET", "/api/products?category=nonexistent-category-slug")
assert_eq("Invalid category filter returns 200", status, 200)
assert_eq("Invalid category returns empty list", invalid_cat, [])

# =============================================================================
# 2. CATEGORIES ENDPOINT
# =============================================================================
print("\n" + "=" * 60)
print("SUITE 2: Categories")
print("=" * 60)

status, categories = req("GET", "/api/categories")
assert_eq("GET /api/categories returns 200", status, 200)
assert_true("Categories list is non-empty", isinstance(categories, list) and len(categories) > 0)

cat_slugs = {c["slug"] for c in categories}
assert_in("Has 'compute' category", "compute", cat_slugs)
assert_in("Has 'data' category", "data", cat_slugs)
assert_in("Has 'hypervisor' category", "hypervisor", cat_slugs)
assert_in("Has 'citrix' category", "citrix", cat_slugs)

for c in categories:
    assert_true(f"Category {c['slug']} has _count", "_count" in c)
    assert_true(f"Category {c['slug']} has icon", c.get("icon") is not None)

# Category detail
status, cat_detail = req("GET", "/api/categories/compute")
assert_eq("GET /api/categories/compute returns 200", status, 200)
assert_eq("Category detail slug", cat_detail.get("slug"), "compute")
assert_true("Category detail has products", isinstance(cat_detail.get("products"), list))

# 404 for non-existent category
status, _ = req("GET", "/api/categories/nonexistent")
assert_eq("GET nonexistent category returns 404", status, 404)


# =============================================================================
# 3. PRODUCT DETAILS
# =============================================================================
print("\n" + "=" * 60)
print("SUITE 3: Product Details")
print("=" * 60)

# 3.1 Get a known product
status, debian = req("GET", "/api/products/vm-debian-12")
assert_eq("GET /api/products/vm-debian-12 returns 200", status, 200)
assert_eq("Product name matches", debian.get("name"), "VM Debian 12")
assert_eq("Product slug matches", debian.get("slug"), "vm-debian-12")
assert_eq("Product OS matches", debian.get("os"), "Linux")
assert_true("Product has category", isinstance(debian.get("category"), dict))
assert_eq("Product category slug", debian["category"].get("slug"), "compute")

# 3.2 Product has flavors with specs
assert_true("Debian has flavors", isinstance(debian.get("flavors"), list) and len(debian["flavors"]) > 0)
flavor_names = {f["name"] for f in debian["flavors"]}
assert_in("Has Small flavor", "Small", flavor_names)
assert_in("Has Medium flavor", "Medium", flavor_names)
assert_in("Has Large flavor", "Large", flavor_names)
assert_in("Has XL flavor", "XL", flavor_names)

# Check flavor specs
small = next((f for f in debian["flavors"] if f["name"] == "Small"), None)
assert_true("Small flavor found", small is not None)
if small:
    assert_eq("Small vCPU", small.get("vcpu"), 2)
    assert_eq("Small RAM", small.get("ramGb"), 4)

xl = next((f for f in debian["flavors"] if f["name"] == "XL"), None)
assert_true("XL flavor found", xl is not None)
if xl:
    assert_eq("XL vCPU", xl.get("vcpu"), 16)
    assert_eq("XL RAM", xl.get("ramGb"), 32)

# 3.3 Product has documentation and roadmap
assert_true("Debian has documentation", debian.get("documentation") is not None)
assert_true("Debian has roadmap", debian.get("roadmap") is not None)
assert_true("Documentation contains markdown", "#" in debian.get("documentation", ""))
assert_true("Roadmap contains markdown", "#" in debian.get("roadmap", ""))

# 3.4 Product dependencies
if debian.get("dependencies"):
    for dep in debian["dependencies"]:
        assert_true(f"Dependency has id", dep.get("id") is not None)
        assert_true(f"Dependency has type", dep.get("type") in ("REQUIRED", "RECOMMENDED"))
        assert_true(f"Dependency has dependsOn", isinstance(dep.get("dependsOn"), dict))
        assert_true(f"dependsOn has name", dep["dependsOn"].get("name") is not None)
        assert_true(f"dependsOn has category", isinstance(dep["dependsOn"].get("category"), dict))

# 3.5 Product with storage flavors (no vCPU/RAM)
status, obj_storage = req("GET", "/api/products/object-storage")
assert_eq("GET object-storage returns 200", status, 200)
if obj_storage and obj_storage.get("flavors"):
    storage_flavor = obj_storage["flavors"][0]
    assert_eq("Storage flavor has 0 vCPU", storage_flavor.get("vcpu"), 0)
    assert_eq("Storage flavor has 0 RAM", storage_flavor.get("ramGb"), 0)
    assert_true("Storage flavor has description", storage_flavor.get("description") is not None)

# 3.6 Product with REQUIRED dependency
status, citrix_vdi = req("GET", "/api/products/citrix-vdi")
assert_eq("GET citrix-vdi returns 200", status, 200)
if citrix_vdi and citrix_vdi.get("dependencies"):
    required_deps = [d for d in citrix_vdi["dependencies"] if d["type"] == "REQUIRED"]
    assert_true("Citrix VDI has at least one REQUIRED dependency", len(required_deps) > 0)
    if required_deps:
        assert_eq("Required dep is VMware", required_deps[0]["dependsOn"]["slug"], "vmware-vsphere")

# 3.7 Non-existent product returns 404
status, not_found = req("GET", "/api/products/nonexistent-product")
assert_eq("GET nonexistent product returns 404", status, 404)
assert_in("404 body has error", "error", not_found)

# 3.8 Product forecasts endpoint
if first_product:
    status, forecasts = req("GET", f"/api/products/{first_product['slug']}/forecasts")
    assert_eq("GET product forecasts returns 200", status, 200)
    assert_true("Forecasts is a list", isinstance(forecasts, list))

# =============================================================================
# 4. DEPENDENCIES ENDPOINT
# =============================================================================
print("\n" + "=" * 60)
print("SUITE 4: Dependencies")
print("=" * 60)

status, all_deps = req("GET", "/api/dependencies")
assert_eq("GET /api/dependencies returns 200", status, 200)
assert_true("Dependencies list is a list", isinstance(all_deps, list))

if all_deps:
    for dep in all_deps:
        assert_true("Dependency has product", isinstance(dep.get("product"), dict))
        assert_true("Dependency has dependsOn", isinstance(dep.get("dependsOn"), dict))

# Filter by productId
if first_product:
    status, prod_deps = req("GET", f"/api/dependencies?productId={first_product['id']}")
    assert_eq("Filter deps by productId returns 200", status, 200)
    assert_true("Filtered deps is a list", isinstance(prod_deps, list))
    assert_true("All filtered deps belong to product", all(d["productId"] == first_product["id"] for d in prod_deps))

# =============================================================================
# 5. EDGE CASES & VALIDATION
# =============================================================================
print("\n" + "=" * 60)
print("SUITE 5: Edge Cases & Validation")
print("=" * 60)

# 5.1 Search with special characters (should not crash)
status, special_search = req("GET", "/api/products?search=%22test%22")
assert_eq("Search with special chars returns 200", status, 200)
assert_true("Special char search is a list", isinstance(special_search, list))

# 5.2 Empty search param
status, empty_search = req("GET", "/api/products?search=")
assert_eq("Empty search returns 200", status, 200)
# Empty search should effectively be ignored, returning all active products
assert_true("Empty search returns all active products", isinstance(empty_search, list) and len(empty_search) > 0)

# 5.3 Unknown query params are ignored
status, unknown_qp = req("GET", "/api/products?foo=bar&baz=qux")
assert_eq("Unknown query params return 200", status, 200)
assert_true("Unknown params ignored", isinstance(unknown_qp, list) and len(unknown_qp) > 0)

# 5.4 Category with no products
status, empty_cat = req("GET", "/api/products?category=nonexistent")
assert_eq("Category with no products returns 200", status, 200)
assert_eq("Empty category returns empty list", empty_cat, [])

# 5.5 OS filter with no matches
status, empty_os = req("GET", "/api/products?os=MacOS")
assert_eq("OS with no matches returns 200", status, 200)
assert_eq("Empty OS filter returns empty list", empty_os, [])

# 5.6 Flavor filter with no matches
status, empty_flavor = req("GET", "/api/products?flavor=NonExistent")
assert_eq("Flavor with no matches returns 200", status, 200)
assert_eq("Empty flavor filter returns empty list", empty_flavor, [])

# 5.7 Duplicate slug on create
if categories:
    cat_id = categories[0]["id"]
    status, dup = req("POST", "/api/products", {"name":"Dup","slug":"vm-debian-12","categoryId":cat_id})
    assert_eq("Duplicate slug returns 409", status, 409)

# 5.8 Invalid UUID for categoryId
status, invalid_uuid = req("POST", "/api/products", {"name":"X","slug":"x-test-slug-1","categoryId":"not-a-uuid"})
assert_eq("Invalid UUID returns 400", status, 400)
assert_in("Invalid UUID has error", "error", invalid_uuid)

# 5.9 Bad slug format
status, bad_slug = req("POST", "/api/products", {"name":"X","slug":"Bad Slug!","categoryId":cat_id})
assert_eq("Bad slug format returns 400", status, 400)

# 5.10 Self-dependency prevention
if len(product_ids) >= 1:
    pid = list(product_ids)[0]
    status, self_dep = req("POST", "/api/dependencies", {"productId":pid,"dependsOnId":pid,"type":"REQUIRED"})
    assert_eq("Self-dependency returns 400", status, 400)
    assert_in("Self-dependency has error", "error", self_dep)

# 5.11 Non-existent product dependency
if len(product_ids) >= 1:
    pid = list(product_ids)[0]
    status, fake_dep = req("POST", "/api/dependencies", {"productId":pid,"dependsOnId":"00000000-0000-0000-0000-000000000000","type":"REQUIRED"})
    assert_eq("Non-existent dependsOn returns 404", status, 404)

# =============================================================================
# 6. DATA INTEGRITY
# =============================================================================
print("\n" + "=" * 60)
print("SUITE 6: Data Integrity")
print("=" * 60)

# 6.1 All products have unique slugs
all_slugs = [p["slug"] for p in products]
assert_eq("All product slugs are unique", len(all_slugs), len(set(all_slugs)))

# 6.2 All products have unique IDs
all_ids = [p["id"] for p in products]
assert_eq("All product IDs are unique", len(all_ids), len(set(all_ids)))

# 6.3 Category slugs are unique
cat_slugs_list = [c["slug"] for c in categories]
assert_eq("All category slugs are unique", len(cat_slugs_list), len(set(cat_slugs_list)))

# 6.4 Expected seed products exist
expected_slugs = {
    "vm-debian-12", "vm-windows-server-2022", "vm-rhel-9",
    "bare-metal-hpc", "object-storage", "nas-storage",
    "vmware-vsphere", "citrix-vdi"
}
assert_eq("All seed products present", len(product_slugs & expected_slugs), len(expected_slugs))

# 6.5 Flavors have valid numeric specs
for p in products:
    for f in p.get("flavors", []):
        assert_true(f"Flavor {f['name']} vcpu >= 0", f.get("vcpu", -1) >= 0)
        assert_true(f"Flavor {f['name']} ramGb >= 0", f.get("ramGb", -1) >= 0)

# 6.6 Product.createdAt is valid ISO date
for p in products:
    created = p.get("createdAt", "")
    assert_true(f"Product {p['slug']} has valid createdAt", isinstance(created, str) and "T" in created)

# =============================================================================
# 7. ADMIN ROUTES (Read-only)
# =============================================================================
print("\n" + "=" * 60)
print("SUITE 7: Admin Routes")
print("=" * 60)

admin_routes = [
    "/api/admin/dashboard",
    "/api/admin/products",
    "/api/admin/categories",
    "/api/admin/flavors",
    "/api/admin/dependencies",
    "/api/admin/forecasts",
    "/api/admin/users",
]

for route in admin_routes:
    status, body = req("GET", route)
    assert_eq(f"GET {route} returns 200", status, 200)
    assert_true(f"GET {route} returns array or object", isinstance(body, (list, dict)))

# Dashboard should have counts
status, dashboard = req("GET", "/api/admin/dashboard")
if isinstance(dashboard, dict):
    assert_in("Dashboard has counts", "counts", dashboard)
    if "counts" in dashboard:
        counts = dashboard["counts"]
        assert_in("Dashboard counts has products", "products", counts)
        assert_in("Dashboard counts has categories", "categories", counts)
        assert_in("Dashboard counts has forecasts", "forecasts", counts)
        assert_in("Dashboard counts has users", "users", counts)
        assert_true("Dashboard products count > 0", counts.get("products", 0) > 0)
        assert_true("Dashboard categories count > 0", counts.get("categories", 0) > 0)
    assert_in("Dashboard has recentForecasts", "recentForecasts", dashboard)


# =============================================================================
# SUMMARY
# =============================================================================
print("\n" + "=" * 60)
print("SUMMARY")
print("=" * 60)
TOTAL = PASS + FAIL
print(f"Passed: {PASS}/{TOTAL}")
print(f"Failed: {FAIL}/{TOTAL}")

if FAILED_TESTS:
    print("\nFailed tests:")
    for t in FAILED_TESTS:
        print(f"  - {t}")
    sys.exit(1)
else:
    print("\n✅ All tests passed!")
    sys.exit(0)
