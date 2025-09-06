#!/usr/bin/env python3
"""
End-to-End Testing Script for Payment Format Converter
Tests all sample MT103 files through the complete conversion pipeline
"""

import json
import requests
import time
from pathlib import Path
from typing import Dict, List, Any
from datetime import datetime

def test_all_samples() -> List[Dict[str, Any]]:
    """Test conversion with all sample MT103 files"""
    
    base_url = "http://localhost:8000/api/v1"
    data_dir = Path("data/mt103")
    
    # Check if server is running
    try:
        health_response = requests.get(f"http://localhost:8000/health")
        if health_response.status_code != 200:
            print("❌ Server is not healthy. Please start the server first.")
            return []
    except requests.exceptions.ConnectionError:
        print("❌ Cannot connect to server. Please run: uv run uvicorn main:app --host 0.0.0.0 --port 8000")
        return []
    
    results = []
    
    print("=" * 70)
    print("PAYMENT FORMAT CONVERTER - END-TO-END TESTING")
    print("=" * 70)
    print(f"Testing {len(list(data_dir.glob('*.txt')))} MT103 sample files")
    print(f"Timestamp: {datetime.now().isoformat()}")
    print("-" * 70)
    
    # Test each MT103 file
    for mt103_file in sorted(data_dir.glob("*.txt")):
        print(f"\n📄 Testing: {mt103_file.name}")
        print("-" * 50)
        
        # Read MT103 content
        with open(mt103_file) as f:
            mt103_content = f.read()
        
        # Extract key information for display
        field_70 = ""
        if ":70:" in mt103_content:
            field_70_start = mt103_content.index(":70:") + 4
            field_70_end = mt103_content.find("\n:", field_70_start)
            if field_70_end == -1:
                field_70_end = mt103_content.find("\n-}", field_70_start)
            field_70 = mt103_content[field_70_start:field_70_end].replace("\n", " ")
            print(f"   Field 70: {field_70[:60]}...")
        
        # Send conversion request
        start_time = time.time()
        
        try:
            response = requests.post(
                f"{base_url}/convert/",
                json={
                    "source_format": "MT103",
                    "target_format": "pacs.008",
                    "message": mt103_content,
                    "trace_id": f"TEST-{mt103_file.stem}"
                },
                timeout=30
            )
            
            elapsed_time = time.time() - start_time
            
            if response.status_code == 200:
                result = response.json()
                
                print(f"   ✅ Conversion Successful")
                print(f"   Conversion ID: {result['conversion_id']}")
                print(f"   Processing Time: {result['processing_time']:.2f}s (API: {elapsed_time:.2f}s)")
                print(f"   Status: {result['status']}")
                print(f"   Success: {result['success']}")
                
                # Get statistics from response
                stats = result.get('statistics', {})
                rules_count = stats.get('rules_lane', {}).get('count', 0)
                ai_count = stats.get('ai_lane', {}).get('count', 0)
                human_count = stats.get('human_lane', {}).get('count', 0)
                
                print(f"\n   Processing Lane Distribution:")
                print(f"   • Rules Lane: {rules_count} fields")
                print(f"   • AI Lane: {ai_count} fields")
                print(f"   • Human Review: {human_count} fields")
                
                # Get confidence score if available
                confidence = result.get('confidence_score', 0)
                if confidence:
                    print(f"   • Confidence Score: {confidence:.2f}")
                
                # Get field details for more insights
                if result.get('conversion_id'):
                    details_response = requests.get(
                        f"{base_url}/convert/{result['conversion_id']}/details"
                    )
                    if details_response.status_code == 200:
                        details = details_response.json()
                        overall_confidence = details.get('overall_confidence', 0)
                        print(f"   • Overall Confidence: {overall_confidence:.2f}")
                        
                        # Show which fields went to AI
                        field_details = details.get('field_details', [])
                        ai_fields = [f['field_id'] for f in field_details if f.get('processing_lane') == 'AI']
                        if ai_fields:
                            print(f"   • AI-Processed Fields: {', '.join(ai_fields)}")
                
                results.append({
                    "file": mt103_file.name,
                    "status": "success",
                    "conversion_id": result['conversion_id'],
                    "processing_time": result['processing_time'],
                    "api_time": elapsed_time,
                    "rules_fields": rules_count,
                    "ai_fields": ai_count,
                    "human_fields": human_count,
                    "confidence": overall_confidence if 'overall_confidence' in locals() else confidence,
                    "human_review_required": result.get('human_review_required', False)
                })
                
            else:
                error_msg = response.text[:200]
                print(f"   ❌ Conversion Failed")
                print(f"   Status Code: {response.status_code}")
                print(f"   Error: {error_msg}")
                
                results.append({
                    "file": mt103_file.name,
                    "status": "failed",
                    "error": error_msg,
                    "status_code": response.status_code
                })
                
        except requests.exceptions.Timeout:
            print(f"   ❌ Request Timeout (>30s)")
            results.append({
                "file": mt103_file.name,
                "status": "timeout",
                "error": "Request exceeded 30 second timeout"
            })
            
        except Exception as e:
            print(f"   ❌ Unexpected Error: {str(e)}")
            results.append({
                "file": mt103_file.name,
                "status": "error",
                "error": str(e)
            })
    
    # Generate Summary Report
    print("\n" + "=" * 70)
    print("TESTING SUMMARY")
    print("=" * 70)
    
    successful = [r for r in results if r["status"] == "success"]
    failed = [r for r in results if r["status"] != "success"]
    
    print(f"\nTest Results:")
    print(f"• Total Files Tested: {len(results)}")
    print(f"• Successful: {len(successful)} ✅")
    print(f"• Failed: {len(failed)} ❌")
    print(f"• Success Rate: {len(successful)/len(results)*100:.1f}%")
    
    if successful:
        # Calculate averages for successful conversions
        avg_processing_time = sum(r["processing_time"] for r in successful) / len(successful)
        avg_api_time = sum(r["api_time"] for r in successful) / len(successful)
        avg_confidence = sum(r["confidence"] for r in successful) / len(successful)
        
        total_rules = sum(r["rules_fields"] for r in successful)
        total_ai = sum(r["ai_fields"] for r in successful)
        total_human = sum(r["human_fields"] for r in successful)
        
        avg_rules = total_rules / len(successful)
        avg_ai = total_ai / len(successful)
        avg_human = total_human / len(successful)
        
        print(f"\nPerformance Metrics:")
        print(f"• Average Processing Time: {avg_processing_time:.2f}s")
        print(f"• Average API Response Time: {avg_api_time:.2f}s")
        print(f"• Average Confidence Score: {avg_confidence:.2%}")
        
        print(f"\nProcessing Lane Statistics (per message):")
        print(f"• Average Rules Fields: {avg_rules:.1f}")
        print(f"• Average AI Fields: {avg_ai:.1f}")
        print(f"• Average Human Review Fields: {avg_human:.1f}")
        
        print(f"\nTotal Field Processing:")
        print(f"• Total Rules Fields: {total_rules}")
        print(f"• Total AI Fields: {total_ai}")
        print(f"• Total Human Review Fields: {total_human}")
        
        # Check if confidence meets threshold
        confidence_threshold = 0.7
        low_confidence = [r for r in successful if r["confidence"] < confidence_threshold]
        if low_confidence:
            print(f"\n⚠️ Warning: {len(low_confidence)} files had confidence < {confidence_threshold}")
            for r in low_confidence:
                print(f"   • {r['file']}: {r['confidence']:.2%}")
        else:
            print(f"\n✅ All conversions met confidence threshold (>{confidence_threshold})")
        
        # Estimated cost calculation (based on expected AI usage)
        # Assuming: Haiku = $0.00025 per call, Sonnet = $0.0003 per call
        estimated_cost_per_message = avg_ai * 0.00025  # Simplified estimate
        print(f"\nCost Estimate:")
        print(f"• Estimated cost per message: ${estimated_cost_per_message:.5f}")
        print(f"• Total cost for {len(successful)} messages: ${estimated_cost_per_message * len(successful):.5f}")
        
        # Check against target cost
        target_cost = 0.00055
        if estimated_cost_per_message <= target_cost:
            print(f"• ✅ Meets target cost (<${target_cost} per message)")
        else:
            print(f"• ⚠️ Exceeds target cost (>${target_cost} per message)")
    
    if failed:
        print(f"\n❌ Failed Conversions:")
        for r in failed:
            print(f"   • {r['file']}: {r.get('error', 'Unknown error')[:100]}")
    
    # Test Success Criteria
    print("\n" + "=" * 70)
    print("SUCCESS CRITERIA VALIDATION")
    print("=" * 70)
    
    criteria = {
        "All 5 MT103 files process successfully": len(successful) == 5,
        "Rules Lane handles structured fields": all(r["rules_fields"] > 0 for r in successful),
        "AI Lane processes Fields 70, 50K, 59": all(r["ai_fields"] >= 3 for r in successful),
        "Confidence scores > 0.7": all(r["confidence"] > 0.7 for r in successful),
        "Processing time < 15s per message": all(r["processing_time"] < 15 for r in successful),
    }
    
    all_passed = True
    for criterion, passed in criteria.items():
        status = "✅" if passed else "❌"
        print(f"{status} {criterion}")
        if not passed:
            all_passed = False
    
    print("\n" + "=" * 70)
    if all_passed:
        print("🎉 ALL TESTS PASSED! The system is ready for demonstration.")
    else:
        print("⚠️ Some tests failed. Please review the results above.")
    print("=" * 70)
    
    return results


if __name__ == "__main__":
    results = test_all_samples()
    
    # Optionally save results to file
    if results:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        output_file = f"test_results_{timestamp}.json"
        with open(output_file, 'w') as f:
            json.dump(results, f, indent=2, default=str)
        print(f"\n📁 Results saved to: {output_file}")