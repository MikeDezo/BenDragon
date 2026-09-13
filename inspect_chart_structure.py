import json

with open('full_stats_matrix.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

cells = data['cells']

# Let's inspect the exact column structure from G to AN
# In Excel:
# G, H are roll ranges
# I, J (Shift 0)
# K, L (Feeble)
# M, N (Poor)
# O, P (Typical)
# Q, R (Good)
# S, T (Excelent)
# U, V (Remarkable)
# W, X (Incredible)
# Y, Z (Amazing)
# AA, AB (Monstrous)
# AC, AD (Unearthly)
# AE, AF (Shift X)
# AG, AH (Shift Y)
# AI (Shift Z)
# AJ (Black divider)
# AK (Class 1000)
# AL (Class 3000)
# AM (Class 5000)
# AN (Beyond)

columns = [
    ('G', 'H', 'Roll'),
    ('I', 'J', 'Shift 0'),
    ('K', 'L', 'Feeble'),
    ('M', 'N', 'Poor'),
    ('O', 'P', 'Typical'),
    ('Q', 'R', 'Good'),
    ('S', 'T', 'Excelent'),
    ('U', 'V', 'Remarkable'),
    ('W', 'X', 'Incredible'),
    ('Y', 'Z', 'Amazing'),
    ('AA', 'AB', 'Monstrous'),
    ('AC', 'AD', 'Unearthly'),
    ('AE', 'AF', 'Shift X'),
    ('AG', 'AH', 'Shift Y'),
    ('AI', 'AI', 'Shift Z'),
    ('AJ', 'AJ', 'Divider'),
    ('AK', 'AK', 'Class 1000'),
    ('AL', 'AL', 'Class 3000'),
    ('AM', 'AM', 'Class 5000'),
    ('AN', 'AN', 'Beyond')
]

# Let's check headers in rows 1, 2, 3, 4
for r in range(1, 5):
    row_vals = []
    for c1, c2, name in columns:
        v1 = cells.get(f"{c1}{r}", {}).get('v', '')
        v2 = cells.get(f"{c2}{r}", {}).get('v', '') if c1 != c2 else ''
        row_vals.append(f"{v1 or v2}")
    print(f"Header Row {r}: " + " | ".join(row_vals))

print("\n--- Rows 5 to 28 ---")
for r in range(5, 29):
    row_vals = []
    for c1, c2, name in columns:
        c_obj1 = cells.get(f"{c1}{r}", {})
        c_obj2 = cells.get(f"{c2}{r}", {}) if c1 != c2 else {}
        v1 = c_obj1.get('v', '')
        v2 = c_obj2.get('v', '')
        val = v1 if v1 else v2
        
        fill1 = c_obj1.get('fill', {}).get('fg_rgb')
        fill2 = c_obj2.get('fill', {}).get('fg_rgb')
        fill = fill1 or fill2
        
        row_vals.append(f"{val}({fill or 'none'})")
    print(f"Row {r:2d}: " + " | ".join(row_vals))
