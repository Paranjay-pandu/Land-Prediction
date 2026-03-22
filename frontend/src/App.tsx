import { lazy, Suspense } from 'react'
import {  Route, Routes, BrowserRouter } from 'react-router-dom'
import './App.css';
import Layout from "./components/layout.tsx";

const HomePage = lazy(() => import('./pages/Home.tsx'));
const PredictionPage = lazy(() => import('./pages/Predict.tsx'));
const ComparePage = lazy(() => import('./pages/Compare.tsx'));
const AnalyticsPage = lazy(() => import('./pages/Analytics.tsx'));

function App() {
  // const [count, setCount] = useState(0)

  return (
    <>
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Suspense fallback={<div className="panel">Loading dashboard...</div>}><HomePage /></Suspense>} />
          <Route path="/predict" element={<Suspense fallback={<div className="panel">Loading predictor...</div>}><PredictionPage /></Suspense>} />
          <Route path="/compare" element={<Suspense fallback={<div className="panel">Loading comparison...</div>}><ComparePage /></Suspense>} />
          <Route path="/analytics" element={<Suspense fallback={<div className="panel">Loading analytics...</div>}><AnalyticsPage /></Suspense>} />
          <Route path="/home" element={<Suspense fallback={<div className="panel">Loading dashboard...</div>}><HomePage /></Suspense>} />


          <Route path="*" element = {<div> 404 Not Found </div>} />
        </Route>
      </Routes>
    </BrowserRouter>
    </>
  )
}

export default App