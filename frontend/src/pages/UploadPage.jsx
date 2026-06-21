import { useEffect, useState } from "react";

import { getClients } from "../services/clientService";
import { uploadDataset } from "../services/datasetService";

export default function UploadPage() {
  const [clients, setClients] = useState([]);
  const [selectedClient, setSelectedClient] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadResult, setUploadResult] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadClients();
  }, []);

  const loadClients = async () => {
    const data = await getClients();
    setClients(data);
  };

  const handleUpload = async () => {
    if (!selectedClient) {
      alert("Select client");
      return;
    }

    if (!selectedFile) {
      alert("Choose file");
      return;
    }

    try {
      setLoading(true);

      const result = await uploadDataset(selectedClient, selectedFile);
      setUploadResult(result);

      alert("Upload Successful");
    } catch (error) {
      console.error(error);
      alert("Upload Failed");
    } finally {
      setLoading(false);
    }
  };

  const renderValidationReason = (label, value) => {
    if (value > 0) {
      return (
        <li>
          ⚠ {label}: {value}
        </li>
      );
    }

    return (
      <li>
        ✅ {label}: {value}
      </li>
    );
  };

  return (
    <div>
      <h1>Dataset Upload</h1>

      <div style={{ marginBottom: "20px" }}>
        <label>Select Client</label>
        <br />

        <select
          value={selectedClient}
          onChange={(e) => setSelectedClient(e.target.value)}
        >
          <option value="">Select Client</option>

          {clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.client_code} - {client.client_name}
            </option>
          ))}
        </select>
      </div>

      <div style={{ marginBottom: "20px" }}>
        <input
          type="file"
          accept=".csv,.xlsx,.json"
          onChange={(e) => setSelectedFile(e.target.files[0])}
        />
      </div>

      <button onClick={handleUpload} disabled={loading}>
        {loading ? "Uploading..." : "Upload Dataset"}
      </button>

      {uploadResult && (
        <>
          <hr />

          <h2>Dataset Summary</h2>

          <p>Name: {uploadResult.dataset.dataset_name}</p>
          <p>Type: {uploadResult.dataset.file_type}</p>
          <p>Records: {uploadResult.dataset.total_records}</p>
          <p>Columns: {uploadResult.dataset.total_columns}</p>
          <p>Status: {uploadResult.dataset.upload_status}</p>

          <h2>Validation Summary</h2>

          <p>
            Overall Status:{" "}
            <strong>{uploadResult.validation.status}</strong>
          </p>

          <ul>
            {renderValidationReason(
              "Duplicate Rows",
              uploadResult.validation.duplicate_rows
            )}

            {renderValidationReason(
              "Missing Values",
              uploadResult.validation.missing_values
            )}

            {renderValidationReason(
              "Invalid Amounts",
              uploadResult.validation.invalid_amounts
            )}

            {renderValidationReason(
              "Invalid Dates",
              uploadResult.validation.invalid_dates
            )}
          </ul>
          
          <h2>Schema Mapping</h2>

            {uploadResult.mapping && Object.keys(uploadResult.mapping).length > 0 ? (
              <ul>
                {Object.entries(uploadResult.mapping).map(([standardField, sourceColumn]) => (
                  <li key={standardField}>
                    <strong>{standardField}</strong> ← {sourceColumn}
                  </li>
                ))}
              </ul>
            ) : (
              <p>No automatic mapping detected.</p>
            )}
            
          <h2>Preview</h2>

          <table border="1" cellPadding="8">
            <thead>
              <tr>
                {uploadResult.preview.length > 0 &&
                  Object.keys(uploadResult.preview[0]).map((key) => (
                    <th key={key}>{key}</th>
                  ))}
              </tr>
            </thead>

            <tbody>
              {uploadResult.preview.map((row, index) => (
                <tr key={index}>
                  {Object.values(row).map((value, i) => (
                    <td key={i}>{String(value)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}