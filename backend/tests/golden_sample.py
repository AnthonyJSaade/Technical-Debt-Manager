"""
Golden sample for testing cognitive complexity calibration.

Using block-based nesting (Python's indentation structure as source of truth):

Breakdown for process_data():
- if items:              → +1 (depth 0) = 1
  - for item in items:   → +1+1 (depth 1) = 2  (inside if's block)
    - if item.valid:     → +1+2 (depth 2) = 3  (inside for's block)
- else (after if items): → +1 (depth 0) = 1  (else is sibling to if, not nested)
- try:                   → +1 (depth 0) = 1
  - if result:           → +1+1 (depth 1) = 2  (inside try's block)
- except KeyError:       → +1 (depth 0) = 1  (except is sibling to try, not nested)

Subtotal for process_data: 1 + 2 + 3 + 1 + 1 + 2 + 1 = 11

Breakdown for test_else_depth():
- if x > 5:              → +1 (depth 0)
- elif x > 0:            → +1 (depth 0)
- else:                  → +1 (depth 0)
Subtotal: 3

Total: 11 + 3 = 14
"""


def process_data(items: list) -> dict:
    """Process a list of items with various control structures."""
    result = {}
    
    if items:  # +1 (depth 0)
        for item in items:  # +2 (depth 1, inside if's block)
            if item.get("valid"):  # +3 (depth 2, inside for's block)
                result[item["id"]] = item["value"]
    else:  # +1 (depth 0, sibling to if - NOT inside if's block)
        result["empty"] = True
    
    try:  # +1 (depth 0)
        if result:  # +2 (depth 1, inside try's block)
            result["processed"] = True
    except KeyError:  # +1 (depth 0, sibling to try - NOT inside try's block)
        result["error"] = True
    
    return result


def simple_function(x: int) -> int:
    """A simple function with no complexity."""
    return x * 2


def test_else_depth():
    """Test that else clauses are at correct depth."""
    x = 10
    if x > 5:       # +1 (depth 0)
        y = 1
    elif x > 0:     # +1 (depth 0, sibling to if)
        y = 2
    else:           # +1 (depth 0, sibling to if)
        y = 3
    return y
    # Total for this function: 3
