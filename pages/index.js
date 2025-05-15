import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function BiosimilarsDashboard() {
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
    <main style={{ padding: '2rem', fontFamily: 'Arial, sans-serif' }}>
      <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '1rem' }}>
        FDA-Approved Biosimilars
      </h1>
      {loading ? (
        <p>Loading data...</p>
      ) : (
        <div>
          {products.map(product => (
            <BiosimilarCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </main>
  );
}

function BiosimilarCard({ product }) {
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
    <div style={{ marginBottom: '1.5rem', padding: '1rem', border: '1px solid #ddd', borderRadius: '8px' }}>
      <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>{product.proprietary_name}</h2>
      <p style={{ margin: '0.25rem 0' }}>Applicant: {product.applicant}</p>
      <p style={{ margin: '0.25rem 0' }}>Reference: {product.reference_product}</p>
      <p style={{ margin: '0.25rem 0' }}>Approval Date: {product.approval_date || 'N/A'}</p>
      <ul style={{ paddingLeft: '1.25rem', marginTop: '0.75rem' }}>
        {presentations.map((pres, i) => (
          <li key={i}>
            {pres.name} – {pres.approved ? '✔️ Approved' : '❌ Not Approved'} ({pres.marketing_status})
          </li>
        ))}
      </ul>
    </div>
  );
}
