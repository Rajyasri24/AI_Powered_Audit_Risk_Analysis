# Top 20 Automated Test Cases for Project Report

Populate **Actual Result** and **Status** from the generated pytest result files.

| ID | Test Area | Test Case | Expected Result | Actual Result | Status |
|---|---|---|---|---|---|
| TC-01 | RBAC | Dashboard access for all valid roles | Admin, Audit Manager and Auditor permitted | Pending | Pending |
| TC-02 | RBAC | Client read access | All three roles permitted | Pending | Pending |
| TC-03 | RBAC | Client mutation | Admin only | Pending | Pending |
| TC-04 | RBAC | Rule mutation | Admin and Auditor only | Pending | Pending |
| TC-05 | RBAC | Dataset mutation | Admin and Auditor only | Pending | Pending |
| TC-06 | RBAC | Analysis execution | Admin and Auditor only | Pending | Pending |
| TC-07 | Risk | Risk score = 20 | Low | Pending | Pending |
| TC-08 | Risk | Risk score = 21 | Medium | Pending | Pending |
| TC-09 | Risk | Risk score = 51 | High | Pending | Pending |
| TC-10 | Risk | Risk score = 76 | Critical | Pending | Pending |
| TC-11 | Analysis | Transaction ID normalization | 9944.0 becomes 9944 | Pending | Pending |
| TC-12 | Analysis | Merge Rule + ML + Network evidence | Scores and sources merged correctly | Pending | Pending |
| TC-13 | Analysis | Latest completed run selection | Latest COMPLETED run retained per dataset | Pending | Pending |
| TC-14 | File Processing | CSV ingestion | Dataset loads correctly | Pending | Pending |
| TC-15 | File Processing | JSON ingestion | Dataset loads correctly | Pending | Pending |
| TC-16 | File Processing | XLSX ingestion | Dataset loads correctly | Pending | Pending |
| TC-17 | ML | Small dataset handling | No anomalies for <5 rows | Pending | Pending |
| TC-18 | ML | Leakage prevention | ID/label columns excluded | Pending | Pending |
| TC-19 | ML | Determinism | Same input gives identical output | Pending | Pending |
| TC-20 | Reports | Latest completed assessment | Correct latest assessment selected | Pending | Pending |
