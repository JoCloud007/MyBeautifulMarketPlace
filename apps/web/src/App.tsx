import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import PageTransition from './components/PageTransition';
import ErrorBoundary from './components/ErrorBoundary';
import ToastContainer from './components/Toast';
import Home from './pages/Home';
import Marketplace from './pages/Marketplace';
import ProductDetail from './pages/ProductDetail';
import AvailabilityZones from './pages/AvailabilityZones';
import Roadmap from './pages/Roadmap';
import Continuity from './pages/Continuity';
import Forecasts from './pages/Forecasts';
import Applications from './pages/Applications';
import ApplicationDetail from './pages/ApplicationDetail';
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
            <Route path="/availability-zones" element={<AvailabilityZones />} />
            <Route path="/roadmap" element={<Roadmap />} />
            <Route path="/continuity" element={<Continuity />} />
            <Route path="/forecasts" element={<Forecasts />} />
            <Route path="/applications" element={<Applications />} />
            <Route path="/applications/:id" element={<ApplicationDetail />} />
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
