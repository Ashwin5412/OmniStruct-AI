import axios from 'axios';

const API = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000',
  timeout: 120000, // 2 min for large PDF processing
});

/**
 * Upload a PDF and extract a dataset based on a prompt.
 * @param {File} file - The PDF file
 * @param {string} prompt - User's extraction prompt
 * @param {string} format - Output format: 'json' | 'csv' | 'excel'
 * @returns {{ sessionId, columns, rows, summary }}
 */
export async function uploadAndExtract(file, prompt, format) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('prompt', prompt);
  formData.append('format', format);

  const { data } = await API.post('/extract', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

/**
 * Ask a question about an extracted dataset.
 * @param {string} sessionId
 * @param {string} question
 * @returns {{ answer }}
 */
export async function askQuestion(sessionId, question) {
  const { data } = await API.post('/chat', { sessionId, question });
  return data;
}

/**
 * Download the extracted dataset in the chosen format.
 * @param {string} sessionId
 * @param {string} format - 'json' | 'csv' | 'excel'
 */
export async function downloadDataset(sessionId, format) {
  const { data } = await API.get(`/download/${sessionId}`, {
    params: { format },
    responseType: 'blob',
  });

  const ext = format === 'excel' ? 'xlsx' : format;
  const mimeMap = {
    json: 'application/json',
    csv: 'text/csv',
    tsv: 'text/tab-separated-values',
    excel: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  };

  const blob = new Blob([data], { type: mimeMap[format] });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `dataset.${ext}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * Get all past extraction sessions.
 * @returns {Array}
 */
export async function getSessions() {
  const { data } = await API.get('/sessions');
  return data;
}

/**
 * Get details and messages for a specific session.
 * @param {string|number} sessionId 
 * @returns {Object}
 */
export async function getSession(sessionId) {
  const { data } = await API.get(`/sessions/${sessionId}`);
  return data;
}

/**
 * Delete a specific session.
 * @param {string|number} sessionId 
 * @returns {Object}
 */
export async function deleteSession(sessionId) {
  const { data } = await API.delete(`/sessions/${sessionId}`);
  return data;
}

export default API;
