# Run Automated Tests and Save Results

Copy the `backend/tests`, `backend/pytest.ini`, `backend/requirements-dev.txt`,
and `backend/run_tests_and_save.ps1` files into your project.

From the **backend** directory:

```powershell
venv\Scripts\activate
pip install -r requirements-dev.txt
powershell -ExecutionPolicy Bypass -File .\run_tests_and_save.ps1
```

Results are automatically saved under:

```text
backend/test-results/
├── pytest_YYYYMMDD_HHMMSS.txt
├── pytest_YYYYMMDD_HHMMSS.xml
└── summary_YYYYMMDD_HHMMSS.txt
```

Use the TXT/summary files for documentation and the XML file for machine-readable test evidence.

Recommended Git policy:
- Commit the test code and runner.
- Do not commit generated `test-results/` files unless your academic submission specifically requires stored execution evidence.
