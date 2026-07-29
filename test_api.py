#!/usr/bin/env python3
import json
import urllib.request
import urllib.error

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

# Get IDs
_, products_raw = req("GET", "/api/products")
products = j(products_raw)
prod_id = products[0]["id"]
prod2_id = products[2]["id"]

cat_id = j(req("GET", "/api/categories")[1])[0]["id"]

print("=== PRODUCT CRUD ===")
status, data = req("POST", "/api/products", {"name":"Test VM","slug":"test-vm-py","description":"Test","categoryId":cat_id})
print(f"POST product: {status}")
prod_new = j(data)
status, _ = req("PATCH", f"/api/products/{prod_new['id']}", {"name":"Test VM Updated"})
print(f"PATCH product: {status}")
status, _ = req("DELETE", f"/api/products/{prod_new['id']}")
print(f"DELETE product: {status}")

print("\n=== CATEGORY CRUD ===")
status, data = req("POST", "/api/categories", {"name":"TestCatPy","slug":"test-cat-py"})
print(f"POST category: {status}")
cat_new = j(data)
status, _ = req("PATCH", f"/api/categories/{cat_new['id']}", {"description":"Updated"})
print(f"PATCH category: {status}")
status, _ = req("DELETE", f"/api/categories/{cat_new['id']}")
print(f"DELETE category: {status}")

print("\n=== FLAVOR CRUD ===")
status, data = req("POST", "/api/flavors", {"name":"TinyPy","vcpu":1,"ramGb":2,"productId":prod_id})
print(f"POST flavor: {status}")
flavor_new = j(data)
status, data = req("PATCH", f"/api/flavors/{flavor_new['id']}", {"ramGb":4})
print(f"PATCH flavor: {status} -> ramGb={j(data).get('ramGb')}")
status, _ = req("DELETE", f"/api/flavors/{flavor_new['id']}")
print(f"DELETE flavor: {status}")

print("\n=== DEPENDENCY CRUD ===")
status, data = req("POST", "/api/dependencies", {"productId":prod_id,"dependsOnId":prod2_id,"type":"RECOMMENDED","description":"Test"})
print(f"POST dependency: {status}")
dep_new = j(data)
if "id" in dep_new:
    status, data = req("PATCH", f"/api/dependencies/{dep_new['id']}", {"type":"REQUIRED"})
    print(f"PATCH dependency: {status} -> type={j(data).get('type')}")
    status, _ = req("DELETE", f"/api/dependencies/{dep_new['id']}")
    print(f"DELETE dependency: {status}")
else:
    print(f"  Error: {dep_new.get('error')}")

print("\n=== USER CRUD ===")
status, data = req("POST", "/api/users", {"email":"test-py@example.com","name":"Test Py"})
print(f"POST user: {status}")
user_new = j(data)
status, data = req("PATCH", f"/api/users/{user_new['id']}", {"name":"Test Py Updated"})
print(f"PATCH user: {status} -> name={j(data).get('name')}")
status, _ = req("DELETE", f"/api/users/{user_new['id']}")
print(f"DELETE user: {status}")

print("\n=== VALIDATION ERRORS ===")
status, data = req("POST", "/api/products", {"slug":"vm-debian-12","categoryId":cat_id})
print(f"Duplicate slug: {status} -> {j(data).get('error')}")

status, data = req("POST", "/api/dependencies", {"productId":prod_id,"dependsOnId":prod_id,"type":"REQUIRED"})
print(f"Self-dependency: {status} -> {j(data).get('error')}")

status, data = req("POST", "/api/products", {"name":"","slug":"bad slug","categoryId":"not-uuid"})
print(f"Zod validation: {status} -> {j(data).get('error')}, details={len(j(data).get('details',[]))}")

print("\n=== ADMIN ROUTES ===")
for route in ["/api/admin/dashboard","/api/admin/products","/api/admin/categories","/api/admin/flavors","/api/admin/dependencies","/api/admin/forecasts","/api/admin/users"]:
    status, data = req("GET", route)
    print(f"GET {route}: {status}")

print("\nAll tests complete!")
