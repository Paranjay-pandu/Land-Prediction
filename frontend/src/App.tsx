import { useState } from 'react'
import {  Route, Routes, BrowserRouter } from 'react-router-dom'
import './App.css';
import HomePage from './pages/Home.tsx';
import Layout from "./components/layout.tsx";

function App() {
  const [count, setCount] = useState(0)

  return (
    <>
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element = {<HomePage />} />
        </Route>
      </Routes>
    </BrowserRouter>
    </>
  )
}

export default App