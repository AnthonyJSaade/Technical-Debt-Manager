#!/usr/bin/env python3
"""
Audit script to verify metric calibration.

Run this to check that the parser produces expected results for golden samples.

Usage:
    python audit_metrics.py
"""

import sys
from pathlib import Path

# Add app to path
sys.path.insert(0, str(Path(__file__).parent))

from app.analysis.parser import CodeParser


def audit_golden_sample():
    """Audit the golden_sample.py file."""
    golden_path = Path(__file__).parent / "tests" / "golden_sample.py"
    
    if not golden_path.exists():
        print("❌ golden_sample.py not found!")
        return False
    
    source = golden_path.read_text()
    parser = CodeParser()
    result = parser.analyze(source)
    
    print("=" * 60)
    print("🔍 METRIC AUDIT REPORT")
    print("=" * 60)
    print(f"📁 File: {golden_path.name}")
    print("-" * 60)
    print(f"📊 Lines of Code:         {result['lines_of_code']}")
    print(f"🔢 Node Count:            {result['node_count']}")
    print(f"🔄 Cyclomatic Complexity: {result['complexity_score']}")
    print(f"🧠 Cognitive Complexity:  {result['cognitive_complexity']}")
    print(f"📐 Halstead Volume:       {result['halstead_volume']:.2f}")
    print(f"🏥 Maintainability Index: {result['maintainability_index']:.2f}")
    print(f"⏱️  SQALE Debt (hours):    {result['sqale_debt_hours']:.2f}")
    print("-" * 60)
    
    # Expected values with block-based nesting:
    # process_data():
    #   if items: +1 (depth 0)
    #   for item: +2 (depth 1)
    #   if item.valid: +3 (depth 2)
    #   else: +1 (depth 0)
    #   try: +1 (depth 0)
    #   if result: +2 (depth 1)
    #   except: +1 (depth 0)
    #   Subtotal: 1+2+3+1+1+2+1 = 11
    # test_else_depth():
    #   if x > 5: +1
    #   elif x > 0: +1
    #   else: +1
    #   Subtotal: 3
    # Total: 14
    expected_cognitive = 14
    expected_sqale = round(14 * 0.15, 2)  # 2.10 hours
    
    print("\n📋 CALIBRATION CHECK:")
    print(f"   Expected Cognitive Complexity: {expected_cognitive}")
    print(f"   Actual Cognitive Complexity:   {result['cognitive_complexity']}")
    
    if result['cognitive_complexity'] == expected_cognitive:
        print("   ✅ PASS - Cognitive Complexity matches!")
    else:
        print(f"   ❌ FAIL - Expected {expected_cognitive}, got {result['cognitive_complexity']}")
    
    print(f"\n   Expected SQALE Debt: {expected_sqale}h")
    print(f"   Actual SQALE Debt:   {result['sqale_debt_hours']}h")
    
    if abs(result['sqale_debt_hours'] - expected_sqale) < 0.01:
        print("   ✅ PASS - SQALE Debt matches!")
    else:
        print(f"   ❌ FAIL - Expected {expected_sqale}h, got {result['sqale_debt_hours']}h")
    
    print("=" * 60)
    
    return result['cognitive_complexity'] == expected_cognitive


def audit_simple_code():
    """Audit a simple code snippet to verify no false penalties."""
    simple_code = '''
def add(a, b):
    return a + b

def subtract(a, b):
    return a - b

class Calculator:
    def multiply(self, a, b):
        return a * b
'''
    
    parser = CodeParser()
    result = parser.analyze(simple_code)
    
    print("\n" + "=" * 60)
    print("🔍 SIMPLE CODE AUDIT (Should have 0 cognitive complexity)")
    print("=" * 60)
    print(f"🧠 Cognitive Complexity: {result['cognitive_complexity']}")
    
    if result['cognitive_complexity'] == 0:
        print("✅ PASS - Simple functions/classes have no complexity penalty!")
    else:
        print(f"❌ FAIL - Expected 0, got {result['cognitive_complexity']}")
    
    print("=" * 60)
    
    return result['cognitive_complexity'] == 0


def audit_nesting_precision():
    """
    Audit that nesting is block-based, not statement-based.
    
    Key test: else/elif should be at the SAME depth as if, not deeper.
    """
    test_code = '''
def test():
    if True:       # +1 (depth 0)
        x = 1
    else:          # +1 (depth 0) - NOT depth 1!
        x = 2
'''
    
    parser = CodeParser()
    result = parser.analyze(test_code)
    
    print("\n" + "=" * 60)
    print("🔍 NESTING PRECISION AUDIT")
    print("=" * 60)
    print("   Code: if True: ... else: ...")
    print(f"   Expected: 2 (if=1 + else=1, both at depth 0)")
    print(f"   Actual:   {result['cognitive_complexity']}")
    
    # if at depth 0 = 1
    # else at depth 0 = 1
    # Total = 2
    expected = 2
    
    if result['cognitive_complexity'] == expected:
        print("   ✅ PASS - else is correctly at depth 0!")
    else:
        print(f"   ❌ FAIL - Expected {expected}, got {result['cognitive_complexity']}")
        if result['cognitive_complexity'] == 3:
            print("   ⚠️  else appears to be at depth 1 (leaky nesting)")
    
    print("=" * 60)
    
    return result['cognitive_complexity'] == expected


def audit_nested_for():
    """
    Audit that nested for loop inside if gets correct penalty.
    """
    test_code = '''
def test():
    if True:           # +1 (depth 0)
        for i in x:    # +2 (depth 1, inside if's block)
            pass
'''
    
    parser = CodeParser()
    result = parser.analyze(test_code)
    
    print("\n" + "=" * 60)
    print("🔍 NESTED FOR AUDIT")
    print("=" * 60)
    print("   Code: if True: for i in x: ...")
    print(f"   Expected: 3 (if=1 at depth 0, for=2 at depth 1)")
    print(f"   Actual:   {result['cognitive_complexity']}")
    
    # if at depth 0 = 1
    # for at depth 1 = 1 + 1 = 2
    # Total = 3
    expected = 3
    
    if result['cognitive_complexity'] == expected:
        print("   ✅ PASS - Nested for correctly gets depth penalty!")
    else:
        print(f"   ❌ FAIL - Expected {expected}, got {result['cognitive_complexity']}")
    
    print("=" * 60)
    
    return result['cognitive_complexity'] == expected


if __name__ == "__main__":
    print("\n🚀 Starting Metric Audit...\n")
    
    golden_ok = audit_golden_sample()
    simple_ok = audit_simple_code()
    nesting_ok = audit_nesting_precision()
    nested_for_ok = audit_nested_for()
    
    all_passed = golden_ok and simple_ok and nesting_ok and nested_for_ok
    
    print("\n" + "=" * 60)
    if all_passed:
        print("✅ ALL CALIBRATION CHECKS PASSED!")
    else:
        print("❌ SOME CALIBRATION CHECKS FAILED")
    print("=" * 60 + "\n")
    
    sys.exit(0 if all_passed else 1)
