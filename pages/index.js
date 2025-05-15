// Updated React-based FDA Approval Overview Page
// Matches uploaded visual style and integrates Supabase data

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function FDAApprovalOverview() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      const { data, error } = await supabase
        .from('biosimilar_products')
        .select('id, proprietary_name, applicant, reference_product, bla_type, approval_date');
      if (!error) setProducts(data);
      setLoading(false);
    }
    fetchData();
  }, []);

  return (
    <div className="min-h-screen bg-white font-sans text-gray-800">
      <header className="bg-blue-900 text-white p-6 shadow-md">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div className="text-2xl font-bold">ALL THINGS BIOSIMILAR</div>
          <nav className="space-x-6 text-sm">
            <a href="#" className="hover:text-gray-300">Home</a>
            <a href="#" className="font-semibold border-b-2 border-white">FDA Approval Overview</a>
            <a href="#" className="hover:text-gray-300">Savings Tool</a>
            <a href="#" className="hover:text-gray-300">Forecasting</a>
          </nav>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-6">
        <h1 className="text-3xl font-semibold mb-6">FDA-Approved Biosimilars</h1>
        {loading ? (
          <p>Loading data...</p>
        ) : (
          <div className="space-y-6">
            {products.map(product => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function ProductCard({ product }) {
  const [presentations, setPresentations] = useState([]);

  useEffect(() => {
    async function fetchPresentations() {
      const { data } = await supabase
        .from('presentations')
        .select('name, approved, marketing_status')
        .eq('product_id', product.id);
      if (data) setPresentations(data);
    }
    fetchPresentations();
  }, [product.id]);

  return (
    <div className="border border-gray-200 rounded-lg p-4 shadow-sm">
      <h2 className="text-xl font-bold text-blue-900 mb-1">{product.proprietary_name}</h2>
      <p className="text-sm text-gray-600">Applicant: {product.applicant}</p>
      <p className="text-sm text-gray-600">Reference Product: {product.reference_product}</p>
      <p className="text-sm text-gray-600">Approval Date: {product.approval_date || 'N/A'}</p>
      <div className="mt-3">
        <h3 className="font-medium text-sm text-gray-700 mb-1">Presentations</h3>
        <ul className="list-disc ml-5 text-sm text-gray-800">
          {presentations.map((pres, idx) => (
            <li key={idx}>
              {pres.name} – {pres.approved ? '✔️ Approved' : '❌ Not Approved'} ({pres.marketing_status})
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
