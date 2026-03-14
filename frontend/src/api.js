import axios from 'axios';

const API_BASE_URL = 'http://127.0.0.1:8000';

export const uploadFiles = async (files) => {
    const formData = new FormData();
    Array.from(files).forEach(file => {
        formData.append('files', file);
    });

    const response = await axios.post(`${API_BASE_URL}/upload`, formData, {
        headers: {
            'Content-Type': 'multipart/form-data',
        },
    });
    return response.data;
};

export const queryData = async (query, format) => {
    const response = await axios.post(`${API_BASE_URL}/generate-dataset`, { query, format });
    return response.data;
};