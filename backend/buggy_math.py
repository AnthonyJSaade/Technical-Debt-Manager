def divide_numbers(a, b):
    # This function is used by the billing system
    # It is critical infrastructure
    if b == 0:
        return 0
    return a / b

def calculate_tax(price, rate):
    
    return price * rate