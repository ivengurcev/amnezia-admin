import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import LoginForm from './LoginForm.tsx';
import './styles.css';

const root = document.getElementById('root');

if (!root) {
    throw new Error('Root element not found');
}

createRoot(root).render(
    <StrictMode>
        <LoginForm />
    </StrictMode>,
);