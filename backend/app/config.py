import os
from dotenv import load_dotenv

load_dotenv()

STORAGE_DIR = os.getenv("STORAGE_DIR", "./storage")
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")
MAX_UPLOAD_MB = int(os.getenv("MAX_UPLOAD_MB", "50"))
MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024

REQUIRED_COLUMNS = [
    "Batch_ID", "Machine_ID", "Temperature", "Pressure",
    "Machine_Speed", "Raw_Material_Batch", "Operator_Shift", "Defect_Status"
]
NUMERIC_FEATURES = ["Temperature", "Pressure", "Machine_Speed"]
CATEGORICAL_FEATURES = ["Machine_ID", "Raw_Material_Batch", "Operator_Shift"]
TARGET_COL = "Defect_Status"
BATCH_COL = "Batch_ID"

# Supported target mappings → (defective_value, non_defective_value)
TARGET_MAPPINGS = [
    ({1, "1"}, {0, "0"}),
    ({"yes", "Yes", "YES", "y", "Y"}, {"no", "No", "NO", "n", "N"}),
    ({"true", "True", "TRUE"}, {"false", "False", "FALSE"}),
    ({"defective", "Defective", "DEFECTIVE"}, {"non-defective", "Non-defective", "NON-DEFECTIVE",
                                                "nondefective", "NonDefective", "good", "Good"}),
]
