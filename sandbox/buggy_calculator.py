"""A simple calculator with a division by zero bug."""


def divide(a: int, b: int) -> float:
    """Divide a by b. Has a bug - doesn't handle division by zero!"""
    return a / b


def calculate_average(numbers: list[int]) -> float:
    """Calculate the average of a list of numbers."""
    total = sum(numbers)
    count = len(numbers)
    return divide(total, count)

