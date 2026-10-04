import React from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-500.css';
import '@fontsource/inter/latin-600.css';
import '@fontsource/inter/latin-700.css';
import '@fontsource/inter/latin-800.css';
import App from './App';
import './styles.css';
import { getBuildVersion } from './utils/buildVersion';

document.querySelector('meta[name="siga-build"]')?.setAttribute('content',
  getBuildVersion(import.meta.env.VITE_BUILD_SHA, import.meta.env.VITE_VERCEL_GIT_COMMIT_SHA));

createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>);
