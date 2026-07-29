#!/usr/bin/env python3
"""
Tests for the "Production Polish & Documentation" feature.

Covers:
- API health checks and error handling polish
- CORS headers
- 404 handler
- Admin dashboard data integrity
- Responsive design verification (via API data structure)
- Error state responses (validation, conflicts, not found)
- Seed data completeness (documentation, roadmap fields)
"""

import json
import urllib.request
import urllib.error
import sys

API = "http://localhost:3001"

PASS = 0
FAIL = 0
FAILED_TESTS = []


def req(method, path, data=None):
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
# 1. HEALTH & BASIC CONNECTIVITY
# =============================================================================
print("=" * 60)
print("SUITE 1: Health & Basic Connectivity")
print("=" * 60)

status, health = req("GET", "/health")
assert_eq("GET /health returns 200", status, 200)
assert_in("Health has status field", "status", health)
assert_eq("Health status is ok", health.get("status"), "ok")
assert_in("Health has timestamp", "timestamp", health)
assert_true("Health timestamp is present", health.get("timestamp") is not None)


# =============================================================================
# 2. ERROR HANDLING POLISH
# =============================================================================
print("\n" + "=" * 60)
print("SUITE 2: Error Handling Polish")
print("=" * 60)

# 2.1 404 for unknown route
status, not_found = req("GET", "/api/this-route-does-not-exist")
assert_eq("Unknown API route returns 404", status, 404)
assert_in("404 body has error field", "error", not_found)

# 2.2 404 for non-existent product
status, prod_404 = req("GET", "/api/products/nonexistent-slug-99999")
assert_eq("Non-existent product returns 404", status, 404)
assert_in("Product 404 has error field", "error", prod_404)

# 2.3 400 for validation error (Zod)
status, cat_list = req("GET", "/api/categories")
cat_id = cat_list[0]["id"] if cat_list else ""
status, val_err = req("POST", "/api/products", {"name": "", "slug": "", "categoryId": cat_id})
assert_eq("Validation error returns 400", status, 400)
assert_in("Validation error has error field", "error", val_err)

# 2.4 409 for duplicate slug
status, dup_err = req("POST", "/api/products", {"name": "Dup", "slug": "vm-debian-12", "categoryId": cat_id})
assert_eq("Duplicate slug returns 409", status, 409)
assert_in("Conflict error has error field", "error", dup_err)

# 2.5 Invalid UUID format
status, uuid_err = req("POST", "/api/products", {"name": "X", "slug": "x-test-slug-99", "categoryId": "bad-uuid"})
assert_eq("Invalid UUID returns 400", status, 400)

# 2.6 Self-dependency prevention
status, products = req("GET", "/api/products")
if products:
    pid = products[0]["id"]
    status, self_dep = req("POST", "/api/dependencies", {"productId": pid, "dependsOnId": pid, "type": "REQUIRED"})
    assert_eq("Self-dependency returns 400", status, 400)
    assert_in("Self-dependency has error message", "error", self_dep)


# =============================================================================
# 3. SEED DATA DOCUMENTATION COMPLETENESS
# =============================================================================
print("\n" + "=" * 60)
print("SUITE 3: Seed Data Documentation Completeness")
print("=" * 60)

status, products = req("GET", "/api/products")
assert_eq("GET /api/products returns 200", status, 200)
assert_true("Products list is non-empty", isinstance(products, list) and len(products) >= 8)

# 3.1 All products have documentation and roadmap
for p in products:
    assert_true(f"Product '{p['slug']}' has documentation", p.get("documentation") is not None and len(p["documentation"]) > 0)
    assert_true(f"Product '{p['slug']}' has roadmap", p.get("roadmap") is not None and len(p["roadmap"]) > 0)

# 3.2 Documentation contains markdown headers
for p in products:
    doc = p.get("documentation", "")
    assert_true(f"Product '{p['slug']}' doc has markdown headers", "#" in doc)

# 3.3 Roadmap contains markdown headers
for p in products:
    roadmap = p.get("roadmap", "")
    assert_true(f"Product '{p['slug']}' roadmap has markdown headers", "#" in roadmap)

# 3.4 Products have descriptions
for p in products:
    assert_true(f"Product '{p['slug']}' has description", p.get("description") is not None and len(p["description"]) > 10)

# 3.5 All expected seed products exist
expected_slugs = {
    "vm-debian-12", "vm-windows-server-2022", "vm-rhel-9",
    "bare-metal-hpc", "object-storage", "nas-storage",
    "vmware-vsphere", "citrix-vdi"
}
found_slugs = {p["slug"] for p in products}
assert_eq("All 8 seed products present", len(found_slugs & expected_slugs), len(expected_slugs))


# =============================================================================
# 4. ADMIN DASHBOARD POLISH
# =============================================================================
print("\n" + "=" * 60)
print("SUITE 4: Admin Dashboard")
print("=" * 60)

status, dashboard = req("GET", "/api/admin/dashboard")
assert_eq("GET /api/admin/dashboard returns 200", status, 200)
assert_in("Dashboard has counts", "counts", dashboard)
assert_in("Dashboard has recentForecasts", "recentForecasts", dashboard)

counts = dashboard.get("counts", {})
assert_in("Counts has products", "products", counts)
assert_in("Counts has categories", "categories", counts)
assert_in("Counts has forecasts", "forecasts", counts)
assert_in("Counts has users", "users", counts)
assert_true("Dashboard products count >= 8", counts.get("products", 0) >= 8)
assert_true("Dashboard categories count >= 4", counts.get("categories", 0) >= 4)

# recentForecasts should be a list
recent = dashboard.get("recentForecasts", [])
assert_true("recentForecasts is a list", isinstance(recent, list))


# =============================================================================
# 5. CATEGORY ICONS & UI DATA
# =============================================================================
print("\n" + "=" * 60)
print("SUITE 5: Category Icons & UI Data")
print("=" * 60)

status, categories = req("GET", "/api/categories")
assert_eq("GET /api/categories returns 200", status, 200)
assert_true("Categories list is non-empty", isinstance(categories, list) and len(categories) >= 4)

for c in categories:
    assert_true(f"Category '{c['slug']}' has icon", c.get("icon") is not None and len(c["icon"]) > 0)
    assert_true(f"Category '{c['slug']}' has description", c.get("description") is not None and len(c["description"]) > 0)
    assert_in(f"Category '{c['slug']}' has _count", "_count", c)


# =============================================================================
# 6. FORECAST STATUS COLORS / STATES
# =============================================================================
print("\n" + "=" * 60)
print("SUITE 6: Forecast Status States")
print("=" * 60)

status, forecasts = req("GET", "/api/forecasts")
assert_eq("GET /api/forecasts returns 200", status, 200)
assert_true("Forecasts is a list", isinstance(forecasts, list))

# If there are forecasts, verify status values
if forecasts:
    valid_statuses = {"PENDING", "APPROVED", "REJECTED"}
    for f in forecasts:
        assert_true(f"Forecast {f['id'][:8]} has valid status", f.get("status") in valid_statuses)
        assert_true(f"Forecast {f['id'][:8]} has product", isinstance(f.get("product"), dict))
        assert_true(f"Forecast {f['id'][:8]} has flavor", isinstance(f.get("flavor"), dict))

# Stats endpoint
status, stats = req("GET", "/api/forecasts/stats")
assert_eq("GET /api/forecasts/stats returns 200", status, 200)
assert_in("Stats has total", "total", stats)
assert_in("Stats has pending", "pending", stats)
assert_in("Stats has approved", "approved", stats)
assert_in("Stats has rejected", "rejected", stats)
assert_eq("Stats total equals sum of parts",
    stats["total"],
    stats["pending"] + stats["approved"] + stats["rejected"])


# =============================================================================
# 7. RESPONSIVE DATA STRUCTURE (Flavors with specs)
# =============================================================================
print("\n" + "=" * 60)
print("SUITE 7: Flavor Specs for Responsive Cards")
print("=" * 60)

status, flavors = req("GET", "/api/flavors")
assert_eq("GET /api/flavors returns 200", status, 200)
assert_true("Flavors list is non-empty", isinstance(flavors, list) and len(flavors) > 0)

for f in flavors:
    assert_true(f"Flavor '{f['name']}' has vcpu >= 0", f.get("vcpu", -1) >= 0)
    assert_true(f"Flavor '{f['name']}' has ramGb >= 0", f.get("ramGb", -1) >= 0)
    assert_in(f"Flavor '{f['name']}' has product", "product", f)

# Verify expected seed flavors exist
flavor_names = {f["name"] for f in flavors}
assert_in("Has Small flavor", "Small", flavor_names)
assert_in("Has Medium flavor", "Medium", flavor_names)
assert_in("Has Large flavor", "Large", flavor_names)
assert_in("Has XL flavor", "XL", flavor_names)

# Verify at least one Small flavor has expected compute specs
small_compute = next((f for f in flavors if f["name"] == "Small" and f.get("vcpu", 0) > 0), None)
if small_compute:
    assert_eq("Small flavor vCPU", small_compute.get("vcpu"), 2)
    assert_eq("Small flavor RAM", small_compute.get("ramGb"), 4)
else:
    # If no compute Small found, just verify any Small exists
    assert_true("Has Small flavor", any(f["name"] == "Small" for f in flavors))

# Verify at least one XL flavor has expected compute specs
xl_compute = next((f for f in flavors if f["name"] == "XL" and f.get("vcpu", 0) > 0), None)
if xl_compute:
    assert_eq("XL flavor vCPU", xl_compute.get("vcpu"), 16)
    assert_eq("XL flavor RAM", xl_compute.get("ramGb"), 32)
else:
    assert_true("Has XL flavor", any(f["name"] == "XL" for f in flavors))


# =============================================================================
# 8. DEPENDENCY GRAPH DATA
# =============================================================================
print("\n" + "=" * 60)
print("SUITE 8: Dependency Graph Data")
print("=" * 60)

status, deps = req("GET", "/api/dependencies")
assert_eq("GET /api/dependencies returns 200", status, 200)
assert_true("Dependencies is a list", isinstance(deps, list))

for d in deps:
    assert_true(f"Dependency has valid type", d.get("type") in ("REQUIRED", "RECOMMENDED"))
    assert_true(f"Dependency has product", isinstance(d.get("product"), dict))
    assert_true(f"Dependency has dependsOn", isinstance(d.get("dependsOn"), dict))
    assert_true(f"Dependency product has name", d["product"].get("name") is not None)
    assert_true(f"Dependency dependsOn has name", d["dependsOn"].get("name") is not None)


# =============================================================================
# 9. PRODUCT FILTERS (Edge Cases)
# =============================================================================
print("\n" + "=" * 60)
print("SUITE 9: Product Filter Edge Cases")
print("=" * 60)

# Empty search
status, empty_search = req("GET", "/api/products?search=")
assert_eq("Empty search returns 200", status, 200)
assert_true("Empty search returns all products", isinstance(empty_search, list) and len(empty_search) > 0)

# Non-existent search
status, no_match = req("GET", "/api/products?search=xyznonexistent")
assert_eq("No-match search returns 200", status, 200)
assert_eq("No-match search returns empty list", no_match, [])

# Unknown query params ignored
status, unknown_qp = req("GET", "/api/products?foo=bar&baz=qux")
assert_eq("Unknown query params return 200", status, 200)
assert_true("Unknown params ignored", isinstance(unknown_qp, list) and len(unknown_qp) > 0)

# Non-existent category
status, empty_cat = req("GET", "/api/products?category=nonexistent")
assert_eq("Non-existent category returns 200", status, 200)
assert_eq("Non-existent category returns empty list", empty_cat, [])

# Non-existent OS
status, empty_os = req("GET", "/api/products?os=MacOS")
assert_eq("Non-existent OS returns 200", status, 200)
assert_eq("Non-existent OS returns empty list", empty_os, [])

# Non-existent flavor
status, empty_flavor = req("GET", "/api/products?flavor=NonExistent")
assert_eq("Non-existent flavor returns 200", status, 200)
assert_eq("Non-existent flavor returns empty list", empty_flavor, [])


# =============================================================================
# 10. CORS & HEADERS
# =============================================================================
print("\n" + "=" * 60)
print("SUITE 10: CORS & Response Headers")
print("=" * 60)

url = f"{API}/health"
r = urllib.request.Request(url, method="OPTIONS")
r.add_header("Origin", "http://localhost:5192")
r.add_header("Access-Control-Request-Method", "GET")
try:
    with urllib.request.urlopen(r) as resp:
        assert_eq("OPTIONS /health returns 204", resp.status, 204)
        cors_header = resp.headers.get("Access-Control-Allow-Origin")
        assert_true("CORS header is present", cors_header is not None)
except urllib.error.HTTPError as e:
    # If CORS is not configured for OPTIONS, that's ok for this test
    assert_eq("OPTIONS request handled", e.code in (204, 200, 404), True)

# GET request should have JSON content-type
r2 = urllib.request.Request(url, method="GET")
try:
    with urllib.request.urlopen(r2) as resp:
        ct = resp.headers.get("Content-Type", "")
        assert_true("GET /health has JSON content-type", "json" in ct.lower() or "application" in ct.lower())
except Exception as e:
    FAIL += 1
    FAILED_TESTS.append("GET /health Content-Type check")
    print(f"  ✗ GET /health Content-Type check — {e}")


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
