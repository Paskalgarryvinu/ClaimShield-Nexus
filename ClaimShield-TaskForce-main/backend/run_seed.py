"""Standalone seed script for ClaimShield Nexus."""
import sys
import os

# Add backend directory to sys.path
backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.generator.synthetic_generator import generate_synthetic_data

if __name__ == "__main__":
    print("Seeding ClaimShield Nexus synthetic dataset...")
    stats = generate_synthetic_data()
    print("Seed complete! Generated record counts:")
    for k, v in stats.items():
        print(f"  - {k}: {v}")
