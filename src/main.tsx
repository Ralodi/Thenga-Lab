
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Force refresh by adding a timestamp
console.log("App refreshed at:", new Date().toISOString());

createRoot(document.getElementById("root")!).render(<App />);
