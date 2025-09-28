import React from 'react'
import ReactDOM from 'react-dom/client'
import TimeLogGenerator from './TimeLogGenerator'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <div className="min-h-screen bg-gray-100 py-8">
      <TimeLogGenerator />
    </div>
  </React.StrictMode>,
)