"""
Verification script to check if update_payment_field actually persists to MongoDB.

This script:
1. Shows the current value in the database
2. Performs an update
3. Queries the database again to verify the change persisted
4. Does NOT restore the value immediately
"""

import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.mongodb_service import get_mongodb_service
from tools import update_payment_field


def verify_update():
    """Verify that update_payment_field actually persists to database"""

    print("=" * 80)
    print("DATABASE UPDATE VERIFICATION")
    print("=" * 80)

    mongo = get_mongodb_service()
    collection = mongo.get_collection("canonical_json_storage")

    # Find a test record
    payment_record = collection.find_one({"conversion_id": "MT103_to_JSON"})

    if not payment_record:
        print("✗ No test record found with conversion_id: MT103_to_JSON")
        return

    print(f"\n✓ Found payment record: {payment_record.get('conversion_id')}")

    # Step 1: Show current value in database
    print("\n" + "-" * 80)
    print("STEP 1: Current value in database")
    print("-" * 80)
    json_data = payment_record.get("json_data", {})
    current_creditor_name = json_data.get("creditor_name", "")
    print(f"creditor_name: {current_creditor_name}")

    # Step 2: Perform update
    print("\n" + "-" * 80)
    print("STEP 2: Performing update")
    print("-" * 80)
    new_value = "【検証テスト】Verification Test Company"
    print(f"Updating creditor_name to: {new_value}")

    result = update_payment_field.invoke({
        "payment_id": "MT103_to_JSON",
        "field_name": "creditor_name",
        "new_value": new_value
    })

    print(f"\nUpdate result:")
    print(f"  Old Value: {result.get('old_value')}")
    print(f"  New Value: {result.get('new_value')}")
    print(f"  Updated: {result.get('updated')}")
    print(f"  Timestamp: {result.get('timestamp')}")

    # Step 3: Query database again to verify persistence
    print("\n" + "-" * 80)
    print("STEP 3: Querying database to verify persistence")
    print("-" * 80)

    # Re-fetch the document from database
    updated_record = collection.find_one({"conversion_id": "MT103_to_JSON"})

    if not updated_record:
        print("✗ Could not re-fetch record from database")
        return

    updated_json_data = updated_record.get("json_data", {})
    current_value_in_db = updated_json_data.get("creditor_name", "")

    print(f"Current creditor_name in database: {current_value_in_db}")

    # Step 4: Verify the change persisted
    print("\n" + "=" * 80)
    print("VERIFICATION RESULT")
    print("=" * 80)

    if current_value_in_db == new_value:
        print(f"✓ SUCCESS: Database was updated and change persisted!")
        print(f"  Database value: {current_value_in_db}")
        print(f"  Expected value: {new_value}")
    else:
        print(f"✗ FAILURE: Database value does not match!")
        print(f"  Database value: {current_value_in_db}")
        print(f"  Expected value: {new_value}")

    # Step 5: Check audit trail
    print("\n" + "-" * 80)
    print("STEP 4: Checking audit trail")
    print("-" * 80)
    metadata = updated_record.get("metadata", {})
    audit_trail = metadata.get("audit_trail", {})
    creditor_name_audit = audit_trail.get("creditor_name", {})

    if creditor_name_audit:
        print(f"Audit trail found:")
        print(f"  Old value: {creditor_name_audit.get('old_value')}")
        print(f"  New value: {creditor_name_audit.get('new_value')}")
        print(f"  Updated at: {creditor_name_audit.get('updated_at')}")
        print(f"  Updated by: {creditor_name_audit.get('updated_by')}")
    else:
        print("No audit trail found for creditor_name")

    # Provide instructions for restoration
    print("\n" + "=" * 80)
    print("NOTE: To restore original value, run:")
    print(f"  uv run python -c \"from tools import update_payment_field; print(update_payment_field.invoke({{'payment_id': 'MT103_to_JSON', 'field_name': 'creditor_name', 'new_value': '{current_creditor_name}'}}))\"\n")


if __name__ == "__main__":
    verify_update()
