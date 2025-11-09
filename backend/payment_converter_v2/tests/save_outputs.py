"""
Save conversion outputs to files for inspection

This script runs the JSON conversion tests and saves the actual outputs
to files so they can be inspected and compared.
"""

import asyncio
import json
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.services import MongoDBService, get_ai_lane_service, get_converter
from config.settings import get_settings

SAMPLE_MT103 = """{1:F01UBSWCHZH80A0000000000}{2:I103ABSAZAJJXXXXN}{4:
:20:MED-CH-ZA-2024-001
:23B:CRED
:32A:241215CHF180000,00
:50K:/CH9300762011623852957
SWISS PHARMA INTERNATIONAL AG
BAHNHOFSTRASSE 45
8001 ZURICH
:52A:UBSWCHZH80A
:59:/ZA123456789012345678901
SOUTH AFRICAN HEALTH SUPPLIES PTY LTD
123 MEDICAL PLAZA SANDTON
JOHANNESBURG 2001
:70:INVOICE MED-ZA-2024-5678 DATED 10.12.2024
PHARMACEUTICAL SUPPLIES ORDER
:71A:SHA
-}"""


async def test_and_save():
    settings = get_settings()
    mongodb_service = MongoDBService(settings.mongodb_uri, settings.database_name)
    ai_lane_service = get_ai_lane_service(
        model_haiku=settings.ai_model_haiku,
        model_sonnet=settings.ai_model_sonnet
    )
    converter = get_converter(
        mongodb_service=mongodb_service,
        ai_lane_service=ai_lane_service,
        ai_confidence_threshold=settings.ai_confidence_threshold
    )
    
    print('='*70)
    print('SAVING CONVERSION OUTPUTS')
    print('='*70)
    
    # Test 1: MT103 → JSON
    print('\n1️⃣  MT103 → JSON')
    result1 = await converter.convert(
        source_format='MT103',
        target_format='JSON',
        message=SAMPLE_MT103
    )
    json_output = result1['converted_message']
    
    output_dir = os.path.join(os.path.dirname(__file__), 'output')
    os.makedirs(output_dir, exist_ok=True)
    
    with open(os.path.join(output_dir, 'mt103_to_json.json'), 'w') as f:
        # Pretty print the JSON
        json_obj = json.loads(json_output)
        json.dump(json_obj, f, indent=2)
    
    print(f'   ✅ Saved: tests/output/mt103_to_json.json')
    print(f'   Processing time: {result1["metadata"]["processing_time_seconds"]:.2f}s')
    print(f'   Lanes: {result1["processing_stats"]["lane_distribution"]}')
    
    # Test 2: JSON → pacs.008 (using the JSON we just created)
    print('\n2️⃣  JSON → pacs.008')
    result2 = await converter.convert(
        source_format='JSON',
        target_format='pacs.008',
        message=json_output
    )
    xml_output = result2['converted_message']
    
    with open(os.path.join(output_dir, 'json_to_pacs008.xml'), 'w') as f:
        f.write(xml_output)
    
    print(f'   ✅ Saved: tests/output/json_to_pacs008.xml')
    print(f'   Processing time: {result2["metadata"]["processing_time_seconds"]:.2f}s')
    print(f'   Lanes: {result2["processing_stats"]["lane_distribution"]}')
    
    # Test 3: Direct MT103 → pacs.008 for comparison
    print('\n3️⃣  MT103 → pacs.008 (direct, for comparison)')
    result3 = await converter.convert(
        source_format='MT103',
        target_format='pacs.008',
        message=SAMPLE_MT103
    )
    xml_direct = result3['converted_message']
    
    with open(os.path.join(output_dir, 'mt103_to_pacs008_direct.xml'), 'w') as f:
        f.write(xml_direct)
    
    print(f'   ✅ Saved: tests/output/mt103_to_pacs008_direct.xml')
    print(f'   Processing time: {result3["metadata"]["processing_time_seconds"]:.2f}s')
    print(f'   Lanes: {result3["processing_stats"]["lane_distribution"]}')
    
    print('\n' + '='*70)
    print('COMPARISON')
    print('='*70)
    print(f'Multi-hop XML length: {len(xml_output)} chars')
    print(f'Direct XML length: {len(xml_direct)} chars')
    print(f'Difference: {abs(len(xml_output) - len(xml_direct))} chars')
    
    # Show JSON content
    print('\n' + '='*70)
    print('CANONICAL JSON CONTENT')
    print('='*70)
    print(json.dumps(json_obj, indent=2))
    
    print('\n✅ All outputs saved to tests/output/ directory')
    
    mongodb_service.close()


if __name__ == "__main__":
    asyncio.run(test_and_save())

