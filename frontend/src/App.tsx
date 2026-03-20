// import { useState } from 'react'
import {  Route, Routes, BrowserRouter } from 'react-router-dom'
import './App.css';
import HomePage from './pages/Home.tsx';
import Layout from "./components/layout.tsx";

function App() {
  // const [count, setCount] = useState(0)

  return (
    <>
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element = {<HomePage />} />
          <Route path="/predict" element = {<div> Prediction Page </div>} />
          <Route path="/compare" element = {<div> Comparison Page </div>} />
          <Route path="/home" element = {<HomePage />} />


          <Route path="*" element = {<div> 404 Not Found </div>} />
        </Route>
      </Routes>
    </BrowserRouter>
    </>
  )
}

export default App