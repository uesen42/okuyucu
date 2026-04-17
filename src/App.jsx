import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Reader from './pages/Reader';

function App() {
  return (
    <Router>
      <div className="app-container">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/reader/:bookId" element={<Reader />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
