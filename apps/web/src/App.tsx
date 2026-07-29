import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import PageTransition from './components/PageTransition';
import ErrorBoundary from './components/ErrorBoundary';
import ToastContainer from './components/Toast';
import Home from './pages/Home';
import Marketplace from './pages/Marketplace';
import ProductDetail from './pages/ProductDetail';
import Forecasts from './pages/Forecasts';
import Admin from './pages/Admin';
import NotFound from './pages/NotFound';

function App() {
  return (
    <Layout>
      <ErrorBoundary>
        <PageTransition>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/marketplace" element={<Marketplace />} />
            <Route path="/products/:slug" element={<ProductDetail />} />
            <Route path="/forecasts" element={<Forecasts />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </PageTransition>
      </ErrorBoundary>
      <ToastContainer />
    </Layout>
  );
}

export default App;
